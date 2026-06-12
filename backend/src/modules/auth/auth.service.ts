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

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<SessionResult> {
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

    return this.issueSession(user.id, member.organizationId, member);
  }

  async switchOrganization(
    currentUser: AuthenticatedUser,
    organizationId: string,
  ): Promise<SessionResult> {
    if (currentUser.role !== GLOBAL_ROLE_NAME) {
      throw new ForbiddenException('Only OWNER can switch organizations');
    }

    return this.issueSession(currentUser.id, organizationId);
  }

  private async issueSession(
    userId: string,
    organizationId: string,
    organizationMember?: {
      organizationId: string;
      role: {
        name: string;
        permissions: { permission: { key: string } }[];
      };
    },
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

      return this.buildSession(
        user,
        organization.id,
        GLOBAL_ROLE_NAME,
        [...PERMISSIONS],
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

    return this.buildSession(
      user,
      member.organizationId,
      member.role.name,
      member.role.permissions.map(({ permission }) => permission.key),
    );
  }

  private async buildSession(
    user: {
      id: string;
      email: string;
      fullName: string;
    },
    organizationId: string,
    role: string,
    permissions: string[],
  ): Promise<SessionResult> {
    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      organizationId,
      role,
      permissions,
    };

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      organizationId,
    });

    return { accessToken, user: authUser };
  }
}
