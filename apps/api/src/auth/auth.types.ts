import type { Role, UserStatus } from '@big-eye/core/db/prisma-client';

export type ApiUser = {
  id: string;
  email: string | null;
  role: Role | null;
  status: UserStatus | null;
};

export type JwtClaims = {
  sub: string;
  email: string | null;
};

export interface RequestWithUser {
  headers: {
    authorization?: string | string[];
  };
  user?: ApiUser;
}

export interface JwtVerifierPort {
  verify(token: string): Promise<JwtClaims>;
}
