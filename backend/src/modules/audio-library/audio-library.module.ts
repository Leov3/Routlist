import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { AudioLibraryController } from './audio-library.controller';
import { AudioLibraryService } from './audio-library.service';

@Module({
  imports: [StorageModule],
  controllers: [AudioLibraryController],
  providers: [AudioLibraryService],
})
export class AudioLibraryModule {}
