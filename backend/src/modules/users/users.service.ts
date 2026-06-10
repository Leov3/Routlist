import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(currentUser: AuthenticatedUser) {
    const members = await this.prisma.organizationMember.findMany({
      where: { organizationId: currentUser.organizationId },
      include: {
        user: true,
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map(({ user, role, status }) => ({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      membershipStatus: status,
      role: role.name,
      createdAt: user.createdAt,
    }));
  }

  async create(currentUser: AuthenticatedUser, dto: CreateUserDto) {
    this.assertCanAssignRole(currentUser, dto.role);

    const role = await this.prisma.role.findUnique({
      where: { name: dto.role },
    });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        fullName: dto.fullName,
        passwordHash,
        memberships: {
          create: {
            organizationId: currentUser.organizationId,
            roleId: role.id,
          },
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      role: role.name,
    };
  }

  async disable(currentUser: AuthenticatedUser, id: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        userId: id,
      },
    });

    if (!member) {
      throw new NotFoundException('User not found in this organization');
    }

    await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { status: 'DISABLED' },
    });

    return this.prisma.user.update({
      where: { id },
      data: { status: 'DISABLED' },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });
  }

  async enable(currentUser: AuthenticatedUser, id: string) {
    const member = await this.ensureMember(currentUser, id);

    await this.prisma.organizationMember.update({
      where: { id: member.id },
      data: { status: 'ACTIVE' },
    });

    return this.prisma.user.update({
      where: { id },
      data: { status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });
  }

  async update(currentUser: AuthenticatedUser, id: string, dto: UpdateUserDto) {
    const member = await this.ensureMember(currentUser, id);

    const data: {
      email?: string;
      fullName?: string;
      passwordHash?: string;
    } = {};

    if (dto.email) {
      const email = dto.email.toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });

      if (existing && existing.id !== id) {
        throw new ConflictException('Email already exists');
      }

      data.email = email;
    }

    if (dto.fullName) {
      data.fullName = dto.fullName;
    }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 12);
    }

    if (dto.role) {
      this.assertCanAssignRole(currentUser, dto.role);
      const role = await this.prisma.role.findUnique({
        where: { name: dto.role },
      });

      if (!role) {
        throw new NotFoundException('Role not found');
      }

      await this.prisma.organizationMember.update({
        where: { id: member.id },
        data: { roleId: role.id },
      });
    }

    const user = Object.keys(data).length
      ? await this.prisma.user.update({
          where: { id },
          data,
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true,
          },
        })
      : await this.prisma.user.findUniqueOrThrow({
          where: { id },
          select: {
            id: true,
            email: true,
            fullName: true,
            status: true,
          },
        });

    const updatedMember = await this.prisma.organizationMember.findUniqueOrThrow({
      where: { id: member.id },
      include: { role: true },
    });

    return {
      ...user,
      membershipStatus: updatedMember.status,
      role: updatedMember.role.name,
    };
  }

  private async ensureMember(currentUser: AuthenticatedUser, id: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: {
        organizationId: currentUser.organizationId,
        userId: id,
      },
    });

    if (!member) {
      throw new NotFoundException('User not found in this organization');
    }

    return member;
  }

  private assertCanAssignRole(currentUser: AuthenticatedUser, role: string) {
    if (role === 'OWNER') {
      throw new ForbiddenException('You cannot assign this role');
    }

    if (currentUser.role === 'OWNER') {
      return;
    }

    if (currentUser.role === 'ADMIN' && ['SUPERVISOR', 'OPERATOR'].includes(role)) {
      return;
    }

    throw new ForbiddenException('You cannot assign this role');
  }
}
