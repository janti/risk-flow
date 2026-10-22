-- User UI locale is stored on the identity row, not on the tenant.

ALTER TABLE "users"
    ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'fi';

ALTER TABLE "users"
    ADD CONSTRAINT "users_locale_check" CHECK ("locale" IN ('fi', 'sv', 'en'));
