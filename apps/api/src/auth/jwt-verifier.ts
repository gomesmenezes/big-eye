import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

import type { JwtClaims, JwtVerifierPort } from './auth.types.js';

const userIdSchema = z.string().uuid();

@Injectable()
export class JwtVerifier implements JwtVerifierPort {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(jwksUrl: string) {
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));
  }

  async verify(token: string): Promise<JwtClaims> {
    const { payload } = await jwtVerify(token, this.jwks, {
      audience: 'authenticated',
    });

    if (typeof payload.exp !== 'number') {
      throw new Error('The access token has no expiration claim.');
    }

    const sub = userIdSchema.parse(payload.sub);

    return {
      sub,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
  }
}
