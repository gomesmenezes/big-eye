import { existsSync } from 'node:fs';
import { createConnection } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

export function isReachable({ host, port }) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port });
    const finish = (ready) => {
      socket.destroy();
      resolve(ready);
    };
    socket.setTimeout(2_000, () => finish(false));
    socket.once('error', () => finish(false));
    socket.once('connect', () => finish(true));
  });
}

export async function ensureInfrastructure({
  env = process.env,
  run,
  reachable = isReachable,
  platform = process.platform,
  signal,
}) {
  const dependencies = [
    { key: 'DATABASE_URL', name: 'Postgres', service: 'postgres', port: 5432 },
    { key: 'REDIS_URL', name: 'Redis', service: 'redis', port: 6379 },
  ].map((dependency) => {
    if (!env[dependency.key]) throw new Error(`${dependency.key} não configurada.`);
    const url = new URL(env[dependency.key]);
    return {
      ...dependency,
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port || dependency.port),
      defaultPort: dependency.port,
    };
  });

  const missing = [];
  for (const dependency of dependencies) {
    signal?.throwIfAborted();
    if (!await reachable(dependency)) missing.push(dependency);
  }
  if (!missing.length) return;

  for (const dependency of missing) {
    const local = ['localhost', '127.0.0.1', '::1'].includes(dependency.host);
    if (!local || dependency.port !== dependency.defaultPort) {
      throw new Error(`${dependency.name} indisponível em ${dependency.host}:${dependency.port}. Verifique ${dependency.key}; o Compose só gerencia as portas locais padrão.`);
    }
  }

  const dockerReady = async () => {
    try {
      await run('docker', ['info'], { stdio: 'ignore', timeout: 5_000 });
      return true;
    } catch {
      signal?.throwIfAborted();
      return false;
    }
  };

  if (!await dockerReady()) {
    if (platform !== 'darwin' || !existsSync('/Applications/Docker.app')) {
      throw new Error('Docker indisponível. Instale/inicie o Docker e rode pnpm run dev novamente.');
    }
    console.log('[dev] Abrindo Docker Desktop e aguardando a inicialização...');
    await run('open', ['-a', '/Applications/Docker.app']);
    const deadline = Date.now() + 90_000;
    while (!await dockerReady()) {
      if (Date.now() >= deadline) throw new Error('Docker não iniciou em 90 segundos. Verifique o Docker Desktop.');
      await delay(1_000, undefined, { signal });
    }
  }

  signal?.throwIfAborted();
  console.log(`[dev] Preparando ${missing.map(({ name }) => name).join(' e ')}...`);
  await run('docker', ['compose', 'up', '-d', '--wait', '--wait-timeout', '90', ...missing.map(({ service }) => service)]);

  for (const dependency of dependencies) {
    signal?.throwIfAborted();
    if (!await reachable(dependency)) {
      throw new Error(`${dependency.name} continua indisponível em ${dependency.host}:${dependency.port}.`);
    }
  }
}
