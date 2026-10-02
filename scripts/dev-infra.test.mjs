import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

test('starts missing default local dependencies and waits before returning', async () => {
  const { ensureInfrastructure } = await import('./dev-infra.mjs');
  let ready = false;
  const commands = [];
  await ensureInfrastructure({
    env: { REDIS_URL: 'redis://localhost:6379', DATABASE_URL: 'postgresql://localhost:5432/bigeye' },
    reachable: async () => ready,
    run: async (command, args) => {
      commands.push([command, ...args]);
      if (args[0] === 'compose') ready = true;
    },
  });
  assert.equal(ready, true);
  assert.deepEqual(commands, [
    ['docker', 'info'],
    ['docker', 'compose', 'up', '-d', '--wait', '--wait-timeout', '90', 'postgres', 'redis'],
  ]);
});

test('macOS opens the installed Docker app before preparing missing services', {
  skip: !existsSync('/Applications/Docker.app'),
}, async () => {
  const { ensureInfrastructure } = await import('./dev-infra.mjs');
  let opened = false;
  let ready = false;
  await ensureInfrastructure({
    platform: 'darwin',
    env: { DATABASE_URL: 'postgresql://localhost:5432/bigeye', REDIS_URL: 'redis://localhost:6379' },
    reachable: async () => ready,
    run: async (command, args) => {
      if (command === 'open') {
        assert.deepEqual(args, ['-a', '/Applications/Docker.app']);
        opened = true;
      } else if (args[0] === 'info' && !opened) {
        throw new Error('Docker stopped');
      } else if (args[0] === 'compose') {
        assert.equal(opened, true);
        ready = true;
      }
    },
  });
  assert.equal(ready, true);
});

test('reuses available dependencies without requiring Docker', async () => {
  const { ensureInfrastructure, isReachable } = await import('./dev-infra.mjs');
  const server = createServer((socket) => socket.end());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    await ensureInfrastructure({
      env: { DATABASE_URL: `postgresql://127.0.0.1:${port}/bigeye`, REDIS_URL: `redis://127.0.0.1:${port}` },
      reachable: isReachable,
      run: async () => assert.fail('Existing services must be reused'),
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('unavailable remote or custom-port dependency fails without starting local containers', async () => {
  const { ensureInfrastructure } = await import('./dev-infra.mjs');
  for (const url of ['redis://example.invalid:6379', 'redis://localhost:6380']) {
    await assert.rejects(ensureInfrastructure({
      env: { DATABASE_URL: 'postgresql://localhost:5432/bigeye', REDIS_URL: url },
      reachable: async ({ service }) => service === 'postgres',
      run: async () => assert.fail('Must not replace configured services'),
    }), /Redis indisponível/);
  }
});

test('Docker startup failure stops preflight instead of starting workers', async () => {
  const { ensureInfrastructure } = await import('./dev-infra.mjs');
  await assert.rejects(ensureInfrastructure({
    env: { DATABASE_URL: 'postgresql://localhost:5432/bigeye', REDIS_URL: 'redis://localhost:6379' },
    reachable: async () => false,
    platform: 'linux',
    run: async () => { throw new Error('daemon unavailable'); },
  }), /Docker/);
});
