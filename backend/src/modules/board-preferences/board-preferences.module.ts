import { Module } from '@nestjs/common';
import { BoardPreferencesController } from './board-preferences.controller';
import { BoardPreferencesService } from './board-preferences.service';

@Module({
  controllers: [BoardPreferencesController],
  providers: [BoardPreferencesService],
})
export class BoardPreferencesModule {}
