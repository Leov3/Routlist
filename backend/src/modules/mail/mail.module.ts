import { Global, Module } from '@nestjs/common';
import { MailController } from './mail.controller';
import { MailService } from './mail.service';
import { SmtpMailProvider } from './providers/smtp-mail.provider';
import { MailTemplateService } from './mail-template.service';
import { MailSettingsService } from './mail-settings.service';
import { MailAuditService } from './mail-audit.service';

@Global()
@Module({
  controllers: [MailController],
  providers: [
    MailService,
    SmtpMailProvider,
    MailTemplateService,
    MailSettingsService,
    MailAuditService,
  ],
  exports: [MailService, MailSettingsService],
})
export class MailModule {}
