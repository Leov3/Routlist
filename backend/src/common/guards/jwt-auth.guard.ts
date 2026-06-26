import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

type JwtRequest = {
  cookies?: Record<string, unknown>;
  headers: { authorization?: string };
};

type HttpSwitch = {
  getRequest: () => JwtRequest;
};

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  getRequest(context: ExecutionContext) {
    const request = (context.switchToHttp() as HttpSwitch).getRequest();
    const cookieName = this.configService.get<string>('auth.cookieName');
    const cookies = request.cookies ?? {};
    const cookieValue =
      cookieName && Object.hasOwn(cookies, cookieName)
        ? cookies[cookieName]
        : undefined;
    const token = typeof cookieValue === 'string' ? cookieValue : undefined;

    if (token && !request.headers.authorization) {
      request.headers.authorization = `Bearer ${token}`;
    }

    return request;
  }
}
