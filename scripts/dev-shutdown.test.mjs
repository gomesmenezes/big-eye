import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

import { isReachable } from './dev-infra.mjs';

async function unusedPort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

test('shutdown frees a descendant port even when its watcher exits first', {
  skip: process.platform === 'win32',
  timeout: 20_000,
}, async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'big-eye-dev-test-'));
  const dependency = createServer((socket) => socket.end());
  dependency.listen(0, '127.0.0.1');
  await once(dependency, 'listening');
  const dependencyPort = dependency.address().port;
  const apiPort = await unusedPort();
  const webPort = await unusedPort();
  let child;
  let descendantPid;
  try {
    await writeFile(join(fixture, '.env'), '');
    for (const name of ['api', 'worker', 'web']) {
      const app = join(fixture, 'apps', name);
      const module = join(app, 'node_modules', name === 'web' ? 'next' : 'tsx');
      await mkdir(module, { recursive: true });
      await writeFile(join(app, 'package.json'), '{}');
      await writeFile(join(module, 'package.json'), JSON.stringify({
        type: 'module', exports: { [name === 'web' ? './dist/bin/next' : './cli']: './cli.mjs' },
      }));
      const script = name === 'api' ? `
        import { spawn } from 'node:child_process';
        spawn(process.execPath, ['-e', ${JSON.stringify(`
          const server = require('node:net').createServer();
          process.on('SIGTERM', () => {});
          server.listen(Number(process.env.API_PORT), '127.0.0.1', () => console.log('descendant:' + process.pid));
        `)}], { stdio: 'inherit' });
        process.on('SIGTERM', () => process.exit(0));
      ` : `setInterval(() => {}, 1000); process.on('SIGTERM', () => process.exit(0));`;
      await writeFile(join(module, 'cli.mjs'), script);
    }
    child = spawn(process.execPath, [new URL('./dev.mjs', import.meta.url).pathname], {
      cwd: fixture,
      env: {
        ...process.env,
        DATABASE_URL: `postgresql://127.0.0.1:${dependencyPort}/bigeye`,
        REDIS_URL: `redis://127.0.0.1:${dependencyPort}`,
        API_PORT: String(apiPort), WEB_PORT: String(webPort),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', (data) => { output += data; });
    child.stderr.on('data', (data) => { output += data; });
    const deadline = Date.now() + 5_000;
    while (!output.includes('descendant:')) {
      assert.equal(child.exitCode, null, output);
      assert.ok(Date.now() < deadline, output);
      await delay(25);
    }
    descendantPid = Number(output.match(/descendant:(\d+)/)[1]);
    const closed = once(child, 'close');
    child.kill('SIGINT');
    await delay(50);
    child.kill('SIGTERM');
    const [code] = await closed;
    assert.equal(code, 0, output);
    assert.equal(await isReachable({ host: '127.0.0.1', port: apiPort }), false, output);
    assert.equal(await isReachable({ host: '127.0.0.1', port: dependencyPort }), true);
    assert.doesNotMatch(output, /EPERM|Force killing|ECONNREFUSED/);
  } finally {
    if (child?.exitCode === null) child.kill('SIGKILL');
    if (descendantPid) {
      try { process.kill(descendantPid, 'SIGKILL'); } catch (error) {
        if (error.code !== 'ESRCH') throw error;
      }
    }
    await new Promise((resolve) => dependency.close(resolve));
    await rm(fixture, { recursive: true, force: true });
  }
});
