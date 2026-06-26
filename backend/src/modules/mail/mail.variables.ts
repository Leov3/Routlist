export type MailVariableDefinition = {
  key: string;
  description: string;
  scope: string;
  important?: boolean;
};

export type MailVariableGroup = {
  group: string;
  description: string;
  variables: MailVariableDefinition[];
};

export const MAIL_VARIABLE_CATALOG: MailVariableGroup[] = [
  {
    group: 'Globales',
    description: 'Variables reutilizables en casi cualquier correo del sistema.',
    variables: [
      { key: '{{user_name}}', description: 'Nombre del destinatario o usuario.', scope: 'Bienvenida, reset, cambio, invitación, aprobación, prueba', important: true },
      { key: '{{organization_name}}', description: 'Nombre visible de la organización.', scope: 'Bienvenida, invitación, aprobación', important: true },
      { key: '{{organizationName}}', description: 'Nombre visible de la organización en camelCase.', scope: 'Bienvenida, invitación, aprobación', important: true },
      { key: '{{inviteeName}}', description: 'Nombre de la persona invitada.', scope: 'Invitación', important: true },
      { key: '{{platform_name}}', description: 'Nombre de la plataforma o marca.', scope: 'Bienvenida, prueba y correos genéricos' },
      { key: '{{from_email}}', description: 'Correo remitente visible en pruebas.', scope: 'Prueba' },
      { key: '{{reply_to}}', description: 'Dirección de respuesta para el destinatario.', scope: 'Prueba' },
      { key: '{{login_url}}', description: 'Enlace de acceso a la plataforma.', scope: 'Acceso, recordatorios y onboarding', important: true },
      { key: '{{reset_url}}', description: 'Enlace de recuperación de contraseña.', scope: 'Recuperación de contraseña', important: true },
    ],
  },
  {
    group: 'Invitación',
    description: 'Etiquetas para invitaciones con token y contexto de acceso.',
    variables: [
      { key: '{{invite_url}}', description: 'Enlace completo para aceptar la invitación.', scope: 'Invitación', important: true },
      { key: '{{invite_code}}', description: 'Código o token de invitación.', scope: 'Invitación', important: true },
      { key: '{{inviterName}}', description: 'Nombre de quien envía la invitación.', scope: 'Invitación', important: true },
      { key: '{{expiresInHours}}', description: 'Horas de vigencia de la invitación.', scope: 'Invitación' },
    ],
  },
  {
    group: 'Operativas',
    description: 'Variables para alertas y notificaciones de sistema.',
    variables: [
      { key: '{{audio_title}}', description: 'Título del audio o proceso asociado.', scope: 'Audio procesado, narrativa lista, error de audio' },
      { key: '{{license_expiration}}', description: 'Texto o fecha de vencimiento de licencia.', scope: 'Licencia próxima a vencer' },
      { key: '{{storage_used}}', description: 'Porcentaje o monto de almacenamiento usado.', scope: 'Alerta por almacenamiento alto' },
      { key: '{{expiresInMinutes}}', description: 'Minutos de vigencia del enlace de recuperación.', scope: 'Recuperación de contraseña' },
      { key: '{{message}}', description: 'Mensaje libre usado en pruebas y correos genéricos.', scope: 'Prueba' },
    ],
  },
];
