import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { PERMISSIONS, GLOBAL_ROLE_NAME, ROLE_PERMISSIONS } from '../../shared/constants/rbac.constants';
import { LoginDto } from './dto/login.dto';
import { AccessSettingsService } from '../access-settings/access-settings.service';

type SessionResult = {
  accessToken: string;
  user: AuthenticatedUser;
};

type SessionContext = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly accessSettingsService: AccessSettingsService,
  ) {}

  async login(loginDto: LoginDto, context: SessionContext = {}): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: loginDto.email.toLowerCase() },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordMatches = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        status: 'ACTIVE',
        organization: { status: 'ACTIVE' },
      },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!member) {
      throw new UnauthorizedException('User has no active organization');
    }

    const permissions = await this.resolveLoginPermissions(
      member.role.name,
      member.organizationId,
    );

    return this.createSession(user.id, member.organizationId, member.role.name, permissions, context);
  }

  async switchOrganization(
    currentUser: AuthenticatedUser,
    organizationId: string,
  ): Promise<SessionResult> {
    if (currentUser.role !== GLOBAL_ROLE_NAME) {
      throw new ForbiddenException('Only OWNER can switch organizations');
    }

    const permissions = [...PERMISSIONS];
    return this.createSession(
      currentUser.id,
      organizationId,
      GLOBAL_ROLE_NAME,
      permissions,
      undefined,
      currentUser.sessionId,
    );
  }

  async logout(currentUser: AuthenticatedUser) {
    if (!currentUser.sessionId) {
      return { ok: true };
    }

    await this.prisma.userSession.updateMany({
      where: {
        sessionId: currentUser.sessionId,
        userId: currentUser.id,
        isActive: true,
      },
        data: {
          isActive: false,
          status: 'REVOKED',
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
    });

    return { ok: true };
  }

  async touchSession(sessionId: string | undefined) {
    if (!sessionId) return;

    await this.prisma.userSession.updateMany({
      where: {
        sessionId,
        isActive: true,
      },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }

  private async createSession(
    userId: string,
    organizationId: string,
    role: string,
    permissions: string[],
    context: SessionContext = {},
    reuseSessionId?: string,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid session');
    }

    if (role === GLOBAL_ROLE_NAME) {
      const organization = await this.prisma.organization.findFirst({
        where: {
          id: organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (!organization) {
        throw new UnauthorizedException('Organization not found');
      }

      return this.issueSession(
        user,
        organization.id,
        GLOBAL_ROLE_NAME,
        permissions,
        context,
        reuseSessionId,
      );
    }

    return this.issueSession(
      user,
      organizationId,
      role,
      permissions,
      context,
      reuseSessionId,
    );
  }

  private async resolveLoginPermissions(
    role: string,
    organizationId: string,
  ): Promise<string[]> {
    try {
      return await this.accessSettingsService.resolveEffectivePermissions(
        role,
        organizationId,
      );
    } catch (error) {
      this.logger.warn(
        `Falling back to static role permissions during login for role=${role} organizationId=${organizationId}`,
      );
      this.logger.debug(error);

      return role === GLOBAL_ROLE_NAME
        ? [...PERMISSIONS]
        : [...(ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [])];
    }
  }

  private async issueSession(
    user: {
      id: string;
      email: string;
      fullName: string;
    },
    organizationId: string,
    role: string,
    permissions: string[],
    context: SessionContext = {},
    reuseSessionId?: string,
  ): Promise<SessionResult> {
    return this.prisma.$transaction(async (tx) => {
      let sessionId = reuseSessionId;

      if (sessionId) {
        const activeSession = await tx.userSession.findFirst({
          where: {
            sessionId,
            userId: user.id,
            isActive: true,
          },
        });

        if (!activeSession) {
          throw new UnauthorizedException('Invalid session');
        }

        await tx.userSession.update({
          where: { id: activeSession.id },
          data: {
            organizationId,
            lastSeenAt: new Date(),
          },
        });
      } else {
        await tx.userSession.updateMany({
          where: {
            userId: user.id,
            isActive: true,
          },
          data: {
            isActive: false,
            status: 'REVOKED',
            revokedAt: new Date(),
            revokedReason: 'replaced-by-new-session',
          },
        });

        const session = await tx.userSession.create({
          data: {
            userId: user.id,
            organizationId,
            sessionId: randomUUID(),
            isActive: true,
            lastSeenAt: new Date(),
            userAgent: context.userAgent?.trim() || null,
            ipAddress: context.ipAddress?.trim() || null,
          },
        });

        sessionId = session.sessionId;
      }

      const authUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organizationId,
        role,
        permissions,
        sessionId,
      };

      const accessToken = await this.jwtService.signAsync({
        sub: user.id,
        organizationId,
        sessionId,
      });

      return { accessToken, user: authUser };
    });
  }
}
