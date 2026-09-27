import { ForbiddenException, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaClient } from '@big-eye/core/db/prisma-client';

import { AuthGuard } from './auth.guard.js';
import type { JwtVerifierPort, RequestWithUser } from './auth.types.js';
import { AdminGuard, SuspendedGuard } from './roles.guard.js';

const userId = 'f4b9f6a7-43b9-4b4d-8aa1-48793273cb93';

function createContext(request: RequestWithUser): ExecutionContext {
  const handler = () => undefined;
  const controller = class TestController {};

  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const jwtVerifier: JwtVerifierPort = {
    verify: vi.fn(),
  };
  const prisma = {
    profile: { findUnique: vi.fn() },
  } as unknown as PrismaClient;
  const guard = new AuthGuard(reflector, jwtVerifier, prisma);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
  });

  it('returns 401 when the bearer token is missing', async () => {
    const request: RequestWithUser = { headers: {} };

    await expect(guard.canActivate(createContext(request))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtVerifier.verify).not.toHaveBeenCalled();
  });

  it.each(['invalid', 'expired'])('returns 401 when the token is %s', async (token) => {
    vi.mocked(jwtVerifier.verify).mockRejectedValue(new Error('JWT rejected'));

    await expect(
      guard.canActivate(
        createContext({ headers: { authorization: `Bearer ${token}` } }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('populates the request user from the verified token and database profile', async () => {
    const request: RequestWithUser = {
      headers: { authorization: 'Bearer valid-token' },
    };
    vi.mocked(jwtVerifier.verify).mockResolvedValue({ sub: userId, email: 'jwt@example.com' });
    vi.mocked(prisma.profile.findUnique).mockResolvedValue({
      id: userId,
      email: 'profile@example.com',
      role: 'user',
      status: 'active',
    } as never);

    await expect(guard.canActivate(createContext(request))).resolves.toBe(true);
    expect(request.user).toEqual({
      id: userId,
      email: 'profile@example.com',
      role: 'user',
      status: 'active',
    });
  });

  it('allows explicitly public routes without reading authorization', async () => {
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(true);

    await expect(guard.canActivate(createContext({ headers: {} }))).resolves.toBe(true);
    expect(jwtVerifier.verify).not.toHaveBeenCalled();
    expect(prisma.profile.findUnique).not.toHaveBeenCalled();
  });
});

describe('authorization guards', () => {
  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(false),
  } as unknown as Reflector;
  const suspendedGuard = new SuspendedGuard(reflector);
  const adminGuard = new AdminGuard();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(reflector.getAllAndOverride).mockReturnValue(false);
  });

  it('returns 403 for a suspended account', () => {
    const request: RequestWithUser = {
      headers: {},
      user: { id: userId, email: 'user@example.com', role: 'user', status: 'suspended' },
    };

    expect(() => suspendedGuard.canActivate(createContext(request))).toThrow(ForbiddenException);
  });

  it('allows an administrator and rejects a regular account', () => {
    const adminRequest: RequestWithUser = {
      headers: {},
      user: { id: userId, email: 'admin@example.com', role: 'admin', status: 'active' },
    };
    const userRequest: RequestWithUser = {
      headers: {},
      user: { id: userId, email: 'user@example.com', role: 'user', status: 'active' },
    };

    expect(adminGuard.canActivate(createContext(adminRequest))).toBe(true);
    expect(() => adminGuard.canActivate(createContext(userRequest))).toThrow(ForbiddenException);
  });
});
