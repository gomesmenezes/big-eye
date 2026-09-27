import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { env } from '../config/env.js';
import { DatabaseModule } from '../db/database.module.js';

import { AuthGuard } from './auth.guard.js';
import { JWT_VERIFIER } from './auth.tokens.js';
import { JwtVerifier } from './jwt-verifier.js';
import { AdminGuard, SuspendedGuard } from './roles.guard.js';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: JWT_VERIFIER,
      useFactory: () => new JwtVerifier(env.SUPABASE_JWKS_URL),
    },
    AuthGuard,
    AdminGuard,
    SuspendedGuard,
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_GUARD, useExisting: SuspendedGuard },
  ],
  exports: [AdminGuard, AuthGuard, SuspendedGuard],
})
export class AuthModule {}
