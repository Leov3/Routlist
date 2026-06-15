import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';
import { PERMISSIONS, GLOBAL_ROLE_NAME } from '../../../shared/constants/rbac.constants';
import { AuthenticatedUser } from '../../../shared/types/authenticated-user';

type JwtPayload = {
  sub: string;
  organizationId: string;
  sessionId: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.jwtSecret'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Invalid session');
    }

    const session = await this.prisma.userSession.findFirst({
      where: {
        sessionId: payload.sessionId,
        userId: payload.sub,
        organizationId: payload.organizationId,
        isActive: true,
      },
      select: {
        id: true,
        sessionId: true,
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    const isGlobalOwner = await this.prisma.organizationMember.findFirst({
      where: {
        userId: payload.sub,
        status: 'ACTIVE',
        role: { name: GLOBAL_ROLE_NAME },
        organization: { status: 'ACTIVE' },
        user: { status: 'ACTIVE' },
      },
      select: { id: true },
    });

    if (isGlobalOwner) {
      const organization = await this.prisma.organization.findFirst({
        where: {
          id: payload.organizationId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      if (!organization) {
        throw new UnauthorizedException('Invalid session');
      }

      return {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        organizationId: organization.id,
        role: GLOBAL_ROLE_NAME,
        permissions: [...PERMISSIONS],
        sessionId: session.sessionId,
      };
    }

    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: payload.organizationId,
        userId: payload.sub,
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
    });

    if (!member) {
      throw new UnauthorizedException('Invalid session');
    }

    return {
      id: member.userId,
      email: user.email,
      fullName: user.fullName,
      organizationId: member.organizationId,
      role: member.role.name,
      permissions: member.role.permissions.map(({ permission }) => permission.key),
      sessionId: session.sessionId,
    };
  }
}
