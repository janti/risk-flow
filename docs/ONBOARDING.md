# Ylläpitäjän onboarding

Kaksi pilottitenanttia paikallisessa ja staging-ympäristössä: **acme** ja **globex**. Tuotannon käyttäjiä ei lisätä SQL:llä.

## Alustan bootstrap

1. Migraatiot owner-roolilla.
2. Paikallinen/staging-seed (`pnpm db:seed`) luo tenantit, org-yksiköt, roolit ja esimerkkiriskit. Tuotannossa tenant luodaan alustan DBA-toimenpiteenä; jäsenet lisätään käyttöliittymästä.
3. IdP:ssä luodaan käyttäjät. RiskFlow provisionoi `users`-rivin OIDC-kirjautumisella.

## Tenant-admin (ei suoria tietokantamuokkauksia)

1. Kirjaudu IdP:llä.
2. Valitse tenant `/tenants`.
3. Asetukset → käyttäjät: lisää jäsen `mode: direct` tai lähetä kutsu.
4. Tarkista organisaatiopuu, locale ja branding.
5. Varmista, että entitlementit tulevat alustalta. Tenant-admin ei voi myöntää itselleen moduuleja.

## Pilotit acme ja globex

| Tenant | Esimerkkitunnus (vain paikallinen IdP) | Rooli |
|---|---|---|
| acme | `acme-admin` | tenant-admin |
| globex | `globex-admin` | tenant-admin |

Ristiin-pääsy on kielletty: acme-admin näkee globexin 404:nä. Alustan ylläpitäjällä ei ole tenant-liiketoimintadataa.

## Offboarding

1. `pnpm ops:tenant-export <slug>`
2. `TENANT_OFFBOARD_CONFIRM=<slug> pnpm ops:tenant-offboard <slug>`
3. Tenant merkitään `offboarded`, jäsenyydet `revoked`. Rivien hard delete on erillinen juridinen/DBA-vaihe.
