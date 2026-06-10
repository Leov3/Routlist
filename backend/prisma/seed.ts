import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import {
  PERMISSIONS,
  ROLE_NAMES,
  ROLE_PERMISSIONS,
  RoleName,
} from '../src/shared/constants/rbac.constants';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: 'demo-organization' },
    update: { name: 'Routlis Demo Organization', status: 'ACTIVE' },
    create: {
      id: 'demo-organization',
      name: 'Routlis Demo Organization',
      status: 'ACTIVE',
    },
  });

  await prisma.organization.upsert({
    where: { id: 'demo-organization-2' },
    update: { name: 'Routlis Sandbox Organization', status: 'ACTIVE' },
    create: {
      id: 'demo-organization-2',
      name: 'Routlis Sandbox Organization',
      status: 'ACTIVE',
    },
  });

  for (const key of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key },
    });
  }

  for (const roleName of ROLE_NAMES) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: {
        name: roleName,
        description: `${roleName} role`,
      },
    });

    for (const permissionKey of ROLE_PERMISSIONS[roleName as RoleName]) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const ownerRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'OWNER' },
  });
  const passwordHash = await bcrypt.hash(
    process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*',
    12,
  );

  const admin = await prisma.user.upsert({
    where: { email: 'admin@routlis.local' },
    update: {
      fullName: 'Routlis Owner',
      passwordHash,
      status: 'ACTIVE',
    },
    create: {
      email: 'admin@routlis.local',
      fullName: 'Routlis Owner',
      passwordHash,
      status: 'ACTIVE',
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: admin.id,
      },
    },
    update: {
      roleId: ownerRole.id,
      status: 'ACTIVE',
    },
    create: {
      organizationId: organization.id,
      userId: admin.id,
      roleId: ownerRole.id,
      status: 'ACTIVE',
    },
  });

  const categories = ['Saludos', 'Validación', 'Información', 'Objeciones', 'Cierre'];

  for (const [index, name] of categories.entries()) {
    const existing = await prisma.audioCategory.findFirst({
      where: { organizationId: organization.id, name },
    });

    if (existing) {
      await prisma.audioCategory.update({
        where: { id: existing.id },
        data: { sortOrder: index, isActive: true },
      });
      continue;
    }

    await prisma.audioCategory.create({
      data: {
        organizationId: organization.id,
        name,
        sortOrder: index,
      },
    });
  }

  console.log('Seed completed');
  console.log('Admin email: admin@routlis.local');
  console.log('Admin password: Admin123*');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
