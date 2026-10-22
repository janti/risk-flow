# Julkaisutiedot

## Sprint 12 — pilottivalmis MVP

- Staging/tuotantoerottelu `APP_ENV`-muuttujalla ja salaisuuksien tarkistus.
- `GET /ready` (PostgreSQL + Redis). `GET /health` pysyy liveness-tarkistuksena.
- Mutaatioiden ja kirjautumisen in-process rate limit (`429 rate_limited`, `Retry-After`).
- Suojaotsikot: CSP, HSTS tuotannossa, COOP/CORP.
- Varmuuskopio ja restore-drill: `pnpm ops:backup`, `pnpm ops:restore-drill`.
- Tenant-vienti ja offboarding ilman app-roolin DELETE-oikeutta auditiin.
- Audit-retention on owner-roolin DBA-skripti (`pnpm ops:audit-retention`).
- Operatiiviset ohjeet: deploy, onboarding, incident, pentest, go/no-go.

Sovellus ei ole sertifioitu ISO 27001/45001/31000 -vaatimusten täyttäjäksi. Standardiohjeet rekisterissä ovat ohjaavia, eivät audit-mappingia.

## Aiemmat sprintit

Sprintit 01–11: kuori, RLS, Auth.js, rekisteri, arvioinnit, toimenpiteet, dashboardit, lomakkeet, moduulit, liitteet, UX/saavutettavuus.
