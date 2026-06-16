import { SetMetadata } from '@nestjs/common';

export const ACCESS_MODULE_KEY = 'access_module_key';

export const AccessModule = (_moduleKey: string) => SetMetadata(ACCESS_MODULE_KEY, null);
