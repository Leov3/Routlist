import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'fs';
import { AccessModule } from '../../common/decorators/access-module.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { UpdatePlatformBrandingDto } from './dto/update-platform-branding.dto';
import { PlatformBrandingService } from './platform-branding.service';

@ApiTags('platform-branding')
@ApiCookieAuth('cookie')
@Controller('platform-branding')
@AccessModule('admin.platform')
@UseGuards(JwtAuthGuard)
export class PlatformBrandingController {
  constructor(private readonly service: PlatformBrandingService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser) {
    return this.service.get(user);
  }

  @Get('public')
  publicGet() {
    return this.service.publicGet();
  }

  @Patch()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        platformName: { type: 'string' },
        tagline: { type: 'string' },
        primaryColor: { type: 'string' },
        secondaryColor: { type: 'string' },
        logo: { type: 'string', format: 'binary' },
        favicon: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'favicon', maxCount: 1 },
    ]),
  )
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePlatformBrandingDto,
    @UploadedFiles()
    files: {
      logo?: Express.Multer.File[];
      favicon?: Express.Multer.File[];
    },
  ) {
    return this.service.update(user, dto, files);
  }

  @Get('logo')
  async logo(@Res() res: Response) {
    const asset = await this.service.getLogoAsset();
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${asset.fileName}"`);
    createReadStream(asset.path).pipe(res);
  }

  @Get('favicon')
  async favicon(@Res() res: Response) {
    const asset = await this.service.getFaviconAsset();
    res.setHeader('Content-Type', asset.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${asset.fileName}"`);
    createReadStream(asset.path).pipe(res);
  }
}
