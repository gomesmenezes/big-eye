import { createServer, type Server } from 'node:http';

import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '@big-eye/core/db/prisma-client';

import { AppModule } from '../app.module.js';
import { configureApiApp } from '../app.setup.js';
import { JWT_VERIFIER } from '../auth/auth.tokens.js';
import { JwtVerifier } from '../auth/jwt-verifier.js';
import { PRISMA } from '../db/database.module.js';

const userId = 'f4b9f6a7-43b9-4b4d-8aa1-48793273cb93';
const privateKeyId = 'local-jwks-test-key';
const profile = {
  id: userId,
  email: 'person@example.com',
  name: 'Pessoa de teste',
  role: 'user',
  status: 'active',
  wallet: { balance: 12 },
};

describe('GET /me', () => {
  let app: NestFastifyApplication;
  let server: Server;
  let jwksUrl: string;
  let signToken: (expiration: string) => Promise<string>;
  let signNonExpiringToken: () => Promise<string>;

  const prisma = {
    profile: { findUnique: vi.fn(), upsert: vi.fn() },
    $disconnect: vi.fn().mockResolvedValue(undefined),
  } as unknown as PrismaClient;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048 });
    const publicJwk = await exportJWK(publicKey);
    Object.assign(publicJwk, { alg: 'RS256', use: 'sig', kid: privateKeyId });

    server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ keys: [publicJwk] }));
    });
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('The local JWKS server did not bind to a TCP port.');
    }

    jwksUrl = `http://127.0.0.1:${address.port}/.well-known/jwks.json`;
    signToken = async (expiration) =>
      new SignJWT({ email: profile.email })
        .setProtectedHeader({ alg: 'RS256', kid: privateKeyId })
        .setSubject(userId)
        .setAudience('authenticated')
        .setExpirationTime(expiration)
        .sign(privateKey);
    signNonExpiringToken = () =>
      new SignJWT({ email: profile.email })
        .setProtectedHeader({ alg: 'RS256', kid: privateKeyId })
        .setSubject(userId)
        .setAudience('authenticated')
        .sign(privateKey);

    vi.mocked(prisma.profile.findUnique).mockResolvedValue(profile as never);

    const testingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRISMA)
      .useValue(prisma)
      .overrideProvider(JWT_VERIFIER)
      .useValue(new JwtVerifier(jwksUrl))
      .compile();

    app = testingModule.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await configureApiApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    if (server?.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });

  async function getMe(token?: string) {
    return app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/me',
      headers: token ? { authorization: `Bearer ${token}` } : {},
    });
  }

  it('returns profile and wallet balance after verifying a JWT through local JWKS', async () => {
    const response = await getMe(await signToken('5m'));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: userId,
      email: 'person@example.com',
      name: 'Pessoa de teste',
      role: 'user',
      balance: 12,
    });
  });

  it('returns 401 for missing, malformed, expired, or non-expiring JWTs', async () => {
    const missing = await getMe();
    const malformed = await getMe('not-a-jwt');
    const expired = await getMe(await signToken('-1s'));
    const nonExpiring = await getMe(await signNonExpiringToken());

    expect(missing.statusCode).toBe(401);
    expect(malformed.statusCode).toBe(401);
    expect(expired.statusCode).toBe(401);
    expect(nonExpiring.statusCode).toBe(401);
  });

  it('provisions a profile and wallet when the auth trigger has not created them yet', async () => {
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.profile.upsert).mockResolvedValue({
      ...profile,
      name: '',
      wallet: { balance: 0 },
    } as never);

    const response = await getMe(await signToken('5m'));

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: userId,
      email: profile.email,
      name: '',
      role: 'user',
      balance: 0,
    });
    expect(prisma.profile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId },
        create: expect.objectContaining({
          id: userId,
          email: profile.email,
          wallet: { create: {} },
        }),
        update: {},
      }),
    );
    vi.mocked(prisma.profile.findUnique).mockResolvedValue(profile as never);
  });

  it('serves the Zod-backed OpenAPI contract at /docs-json', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/docs-json',
    });
    const document = response.json();

    expect(response.statusCode).toBe(200);
    expect(document.paths['/me'].get.responses['200'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/MeResponseDto',
    });
  });

  it('serves the Swagger UI at /docs', async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/docs',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
  });

  it('sets CORS headers only for configured web origins', async () => {
    const allowed = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    });
    const denied = await app.getHttpAdapter().getInstance().inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://attacker.example' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });
});
