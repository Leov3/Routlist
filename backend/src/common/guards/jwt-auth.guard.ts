import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getRequest(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const cookieName = this.configService.get<string>('auth.cookieName');
    const token = cookieName ? request.cookies?.[cookieName] : undefined;

    if (token && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${token}`;
    }

    return request;
  }
}
