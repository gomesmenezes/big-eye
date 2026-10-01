-- Publish the retail credit offers and retire the original development packages.
UPDATE "credit_packages"
SET "active" = false,
    "updated_at" = CURRENT_TIMESTAMP
WHERE "slug" IN ('creditos-10', 'creditos-50', 'creditos-100');

INSERT INTO "credit_packages" ("slug", "credits", "price_cents", "currency", "active", "sort")
VALUES
    ('teste-5', 5, 490, 'BRL', true, 1),
    ('popular-1000', 1000, 3990, 'BRL', true, 2),
    ('avancado-5000', 5000, 9990, 'BRL', true, 3),
    ('pro-20000', 20000, 24990, 'BRL', true, 4)
ON CONFLICT ("slug") DO NOTHING;
