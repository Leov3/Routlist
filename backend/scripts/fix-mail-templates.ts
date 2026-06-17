import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://routlis:routlis@localhost:5432/routlis?schema=public';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const templates = [
  {
    key: 'WELCOME',
    name: 'Bienvenida',
    description: 'Plantilla para usuarios nuevos.',
    subject: 'Bienvenido a Routlis',
    htmlBody: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><h1>Bienvenido a Routlis</h1><p>Hola, {{user_name}}.</p><p>Tu cuenta en {{platform_name}} ya está lista.</p></body></html>`,
    textBody: 'Bienvenido a Routlis.\n\nHola, {{user_name}}.\nTu cuenta en {{platform_name}} ya está lista.',
    isActive: true,
  },
  {
    key: 'INVITE',
    name: 'Invitación a organización',
    description: 'Correo de invitación a organizaciones.',
    subject: 'Te invitaron a {{organization_name}}',
    htmlBody: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><h1>Te invitaron a {{organization_name}}</h1><p>Hola, {{inviteeName}}.</p><p>{{inviterName}} te invitó a unirte.</p><p><a href="{{inviteUrl}}">Aceptar invitación</a></p><p>Si el botón no funciona, copia y pega este enlace: <a href="{{inviteUrl}}">{{inviteUrl}}</a></p><p>El código es {{inviteCode}}.</p></body></html>`,
    textBody: 'Hola, {{inviteeName}}.\n{{inviterName}} te invitó a {{organization_name}}.\nAcepta aquí: {{inviteUrl}}\nCódigo: {{inviteCode}}',
    isActive: true,
  },
  {
    key: 'PASSWORD_RESET',
    name: 'Recuperación de contraseña',
    description: 'Correo para restablecer contraseña.',
    subject: 'Restablece tu contraseña',
    htmlBody: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><h1>Restablece tu contraseña</h1><p>Hola, {{user_name}}.</p><p><a href="{{resetUrl}}">Restablecer contraseña</a></p><p>Si el botón no funciona, copia y pega este enlace: <a href="{{resetUrl}}">{{resetUrl}}</a></p><p>Este enlace vence en {{expiresInMinutes}} minutos.</p></body></html>`,
    textBody: 'Hola, {{user_name}}.\nAbre este enlace: {{resetUrl}}\nEste enlace vence en {{expiresInMinutes}} minutos.',
    isActive: true,
  },
  {
    key: 'PASSWORD_CHANGED',
    name: 'Cambio de contraseña',
    description: 'Notificación de cambio de contraseña.',
    subject: 'Tu contraseña fue actualizada',
    htmlBody: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><h1>Contraseña actualizada</h1><p>Hola, {{user_name}}.</p><p>Tu contraseña fue cambiada correctamente.</p></body></html>`,
    textBody: 'Hola, {{user_name}}.\nTu contraseña fue cambiada correctamente.',
    isActive: true,
  },
  {
    key: 'APPROVAL',
    name: 'Aprobación de acceso',
    description: 'Notificación de acceso aprobado.',
    subject: 'Acceso aprobado',
    htmlBody: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><h1>Acceso aprobado</h1><p>Tu acceso a {{organization_name}} fue aprobado.</p></body></html>`,
    textBody: 'Tu acceso a {{organization_name}} fue aprobado.',
    isActive: true,
  },
  {
    key: 'TEST',
    name: 'Prueba de correo',
    description: 'Correo de prueba desde el panel.',
    subject: 'Prueba de correo Routlis',
    htmlBody: `<!doctype html><html lang="es"><head><meta charset="utf-8"></head><body><h1>Correo de prueba</h1><p>El sistema de correos está funcionando correctamente.</p><p>{{message}}</p><p>Remitente actual: {{fromEmail}}</p><p>Reply-to: {{replyTo}}</p></body></html>`,
    textBody: 'El sistema de correos está funcionando correctamente.\n{{message}}\nRemitente actual: {{fromEmail}}\nReply-to: {{replyTo}}',
    isActive: true,
  },
] as const;

async function main() {
  for (const template of templates) {
    await prisma.mailTemplate.upsert({
      where: { key: template.key },
      update: {
        name: template.name,
        description: template.description,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        isActive: template.isActive,
      },
      create: {
        key: template.key,
        name: template.name,
        description: template.description,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
        isActive: template.isActive,
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
