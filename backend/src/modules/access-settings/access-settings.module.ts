import { Module } from '@nestjs/common';
import { AccessSettingsController } from './access-settings.controller';
import { AccessSettingsService } from './access-settings.service';

@Module({
  controllers: [AccessSettingsController],
  providers: [AccessSettingsService],
  exports: [AccessSettingsService],
})
export class AccessSettingsModule {}
