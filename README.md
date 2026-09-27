# Big Eye

Big Eye é uma plataforma de consultas por créditos. O monorepo usa pnpm 9, Turborepo, Node 22, NestJS/Fastify, Prisma/Postgres, Redis/BullMQ e Next.js.

O catálogo e os schemas públicos ficam em `packages/contracts`. A API e o worker são os únicos processos que acessam Postgres e Redis. O web usa a sessão pública do Supabase e chama a API; a chave service role nunca deve ser configurada no web.

## Requisitos

- Node.js 22 LTS
- Corepack com pnpm 9
- Docker e Docker Compose
- Um projeto Supabase para autenticação quando o fluxo web autenticado for usado

## Desenvolvimento local

Copie o arquivo de ambiente e preencha os valores do Supabase e a chave usada pelo provedor fake:

```bash
cp .env.example .env
```

Suba Postgres e Redis, instale as dependências e prepare o banco local:

```bash
docker compose up -d
corepack enable
pnpm install
pnpm --filter @big-eye/core db:test:prepare
pnpm --filter @big-eye/core db:migrate
pnpm --filter @big-eye/core db:seed
```

Em terminais separados, inicie a API, o worker e o web:

```bash
pnpm --filter @big-eye/api start:dev
pnpm --filter @big-eye/worker start:dev
pnpm --filter @big-eye/web dev
```

A API fica em `http://localhost:3001`, o web em `http://localhost:3000`, a documentação OpenAPI em `/docs` e os endpoints de saúde em `/health` e `/ready`.

O `FakeProvider` permite testar `cpf-basico` e `dossie-360` sem integração upstream. O pagamento fake usa `FAKE_PAYMENT_SECRET` para validar o header `x-fake-signature` dos webhooks.

## Comandos úteis

```bash
pnpm turbo run lint
pnpm turbo run typecheck
pnpm turbo run test
pnpm turbo run build
pnpm --filter @big-eye/web test:e2e
```

Os testes Playwright usam um projeto Supabase configurado e um usuário de teste. Defina `WEB_URL`, `NEXT_PUBLIC_API_URL`, as variáveis públicas do Supabase e `SUPABASE_TEST_EMAIL`/`SUPABASE_TEST_PASSWORD`. Os testes do backoffice também exigem `SUPABASE_ADMIN_EMAIL`/`SUPABASE_ADMIN_PASSWORD`.

Antes de rodar os E2E, deixe API, worker, Postgres, Redis e o banco migrado. O Playwright instala e gerencia o servidor Next quando `CI` está definido; localmente, um web já iniciado pode ser reutilizado.

## Deploy

O serviço HTTP da Railway usa `railway.json` e `apps/api/Dockerfile`. O pre-deploy executa `pnpm --filter @big-eye/core db:migrate` e a verificação de prontidão chama `/ready`.

Crie um segundo serviço Railway para o worker, apontando o Dockerfile para `apps/worker/Dockerfile` e fornecendo as mesmas variáveis de banco, Redis, Supabase e provider. O worker não expõe porta nem healthcheck HTTP.

O projeto web da Vercel deve usar a raiz do repositório e `vercel.json`. Configure no projeto apenas as variáveis públicas necessárias ao browser, especialmente `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou a chave publicável equivalente).

As variáveis completas, o procedimento de migração, os webhooks e as respostas a incidentes estão em [`docs/runbook.md`](docs/runbook.md).

## Segurança operacional

Não coloque `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL` ou `FAKE_PAYMENT_SECRET` em código, no web ou em logs. Inputs de consulta são mascarados e armazenados apenas como metadados; o payload do resultado fica no cache com TTL.
