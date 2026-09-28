import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';

if (!existsSync('.env')) {
  console.error('Arquivo .env não encontrado. Crie com "cp .env.example .env", preencha as credenciais e rode npm run dev novamente.');
  process.exit(1);
}

process.loadEnvFile('.env');

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
  { name: 'api', args: ['--filter', '@big-eye/api', 'start:dev'] },
  { name: 'worker', args: ['--filter', '@big-eye/worker', 'start:dev'] },
  { name: 'web', args: ['--filter', '@big-eye/web', 'dev', '--port', String(webPort)] },
];

let stopping = false;
const children = services.map(({ name, args }) => {
  const child = spawn('pnpm', args, { stdio: 'inherit', env: process.env });

  child.on('error', (error) => {
    console.error(`[${name}] Could not start service:`, error);
    stop(1);
  });

  child.on('exit', (code, signal) => {
    if (!stopping) {
      if (signal) {
        console.error(`[${name}] exited from ${signal}.`);
      }
      stop(code ?? 1);
    }
  });

  return child;
});

function stop(exitCode) {
  if (stopping) {
    return;
  }

  stopping = true;
  process.exitCode = exitCode;

  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
  }

  const forceStop = setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }
  }, 5_000);
  forceStop.unref();
}

process.once('SIGINT', () => stop(130));
process.once('SIGTERM', () => stop(143));
