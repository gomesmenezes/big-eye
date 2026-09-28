-- A provider payment identifier is the external identity used by webhook
-- processing. It must not resolve to more than one local payment for the
-- same provider.
DROP INDEX "payments_provider_provider_payment_id_idx";

CREATE UNIQUE INDEX "payments_provider_provider_payment_id_key"
ON "payments"("provider", "provider_payment_id");
