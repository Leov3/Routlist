import { Module } from '@nestjs/common';
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
import { NarrativesModule } from './modules/narratives/narratives.module';
import { NarrativeRunsModule } from './modules/narrative-runs/narrative-runs.module';

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
    NarrativesModule,
    NarrativeRunsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
