import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import { ensureInfrastructure } from './dev-infra.mjs';

if (!existsSync('.env')) {
  console.error('Arquivo .env não encontrado. Crie com "cp .env.example .env", preencha as credenciais e rode pnpm run dev novamente.');
  process.exit(1);
}

process.loadEnvFile('.env');

const abortController = new AbortController();
const groups = new Set();
let stopping = false;

function signalGroup(pid, signal) {
  try {
    process.kill(process.platform === 'win32' ? pid : -pid, signal);
    return true;
  } catch (error) {
    // A group can briefly contain only processes being reaped. A denied
    // existence probe still means we should wait, rather than crash shutdown.
    if (error.code === 'EPERM' && signal === 0) return true;
    if (error.code !== 'ESRCH') throw error;
    groups.delete(pid);
    return false;
  }
}

async function stop(exitCode) {
  if (stopping) return;
  stopping = true;
  process.exitCode = exitCode;
  abortController.abort();
  // Watchers forward termination themselves. Signalling the entire group
  // immediately would deliver the signal twice to their watchers.
  for (const pid of groups) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
  const deadline = Date.now() + 5_000;
  while (groups.size && Date.now() < deadline) {
    await delay(100);
    for (const pid of groups) signalGroup(pid, 0);
  }
  for (const pid of groups) signalGroup(pid, 'SIGKILL');
}

function start(command, args, options = {}) {
  abortController.signal.throwIfAborted();
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    detached: process.platform !== 'win32',
    ...options,
  });
  if (child.pid) groups.add(child.pid);
  child.once('close', () => {
    // A watcher can exit while its app still owns a port in its group.
    if (child.pid) signalGroup(child.pid, 0);
  });
  return child;
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = start(command, args, options);
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} falhou (${code ?? 'interrompido'}).`));
    });
  });
}

process.on('SIGINT', () => void stop(0));
process.on('SIGTERM', () => void stop(0));
process.on('SIGHUP', () => void stop(0));

try {
  await ensureInfrastructure({ run, signal: abortController.signal });
} catch (error) {
  if (!stopping) {
    console.error(`[dev] ${error.message}`);
    await stop(1);
  }
}
if (stopping) process.exit(process.exitCode);

function parsePort(name, fallback) {
  const port = Number(process.env[name] ?? fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} precisa ser uma porta entre 1 e 65535.`);
  }

  return port;
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen({ port, host: '0.0.0.0', exclusive: true }, () => {
      server.close((error) => resolve(!error));
    });
  });
}

async function findWebPort(preferredPort, apiPort) {
  for (let port = preferredPort; port <= 65_535; port += 1) {
    if (port !== apiPort && await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error('Não foi encontrada uma porta disponível para o web.');
}

const apiPort = parsePort('API_PORT', 3001);
if (!await isPortAvailable(apiPort)) {
  console.error(`[dev] A porta da API (${apiPort}) está ocupada. Encerre a outra execução ou altere API_PORT.`);
  await stop(1);
  process.exit(process.exitCode);
}
const webPort = await findWebPort(parsePort('WEB_PORT', 3000), apiPort);
const webOrigin = `http://localhost:${webPort}`;
const allowedOrigins = (process.env.WEB_ORIGIN ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!allowedOrigins.includes(webOrigin)) {
  allowedOrigins.push(webOrigin);
}

process.env.WEB_ORIGIN = allowedOrigins.join(',');

const services = [
  { name: 'api', entry: 'tsx/cli', args: ['watch', 'src/main.ts'] },
  { name: 'worker', entry: 'tsx/cli', args: ['watch', 'src/main.ts'] },
  { name: 'web', entry: 'next/dist/bin/next', args: ['dev', '--port', String(webPort)] },
];

console.log(`[dev] Web: ${webOrigin} | API: http://localhost:${apiPort}`);
for (const { name, entry, args } of services) {
  const cwd = resolve('apps', name);
  const require = createRequire(resolve(cwd, 'package.json'));
  const child = start(process.execPath, [require.resolve(entry), ...args], { cwd });

  child.on('error', (error) => {
    console.error(`[${name}] Could not start service:`, error);
    void stop(1);
  });

  child.on('exit', (code, signal) => {
    if (!stopping) {
      if (signal) {
        console.error(`[${name}] exited from ${signal}.`);
      }
      void stop(code ?? 1);
    }
  });

}
