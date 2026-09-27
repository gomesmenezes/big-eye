# Big Eye — Design Spec

**Data:** 2026-09-27
**Status:** Aprovado (design) — aguardando plano de implementação
**Escopo:** Plataforma B2C de consultas de dados (pessoais, veiculares, empresariais e web/OSINT), com carteira de créditos onde **1 crédito = 1 consulta**, backend como agregador de um provedor upstream único.

---

## 1. Objetivo e critério de sucesso

O usuário se registra, adquire créditos (Pix ou cartão) e executa consultas. Cada consulta consome exatamente 1 crédito (custo definido por módulo no catálogo) e o resultado é exibido ao usuário.

**Critério de sucesso (fase 1):** usuário consegue registrar → logar → comprar créditos → rodar uma consulta → ver o resultado → ter o crédito debitado corretamente (e reembolsado se a consulta falhar tecnicamente).

**Fora de escopo da fase 1:** integração de todas as ~30 consultas do catálogo com o provedor (fase 2). A fase 1 entrega a plataforma completa e 1–2 módulos funcionando de ponta a ponta (um síncrono e um assíncrono) como prova do caminho.

---

## 2. Decisões de produto

| Tema | Decisão |
|---|---|
| Público | B2C self-serve (pessoa física). Sem times/multi-tenant. |
| Créditos | Compra via gateway (Pix + cartão). 1 crédito = 1 consulta. |
| Gateway | Abstraído (`PaymentProvider`); provedor concreto plugado depois. |
| Provedor upstream | Único agregador, credencial única, padrão único de request/response. |
| Latência | Misto: consultas leves síncronas, pesadas assíncronas. |
| Persistência de resultado | **Apenas metadados** no banco. Nenhum payload de resultado persiste. |
| Auth | Supabase Auth (cadastro, verificação, reset, JWT). Nosso backend valida o JWT. |
| Backoffice | Admin completo no MVP. |
| Frontend público | Nenhum. App fechado atrás do login. |
| Idiomas/moeda | pt-BR, BRL. |

> **Nota sobre auth:** a ideia inicial era auth próprio. Optou-se por **Supabase Auth** (só a parte de auth; o banco é Supabase Postgres) para não reimplementar verificação de email, reset e OAuth. Nosso backend permanece dono da autorização (papéis) e dos créditos.

---

## 3. Arquitetura

### 3.1 Monorepo

Gerenciado com **pnpm workspaces + Turborepo**.

```
big-eye/
  apps/
    web/        Next.js 15 (App Router), Tailwind + shadcn/ui
    api/        NestJS (adapter Fastify) — REST, guards, créditos, webhooks
    worker/     Node + BullMQ — processa consultas assíncronas
  packages/
    contracts/  Zod schemas + tipos + catálogo de módulos + códigos de erro
    config/     eslint / tsconfig / prettier compartilhados
  docker-compose.yml   Postgres + Redis locais
  docs/superpowers/specs/
```

`apps/api` e `apps/worker` compartilham os módulos de domínio (créditos, consultas, provedor) via código comum no próprio `apps/api` ou num pacote interno — **um único `CreditsService`**, nunca duplicado.

### 3.2 Stack

| Componente | Tecnologia |
|---|---|
| Front | Next.js 15 App Router, TypeScript, Tailwind, shadcn/ui, TanStack Query |
| API | NestJS + `@nestjs/platform-fastify`, Zod (`nestjs-zod`), Swagger gerado do catálogo |
| Worker | Node + BullMQ |
| ORM | Prisma |
| Banco | Supabase Postgres |
| Fila/Cache | Redis (Upstash) + BullMQ |
| Auth | Supabase Auth (`@supabase/ssr` no front) |
| Email transacional | SMTP do Supabase (verify/reset) |
| Testes | Vitest (unit/integração), Playwright (E2E) |

### 3.3 `packages/contracts` — fonte única da verdade

O catálogo de módulos é declarado **uma vez**, em TypeScript, e consumido pelo `api` (validação de entrada, montagem do Swagger, roteamento para o adapter do provedor) e pelo `web` (client tipado e renderização do catálogo). Cada entrada tem:

```ts
type ModuleContract = {
  slug: string;                 // "cpf-cadsus"
  nome: string;                 // "CPF Cadsus"
  categoria: 'pessoais' | 'veiculares' | 'empresariais' | 'web';
  tags: string[];               // ["CPF", "SUS"]
  descricao: string;
  destaque?: boolean;           // selo "ESPECIAL"
  custoCreditos: number;        // padrão 1
  mode: 'sync' | 'async';
  input: ZodSchema;             // campos exigidos
  output: ZodSchema;            // shape esperado do resultado
};
```

Adicionar uma consulta = **incluir um objeto no catálogo + implementar o método correspondente no adapter do provedor**. Nada mais.

### 3.4 Fluxo geral

```
Navegador ──▶ apps/web (UI + sessão Supabase)
                │  Authorization: Bearer <supabase access_token>
                ▼
             apps/api  ──▶ Postgres (Supabase)
                │      ──▶ Redis (BullMQ + cache de resultado)
                │      ──▶ PaymentProvider (checkout/webhook)
                ▼
             apps/worker ──▶ ProviderClient (agregador upstream)
```

O `web` **não** é BFF: chama o `api` diretamente com o Bearer do Supabase. CORS com allowlist. O `api` é o dono único da verdade.

---

## 4. Autenticação e autorização

1. Cadastro/login/verificação/reset no `web` via `@supabase/ssr`; sessão em cookie gerenciado pelo Supabase.
2. Toda chamada ao `api` leva `Authorization: Bearer <access_token>`.
3. O `api` valida o JWT pelo **JWKS público** do Supabase (sem segredo compartilhado) e extrai `sub` (user id).
4. `AuthGuard` global popula `req.user`.
5. `public.profiles` é criado por **trigger em `auth.users`** (migração SQL crua), guardando `role` e `status`. **Papéis vivem no nosso banco**, não em claims.
6. `@Public()` marca rotas sem auth (health, webhooks).
7. `AdminGuard` exige `profiles.role = 'admin'`.
8. `SuspendedGuard` bloqueia usuários com `status = 'suspended'`.

---

## 5. Modelo de dados

Schema `public` gerenciado por **Prisma**. Ledger append-only; `wallets.balance` é materialização dele.

### `profiles`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| email | text | |
| name | text | |
| role | enum(`user`,`admin`) | default `user` |
| status | enum(`active`,`suspended`) | default `active` |
| created_at / updated_at | timestamptz | |

Trigger `on_auth_user_created` insere a linha.

### `wallets`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| user_id | uuid unique FK profiles | |
| balance | int | default 0; travado com `FOR UPDATE` |
| updated_at | timestamptz | |

### `credit_transactions` (imutável)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | |
| wallet_id | uuid FK wallets | |
| user_id | uuid FK profiles | desnormalizado para consulta |
| type | enum(`signup_bonus`,`purchase`,`consume`,`refund`,`admin_adjust`) | |
| amount | int | com sinal (+/-) |
| balance_after | int | |
| ref_type | enum(`payment`,`query`,`admin`) nullable | null em `signup_bonus` |
| ref_id | uuid nullable | null em `signup_bonus` |
| description | text | |
| idempotency_key | text unique nullable | |
| created_at | timestamptz | |

Índice único `(ref_type, ref_id, type)` impede débito/reembolso duplicado.

### `queries` (metadados; sem payload)
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | também é o `idempotency_key` do débito |
| user_id | uuid FK profiles | |
| module_slug | text | referência ao catálogo |
| mode | enum(`sync`,`async`) | |
| status | enum(`pending`,`running`,`succeeded`,`failed`,`refunded`) | |
| credits_charged | int | |
| input_hash | text | sha256 |
| input_masked | text | ex.: `***.***.***-09` |
| input | jsonb nullable | **só enquanto `pending`/`running`; apagado ao terminar** |
| provider_request_id | text nullable | |
| attempts | int | default 0 |
| next_poll_at | timestamptz nullable | |
| error_code | text nullable | |
| error_message | text nullable | sanitizado |
| started_at / finished_at / created_at | timestamptz | |

Índices: `(user_id, created_at desc)`, `(status, next_poll_at)`.

### `query_events`
`id`, `query_id`, `from_status`, `to_status`, `source` (`api`|`worker`|`provider`|`admin`), `message`, `created_at`. Auditoria das transições.

### `credit_packages`
`id`, `slug`, `credits` (int), `price_cents` (int), `currency` (`BRL`), `active`, `sort`. Preços editáveis no admin; nunca hard-coded.

### `payments`
`id`, `user_id`, `provider`, `provider_payment_id`, `method` (`pix`|`card`), `amount_cents`, `credits`, `status` (`pending`|`paid`|`failed`|`expired`|`refunded`), `pix_qr_code`, `pix_expires_at`, `paid_at`, `created_at`, `updated_at`.

### `webhook_events`
`id`, `provider`, `provider_event_id` (**unique**), `payload` (jsonb), `signature_valid`, `processed_at`, `received_at`. Garante idempotência de webhooks.

### `admin_audit_log`
`id`, `admin_user_id`, `target_user_id` nullable, `action`, `payload` (jsonb), `created_at`.

---

## 6. Créditos

**Padrão:** reserva → confirma → reembolsa. Cobrança na entrada, nunca no fim.

1. `SELECT wallet FOR UPDATE`; se `balance < custo` → **402** `INSUFFICIENT_CREDITS`.
2. Insere `credit_transactions` (`type: consume`, `amount: -custo`, `idempotency_key` = `queries.id`) e atualiza `wallets.balance`.
3. Insere a `queries` (`pending`).

- **Sucesso** → débito permanece.
- **Falha técnica** (erro do provedor, timeout, 5xx) → `refund` (`+custo`) e status `refunded`.
- **"Não encontrado"** (200 com resultado vazio) → **cobrado** (resultado legítimo).
- **Idempotência:** `POST /queries` aceita header `Idempotency-Key`; retry não cobra duas vezes.
- **Concorrência:** o lock na linha da carteira garante que débitos paralelos não estourem o saldo.

Implementado em **um único `CreditsService`**, usado por `api` e `worker`.

---

## 7. Ciclo de vida da consulta

```
pending ──▶ running ──▶ succeeded
   │           │
   └───────────┴──▶ failed ──▶ refunded
```

### 7.1 Síncrona
`api` chama o provedor inline com timeout (padrão 15s) e devolve o resultado na resposta. Só metadados persistem. Timeout → `failed` → `refunded`.

### 7.2 Assíncrona
1. `api` cria `queries` (`pending`) e enfileira `query:run`.
2. `worker`: `pending → running`, submete ao provedor.
   - Resultado imediato → conclui.
   - `request_id` → guarda em `provider_request_id` e agenda **polls** (BullMQ delayed, backoff exponencial, teto configurável).
3. Resultado obtido → grava **no Redis com TTL** (padrão 30 min) → `running → succeeded`.
4. Tentativas esgotadas/timeout → `failed` → `refunded`.

### 7.3 Entrega ao cliente
- `GET /queries/:id` — polling do status.
- `GET /queries/:id/stream` — **SSE** (recomendado): emite eventos de estado e o payload lido do Redis. `EventEmitter` no `api` alimentado pelo worker via Redis pub/sub.

### 7.4 Rede de segurança
Job por minuto varre `queries` presas em `pending`/`running` além do limite → `failed` + `refunded`.

### 7.5 Rate limit
Throttler por usuário em `POST /queries` (padrão 10/min).

---

## 8. Pagamento

**Interface `PaymentProvider`:** `createCheckout`, `parseWebhook`, `getStatus`. Implementações: `MercadoPagoProvider`, `PagarMeProvider`, `FakeProvider` (dev/testes). Config escolhe a ativa.

### 8.1 Checkout
1. `GET /packages` → lista pacotes ativos.
2. `POST /payments` `{ packageId, method }` → cria `payments` (`pending`), chama `createCheckout`, devolve QR Code Pix ou URL do checkout de cartão.
3. Usuário paga.
4. `POST /webhooks/payments/:provider` — **rota pública**, validada por **assinatura HMAC** (exige raw body no Fastify).
5. Grava `webhook_events` por `provider_event_id` (unique → replay = no-op); se `paid`, numa transação marca `payments.paid`, credita a carteira (`purchase`, `ref_id` = payment) e grava `paid_at`.
6. Responde 200 rápido; processamento pesado vai para fila.

### 8.2 Regras duras
- **Fonte da verdade é o webhook**, nunca o redirect do navegador.
- Job de reconciliação consulta `getStatus` de pagamentos `pending` antigos (webhook perdido não pode virar prejuízo).
- Job marca `payments` vencidos como `expired`.

---

## 9. API (superfície)

| Método | Rota | Auth | descrição |
|---|---|---|---|
| GET | `/health`, `/ready` | pública | saúde |
| GET | `/me` | user | perfil + saldo |
| GET | `/modules` | user | catálogo (metadados, sem schemas internos) |
| POST | `/queries` | user | cria consulta (sync ou async), debita crédito |
| GET | `/queries` | user | histórico (metadados) |
| GET | `/queries/:id` | user (dono) | status |
| GET | `/queries/:id/stream` | user (dono) | SSE de progresso/resultado |
| GET | `/credits/transactions` | user | extrato |
| GET | `/packages` | user | pacotes ativos |
| POST | `/payments` | user | inicia checkout |
| GET | `/payments/:id` | user (dono) | status do pagamento |
| POST | `/webhooks/payments/:provider` | pública + assinatura | webhook |
| GET | `/admin/users` … | admin | CRUD/consultas de admin |
| PATCH | `/admin/users/:id/wallet` | admin | ajuste manual (com motivo) |
| PATCH | `/admin/users/:id/status` | admin | suspender/reativar |
| GET | `/admin/queries`, `/admin/payments` | admin | listagens |
| POST | `/admin/queries/:id/retry` , `/refund` | admin | ações manuais |
| CRUD | `/admin/packages` | admin | pacotes |

Todas as rotas de negócio exigem saldo/autorização via guards/serviços, nunca no front.

---

## 10. Admin (backoffice)

Página `/admin` no `web`, guardada por `AdminGuard` (checa `profiles.role`).

- **Usuários:** buscar/listar, ver carteira e extrato, ajustar saldo manualmente (com motivo → `admin_audit_log`), suspender/reativar.
- **Consultas:** listar com filtros (usuário, módulo, status, período), ver detalhe + `query_events`, re-tentar, reembolsar. **Re-tentativa do admin não gera novo débito** — re-enfileira a mesma `queries` (mantendo o `idempotency_key`); se falhar de novo, segue o fluxo normal de reembolso. Ação registrada em `admin_audit_log`.
- **Pagamentos:** listar, ver status, reprocessar webhook manualmente.
- **Catálogo:** CRUD de `credit_packages`; ligar/desligar módulos.
- **Dashboard:** novos usuários, créditos vendidos/consumidos, consultas por módulo, taxa de falha.

---

## 11. Segurança e LGPD

- JWT validado por JWKS; CORS com allowlist; `helmet`; `@nestjs/throttler`.
- Credencial do provedor upstream **somente no servidor** (env/secret), nunca no front.
- Postgres acessível **apenas** por `api`/`worker`; autorização na API (sem depender de RLS).
- **Nenhum payload de resultado no banco.** `input` mascarado + hash; retenção de metadados configurável (padrão 12 meses); exclusão de conta remove o usuário e anonimiza consultas.
- Nada de PII nos logs.
- Toda ação de admin auditada.
- Segredos em env do Vercel/Railway/Supabase; config validada com Zod no boot.

---

## 12. Não-objetivos (YAGNI)

Sem times/multi-tenant, sem API pública para devs, sem landing/marketing/SEO, sem 2FA, sem cache persistente de resultado, sem múltiplos provedores simultâneos, sem i18n, sem app mobile.

---

## 13. Deploy e ambientes

| Componente | Alvo |
|---|---|
| `web` | Vercel |
| `api`, `worker` | Railway (mesmo Dockerfile, comandos de start diferentes) |
| Postgres | Supabase |
| Redis | Upstash |
| Email | SMTP do Supabase |

- Local: `docker-compose` (Postgres + Redis) + `FakeProvider` + `FakePaymentProvider`.
- Config por env, validada com Zod no boot.
- Migrações: `prisma migrate deploy` no release.
- Ambientes: local → staging → produção.

---

## 14. Testes

- **Unit (Vitest):** `CreditsService` (débito/reembolso/idempotência), adapters do provedor, `parseWebhook`, validação de contratos.
- **Integração** (Postgres de teste + `FakeProvider`):
  - N débitos concorrentes: só os que cabem no saldo passam.
  - Webhook repetido não credita duas vezes.
  - Ciclo completo sync e async; job de reconciliação reembolsa consulta presa.
- **E2E (Playwright):** registrar → comprar (fake) → consulta sync → resultado + débito → consulta async → atualização via SSE.
- **Contrato:** todo módulo do catálogo tem schema Zod com round-trip.
- **CI:** GitHub Actions (typecheck + lint + test) por PR via Turborepo.

---

## 15. Observabilidade

Logs estruturados (pino) com `requestId`/`queryId`; Sentry em `web`/`api`/`worker`; `/health` e `/ready` no `api`.

---

## 16. Roadmap de execução (alto nível)

**Fase 1 — plataforma (esta spec)**
1. Fundação do monorepo, configs, docker-compose, CI.
2. `contracts` com catálogo (metadados dos ~30 módulos; 1–2 implementados).
3. Auth (Supabase Auth + trigger `profiles` + guards).
4. Créditos (ledger + `CreditsService`) e `GET /me`, `/credits/transactions`.
5. Motor de consulta (sync + async + BullMQ + SSE + reconciliação) com `FakeProvider`.
6. Pagamento (`PaymentProvider` + `FakePaymentProvider` + webhook idempotente + reconciliação).
7. Admin completo.
8. Front: login, dashboard, catálogo, tela de consulta, extrato, compra, admin.

**Fase 2 — integrações**
9. Adapter do provedor real + implementação dos ~30 módulos + ajuste de schemas de saída.

---

## 17. Perguntas em aberto / decisões pendentes

- Provedor de pagamento concreto (abstraído por ora).
- Provedor upstream concreto e contrato real (fase 2).
- Valor do bônus de cadastro (se houver) e pacotes iniciais.
- Confirmação da política de retenção (12 meses) e termos de uso.
