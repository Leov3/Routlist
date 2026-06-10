import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(loginDto);
    const cookieName = this.configService.getOrThrow<string>('auth.cookieName');

    res.cookie(cookieName, result.accessToken, {
      httpOnly: true,
      secure: this.configService.get<boolean>('auth.cookieSecure'),
      sameSite: 'lax',
      path: '/',
    });

    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response) {
    const cookieName = this.configService.getOrThrow<string>('auth.cookieName');
    res.clearCookie(cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @ApiCookieAuth('cookie')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  @Post('switch-organization')
  @HttpCode(200)
  @ApiCookieAuth('cookie')
  @UseGuards(JwtAuthGuard)
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string' },
      },
      required: ['organizationId'],
    },
  })
  async switchOrganization(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchOrganizationDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.switchOrganization(
      user,
      dto.organizationId,
    );
    const cookieName = this.configService.getOrThrow<string>('auth.cookieName');

    res.cookie(cookieName, result.accessToken, {
      httpOnly: true,
      secure: this.configService.get<boolean>('auth.cookieSecure'),
      sameSite: 'lax',
      path: '/',
    });

    return { user: result.user };
  }
}
