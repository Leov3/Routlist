import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NarrativeRunsModule } from '../narrative-runs/narrative-runs.module';
import { NarrativesController } from './narratives.controller';
import { NarrativesService } from './narratives.service';

@Module({
  imports: [PrismaModule, NarrativeRunsModule],
  controllers: [NarrativesController],
  providers: [NarrativesService],
  exports: [NarrativesService],
})
export class NarrativesModule {}
