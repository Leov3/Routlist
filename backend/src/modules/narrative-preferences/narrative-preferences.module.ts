import { Module } from '@nestjs/common';
import { NarrativePreferencesController } from './narrative-preferences.controller';
import { NarrativePreferencesService } from './narrative-preferences.service';

@Module({
  controllers: [NarrativePreferencesController],
  providers: [NarrativePreferencesService],
})
export class NarrativePreferencesModule {}
