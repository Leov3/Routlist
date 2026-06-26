import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AudioGenerationPreferencesController } from './audio-generation-preferences.controller';
import { AudioGenerationPreferencesService } from './audio-generation-preferences.service';

@Module({
  imports: [PrismaModule],
  controllers: [AudioGenerationPreferencesController],
  providers: [AudioGenerationPreferencesService],
  exports: [AudioGenerationPreferencesService],
})
export class AudioGenerationPreferencesModule {}
