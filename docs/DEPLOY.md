# Deploy

Staging and production stay separate. Both set `APP_ENV` to `staging` or `production`. Local development uses `APP_ENV=development`.

## Environments

| Variable | Staging | Production |
|---|---|---|
| `APP_ENV` | `staging` | `production` |
| `AUTH_URL` | https staging | https production |
| `AUTH_ISSUER` | organization IdP | organization IdP |
| `DATABASE_URL` | owner/migrator | owner/migrator |
| `DATABASE_URL_APP` | `riskflow_app` | `riskflow_app` |
| `DATABASE_URL_WORKER` | `riskflow_worker` | `riskflow_worker` |
| `RATE_LIMIT_TRUST_PROXY` | `true` behind a reverse proxy | `true` behind a reverse proxy |

Production rejects secrets containing `dev_only` and requires `AUTH_URL` over HTTPS. `AUTH_SECRET` and `OBJECT_SIGNING_SECRET` must be at least 32 characters.

## Checklist

1. Create database roles without `BYPASSRLS` (`riskflow_app`, `riskflow_worker`).
2. Run migrations as owner: `pnpm db:migrate`.
3. Do not run local `pnpm db:seed` against production.
4. Put secrets in the platform secret store. Do not commit `.env`.
5. Build: `pnpm build`.
6. Start web (`next start`) and worker (`pnpm --filter @riskflow/worker start`).
7. Check `GET /health` (liveness) and `GET /ready` (postgres + redis).
8. Confirm reverse proxy: TLS, HSTS, IP rate limit, log collection.
9. Run `pnpm ops:backup` and `pnpm ops:restore-drill` before go-live. Local dump is a logical JSON snapshot as owner (embedded-postgres does not ship `pg_dump`). In production set `PGBIN` and use native `pg_dump -Fc` outside the reverse proxy.
10. Rehearse rollback: restore the previous artefact and, if needed, `pg_restore`.

Docker is not required. Object storage is private S3-compatible or the local disk adapter.

## Monitoring

There is no Sentry or OpenTelemetry. Monitoring is `GET /health`, `GET /ready`, process logs, `Server-Timing`, and reverse-proxy 4xx/5xx alerts. Alert on `/ready` 503 and worker `failed` logs.

## Rollback

1. Stop new worker jobs.
2. Restore the previous web/worker version.
3. If the schema is not backward compatible, restore the database from the latest `pg_dump -Fc` after a side-database drill first.
4. Confirm `/ready` and sign-in for both pilot tenants.
