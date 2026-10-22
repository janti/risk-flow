# Go / no-go (Sprint 12)

Päätös: **ehdollinen GO suljetulle pilotille**. Ei GO avoimelle internet-tuotannolle ennen riippumatonta pentestiä.

RiskFlow **ei väitä** ISO 27001-, ISO 45001- tai muuta compliance-sertifiointia.

## Hyväksymiskriteerit

| Kriteeri | Tulos |
|---|---|
| Ei tiedossa olevia kriittisiä/high-koodihaavoittuvuuksia | Täyttyy kontrollilistan perusteella; ulkoista pentestiä ei ole |
| Backup restore todistettu | `pnpm ops:restore-drill` (canary-rivin poisto ja palautus dumpista) |
| Rollback harjoiteltu | Palautus edelliseen artefaktiin + dump, ks. `docs/DEPLOY.md` |
| Kaksi pilottitenanttia ilman suoria DB-jäsenlisäyksiä | acme ja globex; käyttäjät UI/OIDC-kutsulla tai suoralla lisäyksellä |

## GO suljetulle pilotille jos

- Stagingissa `/health` ja `/ready` ovat vihreät
- RLS- ja e2e-testit vihreät
- Restore-drill on ajettu onnistuneesti
- Salaisuudet eivät sisällä `dev_only`
- Kaksi tenanttia kirjautuvat ristiin-estolla

## NO-GO jos

- Tenant-eristys hajoaa
- `/ready` paljastaa salaisuuksia tai jää 503:een ilman syytä
- Varmuuskopiota ei voi palauttaa
- Tuotantoon yritetään paikallista seed-dataa tai `dev_only`-salaisuuksia
