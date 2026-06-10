import { Module } from '@nestjs/common';
import { AudioButtonsController } from './audio-buttons.controller';
import { AudioButtonsService } from './audio-buttons.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [AudioButtonsController],
  providers: [AudioButtonsService],
})
export class AudioButtonsModule {}
