import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import type { PrismaClient } from '@big-eye/core/db/prisma-client';

import { PRISMA } from '../db/database.module.js';

import { JWT_VERIFIER } from './auth.tokens.js';
import type { JwtVerifierPort, RequestWithUser } from './auth.types.js';
import { IS_PUBLIC_KEY } from './public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JWT_VERIFIER) private readonly jwtVerifier: JwtVerifierPort,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;
    const match = typeof authorization === 'string' ? /^Bearer\s+(.+)$/i.exec(authorization) : null;

    if (!match) {
      throw new UnauthorizedException();
    }

    let claims;

    try {
      claims = await this.jwtVerifier.verify(match[1]);
    } catch {
      throw new UnauthorizedException();
    }

    const profile = await this.prisma.profile.findUnique({
      where: { id: claims.sub },
      select: { id: true, email: true, role: true, status: true },
    });

    request.user = profile
      ? {
          id: profile.id,
          email: profile.email,
          role: profile.role,
          status: profile.status,
        }
      : {
          id: claims.sub,
          email: claims.email,
          role: null,
          status: null,
        };

    return true;
  }
}
