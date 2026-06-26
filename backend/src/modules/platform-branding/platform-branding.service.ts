import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { mkdir, rm, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { ALLOWED_IMAGE_MIME_TYPES } from '../storage/storage.types';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { UpdatePlatformBrandingDto } from './dto/update-platform-branding.dto';

const BRANDING_ID = 'global';

type BrandingAsset = { path: string; mimeType: string; fileName: string };

@Injectable()
export class PlatformBrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async get(user: AuthenticatedUser) {
    this.ensureOwner(user);
    return this.serialize(await this.ensureBrandingRecord());
  }

  async publicGet() {
    return this.serialize(await this.ensureBrandingRecord());
  }

  async update(
    user: AuthenticatedUser,
    dto: UpdatePlatformBrandingDto,
    files: { logo?: Express.Multer.File[]; favicon?: Express.Multer.File[] },
  ) {
    this.ensureOwner(user);
    const current = await this.ensureBrandingRecord();
    const next = {
      platformName: dto.platformName?.trim() || current.platformName,
      tagline: dto.tagline?.trim() || null,
      primaryColor: dto.primaryColor?.trim() || null,
      secondaryColor: dto.secondaryColor?.trim() || null,
    };

    const storageDir = this.brandingDir();
    await mkdir(storageDir, { recursive: true });

    const logoFile = files.logo?.[0];
    const faviconFile = files.favicon?.[0];

    const logo = logoFile ? await this.saveAsset(storageDir, 'logo', logoFile) : null;
    const favicon = faviconFile ? await this.saveAsset(storageDir, 'favicon', faviconFile) : null;

    const updated = await this.prisma.platformBrandingSetting.upsert({
      where: { id: BRANDING_ID },
      create: {
        id: BRANDING_ID,
        ...next,
        ...(logo
          ? {
              logoFileName: logo.fileName,
              logoMimeType: logo.mimeType,
              logoStorageKey: logo.storageKey,
            }
          : {}),
        ...(favicon
          ? {
              faviconFileName: favicon.fileName,
              faviconMimeType: favicon.mimeType,
              faviconStorageKey: favicon.storageKey,
            }
          : {}),
        updatedById: user.id,
      },
      update: {
        ...next,
        ...(logo
          ? {
              logoFileName: logo.fileName,
              logoMimeType: logo.mimeType,
              logoStorageKey: logo.storageKey,
            }
          : {}),
        ...(favicon
          ? {
              faviconFileName: favicon.fileName,
              faviconMimeType: favicon.mimeType,
              faviconStorageKey: favicon.storageKey,
            }
          : {}),
        updatedById: user.id,
      },
    });

    if (logo && current.logoStorageKey && current.logoStorageKey !== logo.storageKey) {
      await this.removeAsset(current.logoStorageKey);
    }
    if (favicon && current.faviconStorageKey && current.faviconStorageKey !== favicon.storageKey) {
      await this.removeAsset(current.faviconStorageKey);
    }

    return this.serialize(updated);
  }

  async getLogoAsset(): Promise<BrandingAsset> {
    const branding = await this.ensureBrandingRecord();
    if (branding.logoStorageKey) {
      return this.assetFromKey(branding.logoStorageKey, branding.logoFileName ?? 'logo');
    }
    throw new NotFoundException('Logo not configured');
  }

  async getFaviconAsset(): Promise<BrandingAsset> {
    const branding = await this.ensureBrandingRecord();
    if (branding.faviconStorageKey) {
      return this.assetFromKey(branding.faviconStorageKey, branding.faviconFileName ?? 'favicon.ico');
    }
    throw new NotFoundException('Favicon not configured');
  }

  private ensureOwner(user: AuthenticatedUser) {
    if (user.role !== 'OWNER') throw new ForbiddenException('Only OWNER can manage platform branding');
  }

  private async ensureBrandingRecord() {
    return this.prisma.platformBrandingSetting.upsert({
      where: { id: BRANDING_ID },
      create: { id: BRANDING_ID, platformName: 'Routlis' },
      update: {},
    });
  }

  private serialize(branding: Prisma.PlatformBrandingSettingGetPayload<Record<string, never>>) {
    return {
      id: branding.id,
      platformName: branding.platformName,
      tagline: branding.tagline,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      logoUrl: branding.logoStorageKey ? '/platform-branding/logo' : null,
      faviconUrl: branding.faviconStorageKey ? '/platform-branding/favicon' : null,
      updatedAt: branding.updatedAt,
      createdAt: branding.createdAt,
    };
  }

  private brandingDir() {
    return join(this.configService.get<string>('storage.localStoragePath') ?? '/var/www/routlis/storage', 'branding');
  }

  private async saveAsset(root: string, kind: 'logo' | 'favicon', file: Express.Multer.File) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as never) && file.mimetype !== 'image/x-icon' && file.mimetype !== 'image/vnd.microsoft.icon') {
      throw new NotFoundException(`Unsupported ${kind} format`);
    }

    const extension = kind === 'favicon' && file.originalname.toLowerCase().endsWith('.ico') ? '.ico' : extname(file.originalname) || (kind === 'favicon' ? '.ico' : '.png');
    const fileName = `${kind}${extension}`;
    const storageKey = `branding/${fileName}`;
    const path = join(root, fileName);
    await writeFile(path, file.buffer);
    return { path, fileName, storageKey, mimeType: file.mimetype };
  }

  private async removeAsset(storageKey: string) {
    const root = this.brandingDir();
    const path = join(root, storageKey.replace(/^branding\//, ''));
    await rm(path, { force: true }).catch(() => undefined);
  }

  private async assetFromKey(storageKey: string, fileName: string): Promise<BrandingAsset> {
    const root = this.brandingDir();
    const path = join(root, storageKey.replace(/^branding\//, ''));
    await stat(path);
    const mimeType = fileName.endsWith('.ico')
      ? 'image/x-icon'
      : 'image/png';
    return { path, fileName, mimeType };
  }
}
