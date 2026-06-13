import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NarrativeRunsController } from './narrative-runs.controller';
import { NarrativeRunsService } from './narrative-runs.service';

@Module({
  imports: [PrismaModule],
  controllers: [NarrativeRunsController],
  providers: [NarrativeRunsService],
  exports: [NarrativeRunsService],
})
export class NarrativeRunsModule {}
