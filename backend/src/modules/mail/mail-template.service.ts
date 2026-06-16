import { Injectable } from '@nestjs/common';
import { DEFAULT_MAIL_FROM_EMAIL, DEFAULT_MAIL_FROM_NAME, DEFAULT_MAIL_SUPPORT_EMAIL } from './mail.constants';
import type { MailRenderContext, MailTemplateType } from './mail.types';

type MailTemplate = {
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class MailTemplateService {
  render(type: MailTemplateType, context: MailRenderContext): MailTemplate {
    const supportEmail = String(context.supportEmail ?? DEFAULT_MAIL_SUPPORT_EMAIL);
    const replyTo = String(context.replyTo ?? supportEmail);
    const appName = String(context.appName ?? DEFAULT_MAIL_FROM_NAME);
    const fromEmail = String(context.fromEmail ?? DEFAULT_MAIL_FROM_EMAIL);
    switch (type) {
      case 'PASSWORD_RESET':
        return {
          subject: `${appName}: restablecer contraseña`,
          html: this.wrap(`
            <h1 style="margin:0 0 12px;font-size:22px;">Restablece tu contraseña</h1>
            <p style="margin:0 0 12px;">Recibimos una solicitud para cambiar tu contraseña en ${appName}.</p>
            <p style="margin:0 0 16px;"><a href="${context.actionUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;">Restablecer contraseña</a></p>
            <p style="margin:0 0 8px;">Este enlace vence en ${context.expiresInMinutes ?? 30} minutos.</p>
            <p style="margin:0;color:#6b7280;">Si no pediste este cambio, puedes ignorar este correo.</p>
          `),
          text: [
            `${appName} - Restablecer contraseña`,
            '',
            'Recibimos una solicitud para cambiar tu contraseña.',
            `Abre este enlace: ${context.actionUrl}`,
            `Este enlace vence en ${context.expiresInMinutes ?? 30} minutos.`,
            '',
            `Si no pediste este cambio, ignora este correo o escribe a ${supportEmail}.`,
          ].join('\n'),
        };
      case 'PASSWORD_CHANGED':
        return {
          subject: `${appName}: contraseña actualizada`,
          html: this.wrap(`
            <h1 style="margin:0 0 12px;font-size:22px;">Contraseña actualizada</h1>
            <p style="margin:0 0 12px;">Tu contraseña fue cambiada correctamente en ${appName}.</p>
            <p style="margin:0;color:#6b7280;">Si no fuiste tú, contacta soporte de inmediato.</p>
          `),
          text: [`${appName} - Contraseña actualizada`, '', 'Tu contraseña fue cambiada correctamente.', `Si no fuiste tú, contacta soporte: ${supportEmail}.`].join('\n'),
        };
      case 'INVITE':
        return {
          subject: `${appName}: invitación para ${String(context.organizationName ?? 'tu organización')}`,
          html: this.wrap(`
            <h1 style="margin:0 0 12px;font-size:22px;">Te invitaron a ${appName}</h1>
            <p style="margin:0 0 12px;">${context.inviterName ?? 'Un administrador'} te invitó a la organización ${context.organizationName ?? ''}.</p>
            <p style="margin:0 0 16px;"><a href="${context.actionUrl}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;">Aceptar invitación</a></p>
            <p style="margin:0 0 8px;">Esta invitación vence en ${context.expiresInHours ?? 72} horas.</p>
            <p style="margin:0;color:#6b7280;">Si no reconoces esta invitación, ignora este correo.</p>
          `),
          text: [
            `${appName} - Invitación`,
            '',
            `${context.inviterName ?? 'Un administrador'} te invitó a la organización ${context.organizationName ?? ''}.`,
            `Acepta aquí: ${context.actionUrl}`,
            `Esta invitación vence en ${context.expiresInHours ?? 72} horas.`,
            '',
            `Si no reconoces esta invitación, ignora este correo o escribe a ${supportEmail}.`,
          ].join('\n'),
        };
      case 'APPROVAL':
        return {
          subject: `${appName}: acceso aprobado`,
          html: this.wrap(`
            <h1 style="margin:0 0 12px;font-size:22px;">Acceso aprobado</h1>
            <p style="margin:0 0 12px;">Tu acceso a ${context.organizationName ?? 'la organización'} fue aprobado.</p>
            <p style="margin:0;">Ya puedes iniciar sesión y usar la plataforma.</p>
          `),
          text: [`${appName} - Acceso aprobado`, '', `Tu acceso a ${context.organizationName ?? 'la organización'} fue aprobado.`, 'Ya puedes iniciar sesión y usar la plataforma.'].join('\n'),
        };
      case 'WELCOME':
        return {
          subject: `Bienvenido a ${appName}`,
          html: this.wrap(`
            <h1 style="margin:0 0 12px;font-size:22px;">Bienvenido a ${appName}</h1>
            <p style="margin:0 0 12px;">Tu cuenta ya está lista para usar.</p>
            <p style="margin:0;color:#6b7280;">Ingresa y completa tu perfil si hace falta.</p>
          `),
          text: [`Bienvenido a ${appName}.`, '', 'Tu cuenta ya está lista para usar.', 'Ingresa y completa tu perfil si hace falta.'].join('\n'),
        };
      case 'TEST':
      default:
        return {
          subject: `${appName}: prueba de correo`,
          html: this.wrap(`
            <h1 style="margin:0 0 12px;font-size:22px;">Correo de prueba</h1>
            <p style="margin:0 0 12px;">El sistema de correos está funcionando correctamente.</p>
            <p style="margin:0;color:#6b7280;">Remitente actual: ${fromEmail}</p>
            <p style="margin:0;color:#6b7280;">Reply-to: ${replyTo}</p>
          `),
          text: [`${appName} - Prueba de correo`, '', 'El sistema de correos está funcionando correctamente.', `Remitente actual: ${fromEmail}.`, `Reply-to: ${replyTo}.`].join('\n'),
        };
    }
  }

  private wrap(inner: string) {
    return `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; padding: 8px;">
        ${inner}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 12px;" />
        <p style="margin:0;color:#6b7280;font-size:12px;">Mensaje automático de ${DEFAULT_MAIL_FROM_NAME}. No respondas a este correo.</p>
      </div>
    `;
  }
}
