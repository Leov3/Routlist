import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { PlatformBrandingController } from './platform-branding.controller';
import { PlatformBrandingService } from './platform-branding.service';

@Module({
  imports: [PrismaModule],
  controllers: [PlatformBrandingController],
  providers: [PlatformBrandingService],
  exports: [PlatformBrandingService],
})
export class PlatformBrandingModule {}
