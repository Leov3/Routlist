import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { PERMISSIONS, GLOBAL_ROLE_NAME } from '../../shared/constants/rbac.constants';
import { LoginDto } from './dto/login.dto';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
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

    return this.createSession(user.id, member.organizationId, member, context);
  }

  async switchOrganization(
    currentUser: AuthenticatedUser,
    organizationId: string,
  ): Promise<SessionResult> {
    if (currentUser.role !== GLOBAL_ROLE_NAME) {
      throw new ForbiddenException('Only OWNER can switch organizations');
    }

    return this.createSession(
      currentUser.id,
      organizationId,
      {
        organizationId,
        role: {
          name: GLOBAL_ROLE_NAME,
          permissions: [...PERMISSIONS].map((key) => ({ permission: { key } })),
        },
      },
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
        id: currentUser.sessionId,
        userId: currentUser.id,
        status: 'ACTIVE',
      },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    return { ok: true };
  }

  async touchSession(sessionId: string | undefined) {
    if (!sessionId) return;

    await this.prisma.userSession.updateMany({
      where: {
        id: sessionId,
        status: 'ACTIVE',
      },
      data: {
        lastSeenAt: new Date(),
      },
    });
  }

  private async createSession(
    userId: string,
    organizationId: string,
    organizationMember?: {
      organizationId: string;
      role: {
        name: string;
        permissions: { permission: { key: string } }[];
      };
    },
    context: SessionContext = {},
    reuseSessionId?: string,
  ): Promise<SessionResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid session');
    }

    if (organizationMember?.role.name === GLOBAL_ROLE_NAME) {
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
        [...PERMISSIONS],
        context,
        reuseSessionId,
      );
    }

    const member =
      organizationMember ??
      (await this.prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId,
          status: 'ACTIVE',
          organization: { status: 'ACTIVE' },
          user: { status: 'ACTIVE' },
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
      }));

    if (!member) {
      throw new UnauthorizedException('Invalid session');
    }

    return this.issueSession(
      user,
      member.organizationId,
      member.role.name,
      member.role.permissions.map(({ permission }) => permission.key),
      context,
      reuseSessionId,
    );
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
            id: sessionId,
            userId: user.id,
            status: 'ACTIVE',
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
            status: 'ACTIVE',
          },
          data: {
            status: 'REVOKED',
            revokedAt: new Date(),
          },
        });

        const session = await tx.userSession.create({
          data: {
            userId: user.id,
            organizationId,
            status: 'ACTIVE',
            lastSeenAt: new Date(),
            userAgent: context.userAgent?.trim() || null,
            ipAddress: context.ipAddress?.trim() || null,
          },
        });

        sessionId = session.id;
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
