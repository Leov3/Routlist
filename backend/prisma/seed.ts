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
  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123*';
  const passwordHash = await bcrypt.hash(seedPassword, 12);

  const shouldReset =
    process.env.RESET_SEED_DATA === 'true' &&
    process.env.ALLOW_SEED_RESET === 'true';

  if (process.env.RESET_SEED_DATA === 'true' && !shouldReset) {
    console.warn(
      'RESET_SEED_DATA ignored because ALLOW_SEED_RESET is not enabled',
    );
  }

  if (shouldReset && process.env.NODE_ENV === 'production') {
    throw new Error(
      'RESET_SEED_DATA is disabled in production to protect existing data',
    );
  }

  if (shouldReset) {
    await prisma.$transaction([
      prisma.audioButtonFavorite.deleteMany({}),
      prisma.playbackEvent.deleteMany({}),
      prisma.audioButton.deleteMany({}),
      prisma.audioAsset.deleteMany({}),
      prisma.audioCategory.deleteMany({}),
      prisma.organizationMember.deleteMany({}),
      prisma.userBoardPreference.deleteMany({}),
      prisma.user.deleteMany({}),
      prisma.rolePermission.deleteMany({}),
      prisma.role.deleteMany({}),
      prisma.permission.deleteMany({}),
      prisma.organization.deleteMany({}),
    ]);
  }

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
  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'ADMIN' },
  });
  const supervisorRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'SUPERVISOR' },
  });
  const operatorRole = await prisma.role.findUniqueOrThrow({
    where: { name: 'OPERATOR' },
  });

  const seededUsers = [
    {
      email: 'admin@routlis.local',
      fullName: 'Routlis Owner',
      roleId: ownerRole.id,
    },
    {
      email: 'admin2@routlis.local',
      fullName: 'Routlis Admin',
      roleId: adminRole.id,
    },
    {
      email: 'supervisor@routlis.local',
      fullName: 'Routlis Supervisor',
      roleId: supervisorRole.id,
    },
    {
      email: 'operator@routlis.local',
      fullName: 'Routlis Operator',
      roleId: operatorRole.id,
    },
  ];

  for (const seedUser of seededUsers) {
    const user = await prisma.user.upsert({
      where: { email: seedUser.email },
      update: {
        fullName: seedUser.fullName,
        passwordHash,
        status: 'ACTIVE',
      },
      create: {
        email: seedUser.email,
        fullName: seedUser.fullName,
        passwordHash,
        status: 'ACTIVE',
      },
    });

    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: user.id,
        },
      },
      update: {
        roleId: seedUser.roleId,
        status: 'ACTIVE',
      },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roleId: seedUser.roleId,
        status: 'ACTIVE',
      },
    });
  }

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
  console.log(`Seed password: ${seedPassword}`);
  console.log(
    'Demo users: admin@routlis.local, admin2@routlis.local, supervisor@routlis.local, operator@routlis.local',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
