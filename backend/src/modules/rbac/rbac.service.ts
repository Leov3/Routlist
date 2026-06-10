import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  roles() {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        permissions: {
          select: {
            permission: {
              select: { key: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  permissions() {
    return this.prisma.permission.findMany({
      select: { id: true, key: true, description: true },
      orderBy: { key: 'asc' },
    });
  }
}
