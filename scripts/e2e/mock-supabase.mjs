import { createServer } from 'node:http';
import { createSign, generateKeyPairSync } from 'node:crypto';

const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54321);
const regularEmail = process.env.SUPABASE_TEST_EMAIL ?? 'e2e-user@example.com';
const regularPassword = process.env.SUPABASE_TEST_PASSWORD ?? 'e2e-password';
const adminEmail = process.env.SUPABASE_ADMIN_EMAIL ?? 'e2e-admin@example.com';
const adminPassword = process.env.SUPABASE_ADMIN_PASSWORD ?? 'e2e-password';

const users = new Map([
  [regularEmail, {
    id: '11111111-1111-4111-8111-111111111111',
    email: regularEmail,
    password: regularPassword,
    name: 'Usuário E2E',
  }],
  [adminEmail, {
    id: '22222222-2222-4222-8222-222222222222',
    email: adminEmail,
    password: adminPassword,
    name: 'Admin E2E',
  }],
]);

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = {
  ...publicKey.export({ format: 'jwk' }),
  alg: 'RS256',
  kid: 'big-eye-e2e',
  use: 'sig',
};

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function issueToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'RS256', kid: publicJwk.kid, typ: 'JWT' });
  const payload = encode({
    aud: 'authenticated',
    email: user.email,
    exp: now + 3_600,
    iat: now,
    role: 'authenticated',
    sub: user.id,
  });
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(privateKey).toString('base64url')}`;
}

function userResponse(user) {
  const timestamp = new Date().toISOString();
  return {
    id: user.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: user.email,
    email_confirmed_at: timestamp,
    phone: '',
    confirmed_at: timestamp,
    last_sign_in_at: timestamp,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: { name: user.name },
    identities: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function json(response, status, body, origin) {
  response.writeHead(status, {
    'access-control-allow-headers':
      'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-origin': origin ?? '*',
    'access-control-allow-credentials': 'true',
    'cache-control': 'no-store',
    'content-type': 'application/json',
    vary: 'Origin',
  });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function userFromToken(token) {
  if (!token) {
    return undefined;
  }

  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return [...users.values()].find((user) => user.id === payload.sub);
  } catch {
    return undefined;
  }
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'access-control-allow-headers':
        'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-origin': request.headers.origin ?? '*',
      'access-control-allow-credentials': 'true',
      vary: 'Origin',
    });
    response.end();
    return;
  }

  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);

  if (request.method === 'GET' && url.pathname === '/auth/v1/.well-known/jwks.json') {
    json(response, 200, { keys: [publicJwk] }, request.headers.origin);
    return;
  }

  if (request.method === 'POST' && url.pathname === '/auth/v1/token') {
    const body = await readBody(request);
    let user;

    if (url.searchParams.get('grant_type') === 'password') {
      user = users.get(body.email);
      if (!user || user.password !== body.password) {
        json(response, 400, {
          error: 'invalid_grant',
          error_code: 'invalid_credentials',
          error_description: 'Invalid login credentials',
          msg: 'Invalid login credentials',
        }, request.headers.origin);
        return;
      }
    } else if (url.searchParams.get('grant_type') === 'refresh_token') {
      user = [...users.values()].find((candidate) => body.refresh_token === `refresh-${candidate.id}`);
    }

    if (!user) {
      json(response, 400, { error: 'invalid_grant', msg: 'Invalid refresh token' }, request.headers.origin);
      return;
    }

    const accessToken = issueToken(user);
    json(response, 200, {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: 3_600,
      expires_at: Math.floor(Date.now() / 1000) + 3_600,
      refresh_token: `refresh-${user.id}`,
      user: userResponse(user),
    }, request.headers.origin);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/auth/v1/user') {
    const authorization = request.headers.authorization;
    const token = typeof authorization === 'string' && authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    const user = userFromToken(token);
    if (!user) {
      json(response, 401, { error: 'invalid_token', msg: 'Invalid token' }, request.headers.origin);
      return;
    }

    json(response, 200, userResponse(user), request.headers.origin);
    return;
  }

  json(response, 404, { error: 'not_found', msg: 'Not found' }, request.headers.origin);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock Supabase auth listening on 127.0.0.1:${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
