# Julkaisu

Staging ja tuotanto pidetään erillään. Molemmissa `APP_ENV` on `staging` tai `production`. Paikallinen kehitys käyttää `APP_ENV=development`.

## Ympäristöt

| Muuttuja | Staging | Production |
|---|---|---|
| `APP_ENV` | `staging` | `production` |
| `AUTH_URL` | https-staging | https-tuotanto |
| `AUTH_ISSUER` | organisaation IdP | organisaation IdP |
| `DATABASE_URL` | owner/migraattori | owner/migraattori |
| `DATABASE_URL_APP` | `riskflow_app` | `riskflow_app` |
| `DATABASE_URL_WORKER` | `riskflow_worker` | `riskflow_worker` |
| `RATE_LIMIT_TRUST_PROXY` | `true` käänteisproxylla | `true` käänteisproxylla |

Tuotanto hylkää salaisuudet, joissa on merkkijono `dev_only`, ja vaatii `AUTH_URL`-osoitteen HTTPS:llä. `AUTH_SECRET` ja `OBJECT_SIGNING_SECRET` vähintään 32 merkkiä.

## Checklist

1. Luo tietokantaroolit ilman `BYPASSRLS`-oikeutta (`riskflow_app`, `riskflow_worker`).
2. Aja migraatiot owner-roolilla: `pnpm db:migrate`.
3. Älä aja paikallista `pnpm db:seed` -seed-dataa tuotantoon.
4. Aseta salaisuudet alustan secret storeen. Älä commitoi `.env`-tiedostoa.
5. Rakenna: `pnpm build`.
6. Käynnistä web (`next start`) ja worker (`pnpm --filter @riskflow/worker start`).
7. Tarkista `GET /health` (liveness) ja `GET /ready` (postgres + redis).
8. Varmista käänteisproxy: TLS, HSTS, IP-pohjainen rate limit, lokien keruu.
9. Aja `pnpm ops:backup` ja `pnpm ops:restore-drill` ennen go-livea. Paikallinen dump on looginen JSON owner-roolilla (embedded-postgres ei sisällä `pg_dump`-asiakasta). Tuotannossa aseta `PGBIN` ja käytä native `pg_dump -Fc` -kopiota käänteisproxyn ulkopuolella.
10. Harjoittele rollback: palauta edellinen artefakti ja tarvittaessa `pg_restore`.

Dockeria ei vaadita. Objektisäilö on yksityinen S3-yhteensopiva tai paikallinen levyadapteri.

## Monitorointi

Sentryä ja OpenTelemetryä ei ole. Seuranta on `GET /health`, `GET /ready`, prosessilokit, `Server-Timing` ja käänteisproxyn 4xx/5xx-hälytykset. Hälytys kytketään `/ready` 503 -vastauksiin ja workerin `failed`-lokeihin.

## Rollback

1. Pysäytä uudet worker-jobit.
2. Palauta edellinen web/worker-versio.
3. Jos skeema ei ole taaksepäin yhteensopiva, palauta tietokanta viimeisimmästä `pg_dump -Fc` -tiedostosta sivukannan drill-menettelyllä ensin.
4. Vahvista `/ready` ja kahden pilottitenantin kirjautuminen.
