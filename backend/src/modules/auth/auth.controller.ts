import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBody, ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../../shared/types/authenticated-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { MailService } from '../mail/mail.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto, {
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
    });
    const cookieName = this.configService.getOrThrow<string>('auth.cookieName');
    const secure = this.configService.get<boolean>('auth.cookieSecure');

    res.cookie(cookieName, result.accessToken, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/',
    });

    return { user: result.user };
  }

  @Post('logout')
  @HttpCode(200)
  @ApiCookieAuth('cookie')
  @UseGuards(JwtAuthGuard)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user);
    const cookieName = this.configService.getOrThrow<string>('auth.cookieName');
    res.clearCookie(cookieName, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  @ApiCookieAuth('cookie')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.touchSession(user.sessionId);
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
    const secure = this.configService.get<boolean>('auth.cookieSecure');

    res.cookie(cookieName, result.accessToken, {
      httpOnly: true,
      secure,
      sameSite: secure ? 'none' : 'lax',
      path: '/',
    });

    return { user: result.user };
  }

  @Post('forgot-password')
  @HttpCode(200)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() req: Request,
  ) {
    await this.mailService.requestPasswordReset(dto.email, {
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
      ipAddress: typeof req.ip === 'string' ? req.ip : undefined,
    });
    return { ok: true };
  }

  @Post('reset-password')
  @HttpCode(200)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.mailService.resetPassword(dto.token, dto.newPassword);
    return { ok: true };
  }

  @Post('change-password')
  @HttpCode(200)
  @ApiCookieAuth('cookie')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.mailService.changePassword(user, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @Post('accept-invite')
  @HttpCode(200)
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    await this.mailService.acceptInvite(dto);
    return { ok: true };
  }
}
