import { Module } from '@nestjs/common';
import { ElevenLabsModule } from '../integrations/elevenlabs/elevenlabs.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { AudioGenerationCleanupService } from './audio-generation.cleanup.service';
import { AudioGenerationController } from './audio-generation.controller';
import { AudioGenerationService } from './audio-generation.service';

@Module({
  imports: [PrismaModule, StorageModule, ElevenLabsModule],
  controllers: [AudioGenerationController],
  providers: [AudioGenerationService, AudioGenerationCleanupService],
  exports: [AudioGenerationService],
})
export class AudioGenerationModule {}

