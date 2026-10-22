# Tietoturvapoikkeaman runbook

## Luokittelu

- P1: tenant-eristyksen rikkoutuminen, tietovuoto, autentikoinnin ohitus
- P2: palvelun katko, massamittainen 500, worker jumissa
- P3: yksittäisen käyttäjän regressio

## Ensimmäiset 15 minuuttia

1. Vahvista havainto `/health`, `/ready` ja lokeista. Älä paljasta ympäristömuuttujia vastauksissa.
2. Tallenna `x-request-id` ja aikaleima.
3. Jos epäillään tenant-vuotoa: katkaise kirjoitukset (maintenance / worker stop), älä korjaa dataa SQL-päivityksellä auditiin.
4. Ilmoita alustan omistajalle. Tenant-adminille kerrotaan vaikutus, ei toisen tenantin tietoja.

## Eristys ja toipuminen

- Palauta edellinen tunnettu versio (`docs/DEPLOY.md`).
- Säilytä `audit_events` (append-only). App/worker eivät voi DELETE/UPDATE.
- Liitteet: älä jaa allekirjoitettuja URL:ia lokeihin; ne vanhenevat.
- Rate limit 429 ei ole poikkeama, mutta äkillinen piikki on.

## Jälkitoimet

1. Kirjaa aikajana, vaikutetut tenantit (slug, ei sisältöä) ja korjaus.
2. Aja RLS-negatiiviset testit: `pnpm --filter @riskflow/database test`.
3. Päivitä `docs/PENTEST.md` jos kontrolli puuttui.
4. Älä väitä sertifiointia (ISO 27001 tms.) tämän runbookin perusteella.
