import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { UsersModule } from './modules/users/users.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { StorageModule } from './modules/storage/storage.module';
import { AudioLibraryModule } from './modules/audio-library/audio-library.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { AudioButtonsModule } from './modules/audio-buttons/audio-buttons.module';
import { PlaybackModule } from './modules/playback/playback.module';
import { AuditModule } from './modules/audit/audit.module';
import { BoardPreferencesModule } from './modules/board-preferences/board-preferences.module';
import { AudioGenerationPreferencesModule } from './modules/audio-generation-preferences/audio-generation-preferences.module';
import { NarrativePreferencesModule } from './modules/narrative-preferences/narrative-preferences.module';
import { ElevenLabsModule } from './modules/integrations/elevenlabs/elevenlabs.module';
import { AudioGenerationModule } from './modules/audio-generation/audio-generation.module';
import { NarrativesModule } from './modules/narratives/narratives.module';
import { NarrativeRunsModule } from './modules/narrative-runs/narrative-runs.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { PlatformBrandingModule } from './modules/platform-branding/platform-branding.module';
import { AccessSettingsModule } from './modules/access-settings/access-settings.module';
import { MailModule } from './modules/mail/mail.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    UsersModule,
    RbacModule,
    StorageModule,
    AudioLibraryModule,
    CategoriesModule,
    AudioButtonsModule,
    PlaybackModule,
    AuditModule,
    BoardPreferencesModule,
    AudioGenerationPreferencesModule,
    NarrativePreferencesModule,
    ElevenLabsModule,
    AudioGenerationModule,
    NarrativesModule,
    NarrativeRunsModule,
    MaintenanceModule,
    PlatformBrandingModule,
    AccessSettingsModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
