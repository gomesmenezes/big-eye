# Runbook operacional do Big Eye

Este runbook cobre a operação da fase 1: API, worker, web, banco, Redis, pagamentos fake e consultas assíncronas. Ele deve ser usado junto com o painel de logs da plataforma e com os registros do provedor.

## Mapa dos serviços

| Serviço | Execução | Responsabilidade | Dependências |
| --- | --- | --- | --- |
| `web` | Vercel, `apps/web` | Sessão Supabase e interface | API, Supabase público |
| `api` | Railway, `apps/api/Dockerfile` | HTTP, auth, créditos, consultas e webhooks | Postgres, Redis, Supabase JWKS |
| `worker` | Railway, `apps/worker/Dockerfile` | Consultas async, polling e reconciliação | Postgres, Redis, Supabase/provider |
| Postgres | Supabase ou serviço gerenciado | Metadados, ledger e estados | Backup e conexão TLS |
| Redis | Upstash ou serviço gerenciado | BullMQ, eventos SSE e cache de resultados | URL Redis e limite de conexões |

O Dockerfile da API inicia `apps/api/dist/main.js`. O Dockerfile do worker inicia `apps/worker/dist/main.js`, que é o artefato produzido pelo `apps/worker/src/main.ts` atual. O texto original do plano menciona `dist/worker.js`, mas esse arquivo não existe no código atual.

## Variáveis de ambiente

### API e worker

| Variável | Uso | Observação |
| --- | --- | --- |
| `DATABASE_URL` | Conexão runtime do Prisma | Use conexão TLS e pool apropriado ao provedor |
| `DIRECT_URL` | Migrações Prisma | Deve alcançar diretamente o Postgres |
| `REDIS_URL` | BullMQ, eventos e cache | Use `rediss://` quando o provedor exigir TLS |
| `SUPABASE_URL` | Projeto Supabase | URL HTTPS do projeto |
| `SUPABASE_JWKS_URL` | Verificação dos JWTs | Endpoint JWKS do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Operações server-side autorizadas | Nunca envie ao browser ou registre em logs |
| `PAYMENT_PROVIDER` | Provider de pagamento | `fake`, `mercado-pago` ou `pagarme` |
| `FAKE_PAYMENT_SECRET` | Assinatura do provider fake | Obrigatória mesmo com outro provider configurado pelo schema atual |
| `PROVIDER_MODE` | Provider de consultas | `fake` ou `upstream` |
| `ATHENAS_API_KEY` | Autenticação na Athenas | Obrigatória com `PROVIDER_MODE=upstream`; configure somente na API e no worker |
| `ATHENAS_API_BASE_URL` | Base URL Athenas | Padrão `https://api.athenasbuscas.com/api/ext/v1` |
| `WEB_ORIGIN` | Allowlist CORS | Uma ou mais origens HTTPS separadas por vírgula |
| `API_PORT` | Porta HTTP | Railway deve encaminhar para a porta configurada |
| `QUERY_TIMEOUT_MS` | Timeout do provider sync | Inteiro positivo em milissegundos |
| `RESULT_TTL_SECONDS` | TTL do payload no Redis | Depois do TTL, a consulta continua `succeeded`, mas o payload pode estar expirado |

O worker aceita estas opções com defaults seguros: `QUERY_MAX_POLL_ATTEMPTS`, `QUERY_POLL_INITIAL_DELAY_MS`, `QUERY_POLL_MAX_DELAY_MS` e `QUERY_RECONCILE_MAX_AGE_MS`.

### Web e E2E

- `NEXT_PUBLIC_API_URL`: URL pública da API.
- `NEXT_PUBLIC_SUPABASE_URL`: URL pública do projeto Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: chave pública do Supabase.
- `WEB_URL`: base URL usada pelo Playwright.
- `SUPABASE_TEST_EMAIL` e `SUPABASE_TEST_PASSWORD`: usuário regular usado pelos E2E.
- `SUPABASE_ADMIN_EMAIL` e `SUPABASE_ADMIN_PASSWORD`: usuário admin usado pelos E2E do backoffice.

As variáveis `NEXT_PUBLIC_*` são incorporadas ao build do Next. Não reutilize nelas uma chave service role.

### Consultas Athenas

Configure `PROVIDER_MODE=upstream` e `ATHENAS_API_KEY` nos serviços da API e do worker. A API exige a chave na inicialização; o worker usa a mesma chave para as consultas assíncronas. O adaptador envia `X-API-Key`, trata `404` como consulta sem dados e deixa o fluxo existente reembolsar o crédito Big Eye em qualquer falha. O Dossiê 360 usa timeout de 60 segundos, e CPF Intelligent usa 30 segundos no worker.

O catálogo habilita os endpoints de dados Athenas abaixo. Módulos Big Eye sem rota Athenas semanticamente equivalente continuam indisponíveis.

| Endpoint Athenas | Módulo Big Eye | Entrada principal |
| --- | --- | --- |
| `/cadsus/:cpf` | `cpf-cadsus` | `cpf` |
| `/cpf/:cpf` | `cpf-basico` | `cpf` |
| `/dossie-360/:cpf` | `dossie-360` | `cpf` |
| `/cpf-intelligent/:cpf` | `cpf-intelligent` | `cpf` |
| `/obito/:cpf` | `cpf-obito` | `cpf` |
| `/parentes/:cpf` | `cpf-parentes` | `cpf` |
| `/score/:cpf` | `cpf-score` | `cpf` |
| `/cpf-detran/:cpf` | `cpf-detran` | `cpf` |
| `/sptrans/:cpf` | `sptrans-cpf` | `cpf` |
| `/email/:email` | `email-reverso` | `email` |
| `/phone/:phone` | `telefone-reverso` | `phone` |
| `/name-abbreviated` | `nome-abreviado` | `query` |
| `/name` | `nome-completo` | `query` |
| `/address` | `endereco-consulta` | `query` |
| `/plate/:plate` | `placa-basico` | `plate` |
| `/chassi/:chassi` | `chassi-consulta` | `chassi` |
| `/renavam/:renavam` | `renavam-consulta` | `renavam` |
| `/cnpj/:cnpj` | `cnpj-basico` | `cnpj` |
| `/employees/:cnpj` | `cnpj-funcionarios` | `cnpj` |
| `/ip/:ip` | `ip-geolocalizacao` | `ip` |
| `/domain/:domain` | `dominio-whois` | `domain` |
| `/leaked-logins` | `logins-vazados` | `q` |
| `/rais/:cpf` | `cpf-rais` | `cpf` |
| `/pis/:pis` | `pis-pasep` | `pis` |
| `/irpf/:cpf` | `irpf-cpf` | `cpf` |

Os filtros opcionais de busca por nome/endereço e funcionários são enviados como query params somente quando preenchidos. Campos de senha, token, segredo e cookie de `/leaked-logins` são removidos antes de a resposta chegar ao cache de resultados; campos de login e URL permanecem.

`GET /status` é um endpoint operacional e não entra na carteira de créditos. O Big Eye o expõe como `GET /athenas/status` para usuários autenticados e também como `GET /admin/providers/athenas/status`, protegido por `AdminGuard`. A documentação também menciona `/status/:endpointId`, mas não descreve o contrato dessa rota, então ela não é chamada.

Os seguintes módulos do catálogo permanecem desabilitados porque a Athenas não fornece uma rota equivalente: `cpf-endereco`, `cpf-telefones`, `cpf-processos`, `cpf-renda`, `cpf-beneficios`, `placa-completa`, os submódulos de leilão/multas/restrições/proprietário de placa, `cnpj-completo`, os submódulos de sócios/endereço/Simples/protestos/processos de CNPJ e busca por usuário de rede social. As rotas de veículo e CNPJ da Athenas devolvem uma resposta completa por consulta, sem endpoints separados para esses recortes.

## Primeiro ambiente local

Crie o `.env` na raiz e preencha as credenciais. Como `pnpm --filter` executa cada comando dentro da pasta do workspace, exporte as variáveis da raiz em cada terminal antes de rodar Prisma ou iniciar um serviço:

```bash
cp .env.example .env
set -a
source .env
set +a
docker compose up -d
pnpm install
pnpm --filter @big-eye/core db:test:prepare
pnpm --filter @big-eye/core db:migrate
pnpm --filter @big-eye/core db:seed
```

O fixture `db:test:prepare` cria uma tabela mínima `auth.users` apenas no banco local `bigeye`, para a migração do trigger funcionar. Nunca execute esse comando apontando para um banco remoto.

Com banco e dependências prontos, `npm run dev` na raiz carrega o `.env` e inicia API, worker e web. `Ctrl+C` encerra os três serviços.

O seed cria os três pacotes padrão. Em ambiente não produtivo também cria o perfil admin `admin@big-eye.local`; ele não cria uma conta correspondente no Supabase Auth.

## Migrações

### Antes do deploy

1. Confirme que o artefato foi construído com Node 22 e que o lockfile usado é o mesmo da revisão publicada.
2. Confirme `DATABASE_URL` e `DIRECT_URL` no ambiente alvo. O comando de migração usa o workspace `@big-eye/core` e a `DIRECT_URL` configurada pelo Prisma.
3. Faça backup ou confirme o ponto de restauração do banco conforme a política do provedor.
4. Verifique o estado localmente com `pnpm --filter @big-eye/core exec prisma migrate status`.
5. Publique a API. O `railway.json` executa `pnpm --filter @big-eye/core db:migrate` no pre-deploy e impede o start se o comando falhar.
6. Confirme `/ready`, a versão publicada e os logs de inicialização antes de liberar tráfego.

Para uma execução manual controlada:

```bash
pnpm --filter @big-eye/core db:migrate
```

Não use `prisma migrate reset` em staging ou produção. Não edite uma migração já aplicada; crie uma nova migração compatível. Um rollback de aplicação só é seguro quando o schema anterior continua aceito. O Prisma não deve receber uma migração de downgrade improvisada.

### Evidência mínima de release

Registre a revisão Git, a imagem ou deployment id, o resultado do pre-deploy, o resultado de `/ready` e o estado de `prisma migrate status`. Push, build, migração, healthcheck e fluxo autenticado são evidências independentes.

## Webhooks de pagamento

O endpoint é `POST /webhooks/payments/:provider`; no ambiente fake, use `/webhooks/payments/fake`. O corpo precisa ser enviado sem alteração porque a assinatura HMAC usa o raw body. O header obrigatório do provider fake é `x-fake-signature`, calculado com `FAKE_PAYMENT_SECRET` e SHA-256 hexadecimal.

O processamento é idempotente pelo `providerEventId` e pelo lançamento de compra. Um webhook repetido pode responder sucesso sem creditar novamente. Eventos fora de ordem ou pagamentos expirados não devem aumentar o saldo.

Ao investigar um pagamento:

1. Guarde o `providerEventId`, `providerPaymentId` e o horário do evento.
2. Consulte o registro `Payment` e o `WebhookEvent` correspondente.
3. Confirme se existe uma única `CreditTransaction` de compra.
4. Reenvie o evento pelo provider somente depois de confirmar a assinatura e o payload.
5. Não ajuste `Wallet.balance` diretamente; use o fluxo idempotente do pagamento ou um ajuste administrativo auditado.

## Consultas e filas

Consultas `sync` terminam no request da API. Consultas `async` são enfileiradas no BullMQ, processadas pelo worker e notificadas pelo Redis/SSE. O resultado fica no cache por `RESULT_TTL_SECONDS`; o banco guarda estado e metadados, não o payload do resultado. O input validado é transitório enquanto a consulta pode ser executada ou reenfileirada e é removido ao chegar a um estado terminal; para retry administrativo, uma cópia privada fica no Redis por no máximo 24 horas.

Quando uma consulta fica parada:

1. Verifique `/health` e `/ready` da API.
2. Verifique a conectividade e o uso de memória do Redis.
3. Verifique logs do worker e o backlog das filas `query-run`, `query-poll` e `reconcile`.
4. Confirme no banco o `status`, `nextPollAt`, `errorCode` e timestamps da consulta.
5. Reinicie apenas o worker afetado depois de preservar os logs do job.
6. Deixe a reconciliação tratar estados antigos; não altere status nem ledger com SQL manual.

Se a consulta estiver `succeeded` e o cache tiver expirado, a resposta pode conter `resultExpired: true`. Isso é esperado: informe o usuário e peça uma nova consulta. Não tente reconstruir o payload a partir de logs.

Se o provider falhar, o worker deve concluir a consulta como `failed`/`refunded` conforme o fluxo de créditos. Valide que há uma única transação de reembolso e que o saldo voltou ao valor esperado.

## API indisponível

1. Chame `/health` para separar processo parado de dependência indisponível.
2. Chame `/ready`; falha nesse endpoint indica problema de acesso ao banco.
3. Verifique logs de boot, erro de configuração Zod, conexão Postgres e Redis.
4. Confirme que `WEB_ORIGIN` contém a origem publicada e que o domínio aponta para o deployment correto.
5. Se o processo estiver reiniciando, pare de promover novas revisões e preserve o deployment id e os logs.

`/health` é público e só confirma o processo. `/ready` consulta Postgres e é o healthcheck configurado na Railway.

## Incidentes de autenticação e autorização

JWTs são verificados pelo JWKS do Supabase e o perfil é lido no Postgres. Em caso de 401, confirme validade, audience `authenticated`, `SUPABASE_JWKS_URL` e relógio do ambiente. Em caso de 403, consulte o `role`/`status` do perfil. Não desative os guards para contornar um incidente.

Não registre tokens, emails, CPF, telefone, raw webhook ou `SUPABASE_SERVICE_ROLE_KEY` nos logs. Ao abrir um ticket, use ids técnicos e timestamps.

## Rollback e encerramento

Para uma regressão de aplicação, faça rollback do deployment mantendo o banco no estado atual quando a migração for compatível. Não faça rollback cego depois de uma migração destrutiva. Para encerrar um incidente, registre causa, revisão, comandos executados, impacto, duração e evidência de recuperação em `/health`, `/ready`, saldo e webhook/query afetados.
