import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AudioGenerationService } from './audio-generation.service';

@Injectable()
export class AudioGenerationCleanupService implements OnModuleInit, OnModuleDestroy {
  private interval: NodeJS.Timeout | null = null;

  constructor(private readonly audioGenerationService: AudioGenerationService) {}

  onModuleInit() {
    void this.audioGenerationService.cleanupExpiredTemporaryAssets();
    this.interval = setInterval(() => {
      void this.audioGenerationService.cleanupExpiredTemporaryAssets();
    }, 60 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

