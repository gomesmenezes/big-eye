ALTER TABLE "queries" ADD COLUMN "idempotency_key" TEXT;

CREATE UNIQUE INDEX "queries_user_id_idempotency_key_key"
ON "queries"("user_id", "idempotency_key");
