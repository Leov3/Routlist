import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(user: AuthenticatedUser) {
    this.ensureGlobalOwner(user);

    return this.prisma.organization.findMany({
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            members: true,
            audioAssets: true,
            audioCategories: true,
            audioButtons: true,
          },
        },
      },
    });
  }

  current(user: AuthenticatedUser) {
    return this.prisma.organization.findFirstOrThrow({
      where: {
        id: user.organizationId,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  create(user: AuthenticatedUser, dto: CreateOrganizationDto) {
    this.ensureGlobalOwner(user);

    return this.prisma.organization.create({
      data: {
        name: dto.name,
        status: dto.status ?? 'ACTIVE',
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateOrganizationDto) {
    this.ensureGlobalOwner(user);

    const organization = await this.prisma.organization.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name } : {}),
        ...(dto.status ? { status: dto.status } : {}),
      },
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  private ensureGlobalOwner(user: AuthenticatedUser) {
    if (user.role !== 'OWNER') {
      throw new ForbiddenException('Only OWNER can manage organizations');
    }
  }
}
