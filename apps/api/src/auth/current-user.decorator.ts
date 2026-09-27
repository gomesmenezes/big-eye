import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import type { ApiUser, RequestWithUser } from './auth.types.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ApiUser => {
    const request = context.switchToHttp().getRequest<RequestWithUser>();

    if (!request.user) {
      throw new Error('CurrentUser decorator used without an authenticated request.');
    }

    return request.user;
  },
);
