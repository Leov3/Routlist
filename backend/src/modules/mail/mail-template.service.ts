import { Injectable } from '@nestjs/common';
import { DEFAULT_MAIL_FROM_EMAIL, DEFAULT_MAIL_FROM_NAME, DEFAULT_MAIL_SUPPORT_EMAIL } from './mail.constants';
import type { MailRenderContext, MailTemplateType } from './mail.types';

type MailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type StoredMailTemplate = {
  subject: string;
  htmlBody: string;
  textBody: string | null;
  isActive: boolean;
};

@Injectable()
export class MailTemplateService {
  render(type: MailTemplateType, context: MailRenderContext): MailTemplate {
    const supportEmail = String(context.supportEmail ?? DEFAULT_MAIL_SUPPORT_EMAIL);
    const replyTo = String(context.replyTo ?? supportEmail);
    const appName = String(context.appName ?? DEFAULT_MAIL_FROM_NAME);
    const fromEmail = String(context.fromEmail ?? DEFAULT_MAIL_FROM_EMAIL);

    const template = (() => {
      switch (type) {
        case 'PASSWORD_RESET':
          return {
            subject: `${appName}: restablecer contraseña`,
            html: this.wrap(`
              <h1 style="margin:0 0 12px;font-size:22px;">Restablece tu contraseña</h1>
              <p style="margin:0 0 12px;">Recibimos una solicitud para cambiar tu contraseña en ${appName}.</p>
              <p style="margin:0 0 16px;"><a href="{{actionUrl}}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;">Restablecer contraseña</a></p>
              <p style="margin:0 0 8px;">Este enlace vence en {{expiresInMinutes}} minutos.</p>
              <p style="margin:0;color:#6b7280;">Si no pediste este cambio, puedes ignorar este correo.</p>
            `),
            text: [
              `${appName} - Restablecer contraseña`,
              '',
              'Recibimos una solicitud para cambiar tu contraseña.',
              'Abre este enlace: {{actionUrl}}',
              'Este enlace vence en {{expiresInMinutes}} minutos.',
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
            subject: `${appName}: invitación para {{organizationName}}`,
            html: this.wrap(`
              <h1 style="margin:0 0 12px;font-size:22px;">Te invitaron a ${appName}</h1>
              <p style="margin:0 0 12px;">{{inviterName}} te invitó a la organización {{organizationName}}.</p>
              <p style="margin:0 0 16px;"><a href="{{actionUrl}}" style="display:inline-block;background:#7c3aed;color:#ffffff;padding:12px 18px;border-radius:10px;text-decoration:none;">Aceptar invitación</a></p>
              <p style="margin:0 0 8px;">Esta invitación vence en {{expiresInHours}} horas.</p>
              <p style="margin:0;color:#6b7280;">Si no reconoces esta invitación, ignora este correo.</p>
            `),
            text: [
              `${appName} - Invitación`,
              '',
              '{{inviterName}} te invitó a la organización {{organizationName}}.',
              'Acepta aquí: {{actionUrl}}',
              'Esta invitación vence en {{expiresInHours}} horas.',
              '',
              `Si no reconoces esta invitación, ignora este correo o escribe a ${supportEmail}.`,
            ].join('\n'),
          };
        case 'APPROVAL':
          return {
            subject: `${appName}: acceso aprobado`,
            html: this.wrap(`
              <h1 style="margin:0 0 12px;font-size:22px;">Acceso aprobado</h1>
              <p style="margin:0 0 12px;">Tu acceso a {{organizationName}} fue aprobado.</p>
              <p style="margin:0;">Ya puedes iniciar sesión y usar la plataforma.</p>
            `),
            text: [`${appName} - Acceso aprobado`, '', 'Tu acceso a {{organizationName}} fue aprobado.', 'Ya puedes iniciar sesión y usar la plataforma.'].join('\n'),
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
              ${context.message ? `<p style="margin:0 0 12px;">${String(context.message)}</p>` : ''}
              <p style="margin:0;color:#6b7280;">Remitente actual: ${fromEmail}</p>
              <p style="margin:0;color:#6b7280;">Reply-to: ${replyTo}</p>
            `),
            text: [
              `${appName} - Prueba de correo`,
              '',
              'El sistema de correos está funcionando correctamente.',
              context.message ? String(context.message) : '',
              `Remitente actual: ${fromEmail}.`,
              `Reply-to: ${replyTo}.`,
            ].filter(Boolean).join('\n'),
          };
      }
    })();

    return {
      subject: this.interpolate(template.subject, context),
      html: this.interpolate(template.html, context),
      text: this.interpolate(template.text, context),
    };
  }

  renderCustom(input: { subject: string; html: string; text: string }, context: MailRenderContext): MailTemplate {
    return {
      subject: this.interpolate(input.subject, context),
      html: this.interpolate(input.html, context),
      text: this.interpolate(input.text, context),
    };
  }

  renderStored(input: StoredMailTemplate, context: MailRenderContext): MailTemplate {
    return {
      subject: this.interpolate(input.subject, context),
      html: this.interpolate(input.htmlBody, context),
      text: this.interpolate(input.textBody?.trim() ? input.textBody : this.htmlToPlainText(input.htmlBody), context),
    };
  }

  private wrap(inner: string) {
    return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${DEFAULT_MAIL_FROM_NAME}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f3ff;">
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827; padding: 24px;">
      <div style="max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 20px; padding: 28px;">
        ${inner}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0 12px;" />
        <p style="margin:0;color:#6b7280;font-size:12px;">Mensaje automático de ${DEFAULT_MAIL_FROM_NAME}. No respondas a este correo.</p>
      </div>
    </div>
  </body>
</html>`;
  }

  private htmlToPlainText(input: string) {
    return input
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<\/(p|div|h1|h2|h3|h4|h5|h6|li|tr|table)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\n\s+\n/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  private interpolate(input: string, context: MailRenderContext) {
    return input.replace(/{{\s*([a-zA-Z0-9_.-]+)\s*}}/g, (_, rawKey: string) => {
      const value = this.resolveContextValue(context, rawKey);
      return value ?? '';
    });
  }

  private resolveContextValue(context: MailRenderContext, key: string) {
    if (context[key] !== undefined && context[key] !== null) {
      return String(context[key]);
    }

    const camelKey = this.toCamelCase(key);
    if (camelKey !== key && context[camelKey] !== undefined && context[camelKey] !== null) {
      return String(context[camelKey]);
    }

    const snakeKey = this.toSnakeCase(key);
    if (snakeKey !== key && context[snakeKey] !== undefined && context[snakeKey] !== null) {
      return String(context[snakeKey]);
    }

    return null;
  }

  private toCamelCase(value: string) {
    return value.replace(/_([a-zA-Z0-9])/g, (_, char: string) => char.toUpperCase());
  }

  private toSnakeCase(value: string) {
    return value
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[-\s]+/g, '_')
      .toLowerCase();
  }
}
