# Big Eye — Implementation Plan (Fase 1: plataforma)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a plataforma Big Eye de ponta a ponta — auth, carteira de créditos, motor de consultas (sync/async), compra de créditos com webhook e backoffice admin — com o catálogo dos módulos e 2 módulos funcionando contra um provedor fake.

**Architecture:** Monorepo pnpm + Turborepo. `packages/core` concentra o domínio e a infraestrutura (Prisma, Redis, créditos, consultas, provedor, pagamentos); `apps/api` é a camada HTTP (NestJS + Fastify, guards); `apps/worker` são os processadores BullMQ; `apps/web` é o Next.js (UI + sessão Supabase); `packages/contracts` é a fonte única do catálogo e dos schemas. Auth via Supabase Auth, com autorização no nosso `profiles`.

**Tech Stack:** Node 22, pnpm 9, TypeScript strict, Turborepo, NestJS 11 (Fastify), Prisma 6, Postgres (Supabase), Redis (Upstash) + BullMQ 5, Next.js 15, `@supabase/ssr`, Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-big-eye-design.md`

## Global Constraints

- Node 22 LTS, pnpm 9, TypeScript `strict: true`. Sem `any` não justificado.
- pt-BR e BRL em tudo que é exibido. Código/identificadores em inglês.
- **1 crédito = 1 consulta.** O custo vive no catálogo (`custoCreditos`, default `1`).
- **Nenhum payload de resultado é persistido no banco.** Metadados apenas.
- O Postgres só é acessado por `api` e `worker` (service role). Nunca pelo browser.
- Dinheiro sempre em **centavos** (`int`); créditos sempre **inteiros** (`int`).
- Timestamps em UTC. Falhas sempre com `error_code` estável; nunca vazar detalhe do provedor.
- Nunca logar PII (CPF, email, telefone). `input` é mascarado + hash.
- Segredos só em env; config validada por Zod no boot.

## Review Focus

Classes de entrada / modos de falha que a spec implica e que tendem a morder — cada linha ganha um teste na tarefa que é dona do código:

1. **`Idempotency-Key` reusada com corpo diferente** → deve devolver o resultado da primeira consulta e **não** debitar de novo (task 6).
2. **Webhook de pagamento fora de ordem / repetido / pago após expiração** → nunca credita duas vezes, nunca credita pagamento expirado (task 8).
3. **Resposta malformada ou inesperada do provedor** → consulta `failed` + `refunded`, worker não trava (task 6).
4. **Cliente desconecta do SSE no meio** → consulta assíncrona conclui e, se falhar, reembolsa (task 7).
5. **Cache de resultado expira enquanto o cliente faz polling** → status continua `succeeded`, resposta orienta nova consulta (task 7).

---

## Task 1: Fundação do monorepo

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc`, `.gitignore` (append), `.editorconfig`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/eslint.cjs`, `packages/config/prettier.cjs`
- Create: `docker-compose.yml`, `.env.example`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: workspaces `apps/*`, `packages/*`; script raiz `pnpm turbo lint typecheck test build`; `packages/config/tsconfig.base.json` (strict, `target: ES2022`, `module: NodeNext`, `moduleResolution: NodeNext`); Postgres local em `localhost:5432` (db `bigeye`, user `bigeye`, pass `bigeye`) e Redis em `localhost:6379`.

- [x] **Step 1:** Criar `pnpm-workspace.yaml` com `packages: ['apps/*', 'packages/*']` e o `package.json` raiz com `packageManager: "pnpm@9"`, `engines.node: ">=22"` e scripts delegando ao Turbo.
- [x] **Step 2:** `packages/config`: `tsconfig.base.json` (strict, ES2022, NodeNext, `paths` para `@big-eye/*`), `eslint.cjs` (typescript-eslint + import order) e `prettier.cjs`. `turbo.json` com pipelines `build` (depende de `^build`), `lint`, `typecheck`, `test`.
- [x] **Step 3:** `docker-compose.yml` com serviços `postgres:16` e `redis:7` (volumes nomeados, healthchecks). `.env.example` com `DATABASE_URL`, `DIRECT_URL`, `REDIS_URL`, `SUPABASE_URL`, `SUPABASE_JWKS_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_PROVIDER=fake`, `PROVIDER_MODE=fake`, `WEB_ORIGIN`, `API_PORT`, `QUERY_TIMEOUT_MS`, `RESULT_TTL_SECONDS`.
- [x] **Step 4:** `.github/workflows/ci.yml`: setup pnpm + Node 22, `pnpm install --frozen-lockfile`, subir Postgres/Redis como services, `pnpm turbo lint typecheck test`.
- [x] **Step 5:** Validar: `docker compose up -d`, `pnpm install`, `pnpm turbo typecheck` (vazio, deve passar) e commitar.

```bash
git add -A
git commit -m "chore: bootstrap pnpm+turborepo monorepo with docker-compose and CI"
```

---

## Task 2: `packages/contracts` — catálogo e schemas

**Files:**
- Create: `packages/contracts/package.json`, `src/index.ts`
- Create: `src/catalog.ts` (tipos + `MODULES`), `src/modules/*.ts` (schemas dos módulos implementados), `src/errors.ts`, `src/dto.ts`
- Test: `src/catalog.test.ts`, `src/modules/cpf-basico.test.ts`, `src/modules/dossie-360.test.ts`

**Interfaces:**
- Produces:
  - `type ModuleCategory = 'pessoais' | 'veiculares' | 'empresariais' | 'web'`
  - `type ModuleContract = { slug: string; nome: string; categoria: ModuleCategory; tags: string[]; descricao: string; destaque?: boolean; custoCreditos: number; mode: 'sync' | 'async'; implemented: boolean; input: ZodTypeAny; output: ZodTypeAny }`
  - `const MODULES: ModuleContract[]`, `function getModule(slug: string): ModuleContract | undefined`
  - `const ERROR_CODES` (objeto `as const`) e `type ErrorCode`
  - DTOs Zod: `CreateQueryBody`, `QueryDTO`, `MeDTO`, `TransactionDTO`, `PackageDTO`, `PaymentDTO`, `AdminAdjustWalletBody`

- [x] **Step 1: Escrever os testes do catálogo**

```ts
import { MODULES, getModule } from './index';

test('todo slug é único e não vazio', () => {
  const slugs = MODULES.map((m) => m.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
  expect(slugs.every((s) => /^[a-z0-9-]+$/.test(s))).toBe(true);
});

test('todo módulo tem custo inteiro >= 1 e mode válido', () => {
  for (const m of MODULES) {
    expect(Number.isInteger(m.custoCreditos)).toBe(true);
    expect(m.custoCreditos).toBeGreaterThanOrEqual(1);
    expect(['sync', 'async']).toContain(m.mode);
  }
});

test('getModule encontra por slug e devolve undefined para desconhecido', () => {
  expect(getModule('cpf-basico')?.nome).toBe('CPF Completo');
  expect(getModule('nao-existe')).toBeUndefined();
});
```

- [x] **Step 2:** Rodar `pnpm --filter @big-eye/contracts test` e ver falhar (módulos não existem).
- [x] **Step 3: Implementar o catálogo.** `MODULES` contém os ~30 módulos do spec (nome, categoria, tags, descrição, `destaque` para os ESPECIAIS, `custoCreditos: 1`), todos com `mode` definido. Dois implementados de verdade: `cpf-basico` (`sync`) e `dossie-360` (`async`), com `input`/`output` Zod reais:
  - `cpf-basico.input = z.object({ cpf: z.string().regex(/^\d{11}$/) })`; `output` com `nome`, `cpf`, `nascimento?`, `situacao?`.
  - `dossie-360.input = z.object({ cpf: z.string().regex(/^\d{11}$/) })`; `output` com `resumo`, `fontes: z.array(z.string())`.
  - Os demais entram com `implemented: false`, um `input`/`output` placeholder **explicitamente marcado** (`z.object({ cpf: z.string() })` e `z.record(z.unknown())`) — a fase 2 troca pelos schemas reais.
- [x] **Step 4: Implementar `ERROR_CODES` e os DTOs** (`errors.ts`, `dto.ts`) com os nomes exatos usados pelo `api` (`INSUFFICIENT_CREDITS`, `MODULE_NOT_FOUND`, `INVALID_INPUT`, `QUERY_FAILED`, `PROVIDER_UNAVAILABLE`, `PAYMENT_NOT_FOUND`, `FORBIDDEN`, `UNAUTHORIZED`).
- [x] **Step 5:** Rodar os testes, garantir PASS, e commitar.

```bash
git add -A
git commit -m "feat(contracts): add module catalog, zod schemas and error codes"
```

---

## Task 3: `packages/core` — schema Prisma, migrações, trigger e seed

**Files:**
- Create: `packages/core/package.json`, `src/db/prisma.ts`, `src/db/prisma-client.ts`
- Create: `packages/core/prisma/schema.prisma`, `packages/core/prisma/migrations/*`
- Create: `packages/core/prisma/migrations/<ts>_auth_trigger/migration.sql`
- Create: `packages/core/prisma/seed.ts`
- Test: `packages/core/src/db/wallet.test.ts` (integração, sobe Postgres do docker-compose)

**Interfaces:**
- Produces: `export const prisma: PrismaClient`; enums `Role`, `UserStatus`, `CreditTxType`, `RefType`, `QueryMode`, `QueryStatus`, `PaymentStatus`, `PaymentMethod`; modelos `Profile`, `Wallet`, `CreditTransaction`, `Query`, `QueryEvent`, `CreditPackage`, `Payment`, `WebhookEvent`, `AdminAuditLog`.
- Consumes: `DATABASE_URL`/`DIRECT_URL` (task 1).

- [x] **Step 1: Escrever o schema Prisma** conforme a seção 5 da spec. Pontos exatos: `Wallet.balance Int @default(0)`; `CreditTransaction.idempotencyKey String? @unique`; índice único `@@unique([refType, refId, type])`; `Query.input Json?`; índices `@@index([userId, createdAt])` e `@@index([status, nextPollAt])`; `WebhookEvent.providerEventId String @unique`; `Payment.amountCents Int`, `Payment.credits Int`.
- [x] **Step 2: Migração do trigger de auth** (`auth_trigger`), SQL cru:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

  Proteger com `if exists (select 1 from information_schema.schemata where schema_name='auth')` para não quebrar em Postgres sem Supabase (testes locais usam o mesmo Postgres do docker-compose — criar schemas `auth` e uma tabela `auth.users` mínima numa migração de teste).
- [x] **Step 3: Seed** com 3 `credit_packages` (ex.: 10/50/100 créditos, preços em centavos) e um usuário admin de desenvolvimento (`profile.role = 'admin'`).
- [x] **Step 4: Teste de integração do débito atômico** (a base do task 5): duas transações concorrentes tentando debitar o mesmo wallet com saldo 1 — exatamente uma passa. Escrever o teste usando `prisma.$transaction` com `SELECT ... FOR UPDATE` via `$queryRaw`.
- [x] **Step 5:** Rodar `prisma migrate deploy` + `prisma db seed` + teste, e commitar.

```bash
git add -A
git commit -m "feat(core): prisma schema, auth trigger, seed and wallet lock test"
```

---

## Task 4: `apps/api` — bootstrap, config, auth e guards

**Files:**
- Create: `apps/api/package.json`, `src/main.ts`, `src/app.module.ts`
- Create: `src/config/env.ts` (Zod), `src/common/filters/http-exception.filter.ts`, `src/common/logger.ts`
- Create: `src/auth/jwt-verifier.ts` (JWKS via `jose` + cache), `src/auth/auth.guard.ts`, `src/auth/roles.guard.ts`, `src/auth/public.decorator.ts`, `src/auth/current-user.decorator.ts`
- Create: `src/me/me.controller.ts`, `src/me/me.service.ts`
- Test: `src/auth/auth.guard.test.ts`, `src/me/me.controller.e2e.test.ts`

**Interfaces:**
- Produces: `AuthGuard` global (valida Bearer via JWKS, anexa `req.user = { id, email, role, status }`); `@Public()`; `@CurrentUser()`; `AdminGuard`; `SuspendedGuard`; `GET /me` → `MeDTO` (`{ id, email, name, role, balance }`).
- Consumes: `prisma`, `MODULES`, `ERROR_CODES`.

- [ ] **Step 1: Bootstrap** NestJS com `FastifyAdapter`, CORS com allowlist (`WEB_ORIGIN`), `helmet`, `@nestjs/throttler` (global) e Swagger em `/docs` gerado a partir dos DTOs Zod (`nestjs-zod`).
- [ ] **Step 2: Config Zod** (`env.ts`) validando todas as envs no boot; falhar rápido com mensagem clara.
- [ ] **Step 3: `JwtVerifier`** — `createRemoteJWKSet(new URL(env.SUPABASE_JWKS_URL))` + `jwtVerify(token, jwks, { audience: 'authenticated' })`. Retorna `{ sub, email }`.
- [ ] **Step 4: Guard + teste unitário.** Teste cobre: token ausente → 401; token inválido/expirado → 401; token válido → `req.user` populado; `status=suspended` → 403.
- [ ] **Step 5: `GET /me`** — lê `profiles` + `wallets.balance`; 404 se o profile não existir (trigger atrasado) com log de aviso. E2E com um JWT de teste assinado por um JWKS local.
- [ ] **Step 6:** `pnpm --filter @big-eye/api test` PASS, `git commit -m "feat(api): bootstrap nestjs with supabase jwks auth and guards"`.

---

## Task 5: `packages/core` — `CreditsService`

**Files:**
- Create: `packages/core/src/credits/credits.service.ts`, `src/credits/credit-tx.repository.ts`
- Test: `src/credits/credits.service.test.ts`

**Interfaces:**
- Produces:
  - `class CreditsService` com:
    - `debitForQuery(tx, { userId, queryId, amount, description }): Promise<void>` — lança `InsufficientCreditsError` se saldo < amount.
    - `refundQuery(tx, { userId, queryId, amount, reason }): Promise<void>` — idempotente por `(query, refund)`.
    - `creditPurchase(tx, { userId, paymentId, amount }): Promise<void>` — idempotente por `(payment, purchase)`.
    - `adjust(tx, { userId, adminId, amount, reason }): Promise<void>` — grava `admin_adjust` + `AdminAuditLog`.
    - `getBalance(userId): Promise<number>`, `listTransactions(userId, { limit, cursor })`.
  - Erros: `InsufficientCreditsError`, `DuplicateTransactionError`.
- Consumes: `prisma` (task 3).

- [ ] **Step 1: Testes (Vitest + Postgres de teste).** Casos: débito com saldo suficiente atualiza `balance` e cria ledger com `balance_after` correto; débito com saldo insuficiente lança e não altera nada; **refund duas vezes só aplica uma**; **purchase repetido do mesmo payment só credita uma vez**; débito concorrente (20 paralelos, saldo 5) → exatamente 5 sucessos.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3: Implementar `CreditsService`** — toda operação recebe `tx: Prisma.TransactionClient`, faz `SELECT ... FOR UPDATE` no wallet, insere em `credit_transactions` e atualiza `wallets.balance`. `balance_after` = saldo após a operação. Idempotência apoiada em `idempotencyKey` e no índice único `(refType, refId, type)` — capturar `P2002` e traduzir para `DuplicateTransactionError`.
- [ ] **Step 4:** Testes PASS. Commit:

```bash
git commit -m "feat(core): credits ledger service with lock, idempotency and refunds"
```

---

## Task 6: `packages/core` + `apps/api` — provedor, registry e consultas síncronas

**Files:**
- Create: `packages/core/src/provider/provider.client.ts`, `src/provider/fake.provider.ts`, `src/provider/registry.ts`
- Create: `packages/core/src/queries/queries.service.ts`, `src/queries/mask.ts`
- Create: `apps/api/src/queries/queries.controller.ts`, `apps/api/src/credits/credits.controller.ts`
- Test: `packages/core/src/queries/queries.service.test.ts`, `apps/api/src/queries/queries.controller.e2e.test.ts`

**Interfaces:**
- Produces:
  - `type ProviderRequest = { module: string; input: Record<string, unknown> }`
  - `type ProviderResult = { kind: 'result'; data: unknown } | { kind: 'accepted'; requestId: string }`
  - `interface ProviderClient { execute(req: ProviderRequest): Promise<ProviderResult>; poll(requestId: string): Promise<ProviderResult> }`
  - `function getProviderClient(): ProviderClient` (lê `PROVIDER_MODE`)
  - `class QueriesService` com `create(userId, module, input, idempotencyKey?)`, `get(userId, id)`, `list(userId, { limit, cursor })`
  - `maskInput(module, input): { masked: string; hash: string }`
  - Endpoints: `POST /queries` (202/200), `GET /queries`, `GET /queries/:id`, `GET /credits/transactions`, `GET /modules`.
- Consumes: `CreditsService` (task 5), `MODULES` (task 2).

- [ ] **Step 1: Testes do caminho síncrono.** Casos: sucesso → `succeeded`, débito permanece, `input` apagado, `input_masked`/`hash` preenchidos; provedor lança erro → `failed` + `refunded`; **provedor devolve payload fora do `output` schema → `failed` + `refunded`** (Review Focus #3); saldo insuficiente → 402 e nenhuma `queries` criada; **reuso de `Idempotency-Key` com corpo diferente devolve a consulta original e não debita de novo** (Review Focus #1).
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3: `FakeProvider`** — determinístico por `module`+`input` (ex.: CPF terminando em `0` → `kind: 'accepted'` para módulos async; CPF inválido → lança `ProviderError('PROVIDER_UNAVAILABLE')`; caso normal → `kind: 'result'` com dados que passam no `output` do catálogo).
- [ ] **Step 4: `QueriesService.create` (sync)** — numa `prisma.$transaction`: cria `queries` com `input` e metadados, `creditsService.debitForQuery`, chama `provider.execute` com `AbortSignal.timeout(env.QUERY_TIMEOUT_MS)`, valida `output` e finaliza. Em qualquer falha (erro, timeout, shape inválido): `status=failed` + `refundQuery`, `input` apagado. Registrar cada transição em `query_events`.
- [ ] **Step 5: Controllers** — `POST /queries` valida `input` contra `module.input` (400 `INVALID_INPUT`), resolve `mode`; sync responde inline. `GET /modules` expõe o catálogo sem os schemas internos. `GET /credits/transactions` paginado.
- [ ] **Step 6:** Testes PASS. Commit:

```bash
git commit -m "feat: provider abstraction and synchronous query engine with refunds"
```

---

## Task 7: `apps/worker` + `apps/api` — consultas assíncronas, SSE e reconciliação

**Files:**
- Create: `apps/worker/package.json`, `src/main.ts`, `src/processors/query-run.processor.ts`, `src/processors/query-poll.processor.ts`
- Create: `packages/core/src/queues/queues.ts` (`QUEUE_NAMES`, `queryQueue`, `reconciliationQueue`), `src/redis.ts` (`ioredis`), `src/result-cache.ts`
- Create: `packages/core/src/queries/reconcile.service.ts`
- Modify: `packages/core/src/queries/queries.service.ts` (branch `mode === 'async'` → enfileira)
- Create: `apps/api/src/queries/queries-sse.controller.ts`
- Test: `packages/core/src/queries/async.spec.test.ts`, `apps/api/src/queries/sse.e2e.test.ts`

**Interfaces:**
- Produces:
  - `QUEUE_NAMES = { queryRun: 'query:run', queryPoll: 'query:poll', reconcile: 'reconcile' }`
  - `resultCache.get(queryId)`, `resultCache.set(queryId, payload, ttlSeconds)`, `resultCache.del(queryId)`
  - `QueryEventsBus` (pub/sub Redis): `publish(queryId, event)` / `subscribe(queryId, cb)` — usado pelo SSE
  - `GET /queries/:id/stream` (SSE: emite `{ status }` e, ao concluir, `{ status: 'succeeded', data }` lido do cache)
- Consumes: `QueriesService`, `CreditsService`, `ProviderClient`.

- [ ] **Step 1: Testes.** Casos: async `accepted` → `running`, poll resolve → cache populado + `succeeded`; poll esgota tentativas → `failed` + `refunded`; **SSE entrega status final mesmo se o cliente reconectar** (Review Focus #4); **cache expirado → `GET /queries/:id` responde `succeeded` sem `data` e com `resultExpired: true`** (Review Focus #5); varredura de reconciliação reembolsa consulta presa há > limite.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3: Filas** (`queues.ts`, `redis.ts`, `result-cache.ts`) com BullMQ; `query:run` com `removeOnComplete/removeOnFail` limitados; `resultCache` com TTL de `env.RESULT_TTL_SECONDS`.
- [ ] **Step 4: Processadores** — `query-run`: `pending→running`, `provider.execute`; `accepted` → guarda `providerRequestId`, agenda `query:poll` (delay exponencial com teto). `query-poll`: `provider.poll`; ao resolver, valida `output`, grava no cache, publica no bus, `succeeded`, apaga `input`. Falha final → `failed` + `refund`.
- [ ] **Step 5: `QueriesService.create` (async)** — cria `pending` + debita + enfileira `query:run`; responde 202 com a consulta.
- [ ] **Step 6: SSE** no `api` — `@Sse('queries/:id/stream')` que assina o `QueryEventsBus`, envia o status atual imediatamente e encerra ao chegar em estado terminal. Se terminal e cache vazio → envia `resultExpired: true`.
- [ ] **Step 7: Reconciliação** — job repetível (1 min) marca `failed`+`refunded` consultas presas além do limite e publica no bus.
- [ ] **Step 8:** Testes PASS. Commit:

```bash
git commit -m "feat(worker): async query engine with polling, sse and reconciliation"
```

---

## Task 8: `packages/core` + `apps/api` — pagamentos e webhook

**Files:**
- Create: `packages/core/src/payments/payment-provider.ts`, `src/payments/fake.provider.ts`, `src/payments/provider-registry.ts`, `src/payments/payments.service.ts`
- Create: `apps/api/src/payments/payments.controller.ts`, `apps/api/src/payments/webhooks.controller.ts`, `apps/api/src/packages/packages.controller.ts`
- Test: `packages/core/src/payments/payments.service.test.ts`, `apps/api/src/payments/webhooks.e2e.test.ts`

**Interfaces:**
- Produces:
  - `type CheckoutInput = { userId: string; packageId: string; method: 'pix' | 'card'; amountCents: number; credits: number }`
  - `type CheckoutResult = { providerPaymentId: string; method: 'pix' | 'card'; pixQrCode?: string; checkoutUrl?: string; expiresAt?: Date }`
  - `type NormalizedPaymentEvent = { providerEventId: string; providerPaymentId: string; status: 'paid' | 'failed' | 'expired'; paidAt?: Date; raw: unknown }`
  - `interface PaymentProvider { createCheckout(i: CheckoutInput): Promise<CheckoutResult>; parseWebhook(rawBody: Buffer, headers: Record<string,string>): Promise<NormalizedPaymentEvent>; getStatus(providerPaymentId: string): Promise<'pending'|'paid'|'failed'|'expired'> }`
  - `function getPaymentProvider(): PaymentProvider` (lê `PAYMENT_PROVIDER`)
  - `class PaymentsService` com `createCheckout(userId, { packageId, method })`, `get(userId, id)`, `handleWebhook(rawBody, headers)`, `reconcilePending()`, `expireStale()`
  - Endpoints: `GET /packages`, `POST /payments`, `GET /payments/:id`, `POST /webhooks/payments/:provider` (público).
- Consumes: `CreditsService`, `prisma`.

- [ ] **Step 1: Testes.** Casos: checkout cria `pending` com `credits` do pacote; webhook `paid` credita via `creditPurchase` e marca `paid`; **webhook repetido (mesmo `providerEventId`) não credita de novo**; **webhook `paid` para pagamento já `expired` não credita** (Review Focus #2); assinatura inválida → 401 e nada persiste; reconciliação crédita pagamento `pending` que o provedor já deu como `paid`.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3: `FakePaymentProvider`** — `createCheckout` devolve QR Pix fake e `providerPaymentId`; `parseWebhook` valida um HMAC simples (`x-fake-signature`) com `env.FAKE_PAYMENT_SECRET`; `getStatus` lê de um mapa em memória controlável nos testes.
- [ ] **Step 4: `PaymentsService`** — `handleWebhook` grava `WebhookEvent` por `providerEventId` (unique → replay vira no-op), valida `signatureValid`, e numa transação marca `paid` + `creditPurchase` apenas se `status === 'pending'`. Publicar `rawBody` no Fastify (`{ rawBody: true }`).
- [ ] **Step 5: Controllers** — `POST /payments` valida `packageId` ativo; webhook é `@Public()`, lê o corpo cru e responde 200 sempre que o evento for válido/repetido.
- [ ] **Step 6: Jobs** — `reconcilePending` (5 min) e `expireStale` (1 min). Testes PASS. Commit:

```bash
git commit -m "feat: abstract payment provider, checkout and idempotent webhooks"
```

---

## Task 9: `apps/api` — admin

**Files:**
- Create: `apps/api/src/admin/admin-users.controller.ts`, `admin-queries.controller.ts`, `admin-payments.controller.ts`, `admin-packages.controller.ts`, `admin-dashboard.controller.ts`, `apps/api/src/admin/admin.module.ts`
- Test: `apps/api/src/admin/admin.e2e.test.ts`

**Interfaces:**
- Produces:
  - `GET /admin/users?q=`, `GET /admin/users/:id` (perfil + carteira + extrato)
  - `PATCH /admin/users/:id/wallet` (`{ amount, reason }` → `CreditsService.adjust`)
  - `PATCH /admin/users/:id/status` (`{ status }`)
  - `GET /admin/queries`, `GET /admin/queries/:id` (+ `query_events`)
  - `POST /admin/queries/:id/retry` (re-enfileira sem novo débito), `POST /admin/queries/:id/refund`
  - `GET /admin/payments`, `POST /admin/payments/:id/reprocess`
  - `GET /admin/packages`, `POST/PATCH/DELETE /admin/packages/:id`
  - `GET /admin/dashboard` (novos usuários, créditos vendidos/consumidos, consultas por módulo, taxa de falha)
- Consumes: `AdminGuard` (task 4), `CreditsService`, `QueriesService`, `PaymentsService`.

- [ ] **Step 1: Testes E2E.** Casos: usuário comum recebe 403 em toda rota `/admin/*`; ajuste de wallet grava `admin_adjust` **e** `admin_audit_log`; `retry` **não** cria novo débito e mantém o `idempotency_key` (Review Focus da §10 da spec); `refund` idempotente; `GET /admin/dashboard` calcula os agregados corretos.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Implementar controllers sobre os serviços existentes, todos com `@AdminGuard`, paginação por cursor, e `retry` chamando `queryQueue.add` com o mesmo `queryId`.
- [ ] **Step 4:** Testes PASS. Commit:

```bash
git commit -m "feat(api): admin endpoints for users, queries, payments, packages and dashboard"
```

---

## Task 10: `apps/web` — fundação, auth e client tipado

**Files:**
- Create: `apps/web/package.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx` (redirect), `src/middleware.ts`
- Create: `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts`, `src/lib/api.ts` (fetch tipado com Bearer), `src/lib/query-client.tsx`
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(app)/layout.tsx`
- Test: `apps/web/src/lib/api.test.ts` (Vitest), smoke E2E em `e2e/auth.spec.ts`

**Interfaces:**
- Produces: `createSupabaseServerClient()`, `createSupabaseBrowserClient()`, `apiFetch<T>(path, init)` (anexa `Authorization: Bearer` da sessão; tipado pelos DTOs de `@big-eye/contracts`), `Providers` (TanStack Query). `middleware.ts` protege `/(app)` redirecionando para `/login`.
- Consumes: `contracts` DTOs, API da task 4.

- [ ] **Step 1: Bootstrap** Next.js 15 App Router + Tailwind + shadcn/ui; `@supabase/ssr` configurado por cookies.
- [ ] **Step 2: Login/registro** com Supabase Auth; após login, obter `access_token` da sessão e usá-lo no `apiFetch`.
- [ ] **Step 3: `apiFetch` + teste** — teste unitário garante que o header Bearer é anexado e que 401 dispara refresh de sessão uma vez.
- [ ] **Step 4:** E2E mínimo: visitar `/` deslogado → redireciona `/login`; logar (usuário de teste) → cai no dashboard.
- [ ] **Step 5:** Commit `feat(web): nextjs bootstrap with supabase auth and typed api client`.

---

## Task 11: `apps/web` — fluxos do usuário

**Files:**
- Create: `src/app/(app)/dashboard/page.tsx`, `src/app/(app)/catalogo/page.tsx`
- Create: `src/app/(app)/consulta/[slug]/page.tsx` (form + resultado, SSE para async)
- Create: `src/app/(app)/creditos/page.tsx` (extrato + compra), `src/components/query-form.tsx`, `src/components/query-result.tsx`, `src/components/buy-credits.tsx`
- Test: `e2e/query-sync.spec.ts`, `e2e/query-async.spec.ts`, `e2e/buy-credits.spec.ts`

**Interfaces:**
- Consumes: `GET /modules`, `POST /queries`, `GET /queries/:id`, `/queries/:id/stream`, `GET /credits/transactions`, `GET /packages`, `POST /payments`, `GET /payments/:id`.

- [ ] **Step 1: Testes E2E (Playwright, com `FakeProvider`).** Sync: rodar `cpf-basico` → ver resultado → saldo cai 1. Async: rodar `dossie-360` → ver "processando" → resultado chega via SSE → saldo cai 1. Compra: iniciar Pix (`FakePaymentProvider`) → simular webhook `paid` → saldo sobe.
- [ ] **Step 2:** Rodar e ver falhar.
- [ ] **Step 3:** Dashboard (saldo + atalhos), catálogo (agrupado por categoria, badge ESPECIAL, "Assine para acessar" para quem tem saldo 0), tela de consulta (form gerado do contrato do módulo; sync mostra resultado inline; async usa `EventSource` e mostra progresso; trata `resultExpired`), extrato paginado e compra de créditos (Pix com QR e polling de status; cartão via redirect).
- [ ] **Step 4:** Testes PASS. Commit `feat(web): user flows for catalog, queries, credits and purchase`.

---

## Task 12: `apps/web` — backoffice admin

**Files:**
- Create: `src/app/(app)/admin/layout.tsx` (guard de role), `admin/page.tsx` (dashboard), `admin/usuarios/page.tsx`, `admin/consultas/page.tsx`, `admin/pagamentos/page.tsx`, `admin/pacotes/page.tsx`
- Test: `e2e/admin.spec.ts`

**Interfaces:**
- Consumes: todos os endpoints `/admin/*` (task 9).

- [ ] **Step 1:** E2E: usuário não-admin não vê `/admin`; admin ajusta saldo com motivo e vê a linha no extrato do usuário; admin edita um pacote e o novo preço aparece para o usuário.
- [ ] **Step 2:** Implementar as páginas com tabelas paginadas, ações de ajuste/reembolso/retry e formulários de pacote.
- [ ] **Step 3:** Testes PASS. Commit `feat(web): admin backoffice`.

---

## Task 13: E2E final, deploy e endurecimento

**Files:**
- Create: `apps/api/Dockerfile`, `apps/worker/Dockerfile`, `railway.json`, `vercel.json`
- Modify: `.github/workflows/ci.yml` (job de E2E + build), `README.md`
- Create: `docs/runbook.md` (variáveis, migrações, webhooks, incidentes)

**Interfaces:**
- Consumes: tudo acima.

- [ ] **Step 1:** Dockerfiles multi-stage para `api` e `worker` (mesma base, commands `node dist/main.js` e `node dist/worker.js`).
- [ ] **Step 2:** `railway.json` com `prisma migrate deploy` no pre-deploy e healthcheck `/ready`; `vercel.json` para o `web`.
- [ ] **Step 3:** CI: subir Postgres/Redis, `prisma migrate deploy`, seed, build e **rodar os E2E do Playwright**.
- [ ] **Step 4:** Passar a suíte completa (`pnpm turbo lint typecheck test` + Playwright), rodar a revisão final da branch.
- [ ] **Step 5:** Commit `chore: docker, deploy config, e2e ci and runbook`.

---

## Verificação final (do spec → plano)

- §1 objetivo/critério → tasks 5–11 (E2E em 11 cobre o critério de sucesso exato).
- §3.1 monorepo → task 1. §3.3 contratos → task 2. §3.2 stack → tasks 1–4.
- §4 auth → task 4. §5 modelo de dados → task 3. §6 créditos → task 5.
- §7 sync → task 6; §7.2–7.4 async/SSE/reconciliação → task 7; §7.5 rate limit → task 4.
- §8 pagamento → task 8. §9 API → tasks 4,6,7,8,9. §10 admin → tasks 9 e 12.
- §11 segurança/LGPD → tasks 3,4,6 (mascaramento/hash, guards, segredos). §12 não-objetivos → nenhuma tarefa extra.
- §13 deploy → task 13. §14 testes → cada task + 13. §15 observabilidade → tasks 4 e 13.

Itens da §17 (gateway concreto, provedor upstream, bônus de cadastro) permanecem **em aberto** e não bloqueiam a fase 1 — o design os abstrai.
