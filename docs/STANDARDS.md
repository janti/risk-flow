# Standardiohjeet

RiskFlow ei toteuta compliance-mapping-moduulia eikä kontrollikirjastoa (MVP:n ulkopuolella). Julkiset riskinhallinnan periaatteet on kytketty olemassa olevaan rekisteriin, arviointiin ja käsittelyyn kategoriakohtaisena ohjeena.

Ohje ei ole sertifiointi eikä korvaa virallista standarditekstiä tai lakia.

## Lähteet

| Lähde | Käyttö sovelluksessa |
|---|---|
| [ISO 31000:2018](https://www.iso.org/standard/65694.html) | Prosessi (konteksti → arviointi → käsittely → seuranta) ja strategiat avoid / reduce / share / accept. [SFS-esittely](https://sfs.fi/standardeista/tutustu-standardeihin/suositut-standardit/iso-31000-riskienhallinta/). |
| [ISO 45001:2018](https://www.iso.org/standard/63787.html) 8.1.2 | Työturvallisuuden kontrollihierarkia Operations/OHS-kategoriassa. |
| [Työsuojeluhallinto, vaarojen arviointi](https://tyosuojelu.fi/tyosuojelu-tyopaikalla/vaarojen-arviointi) | Todennäköisyys × seuraus -asteikko ja työnantajan velvollisuus arvioida vaarat. |
| [Työturvallisuuskeskus, vaarojen arviointi](https://ttk.fi/tyoturvallisuus/vastuut-tyopaikalla/vaarojen-arviointi/) | Työturvallisuuden tunnistuspohja Operations/OHS-kategoriassa. |
| [Työturvallisuuslaki 738/2002 10 §](https://www.ttl.fi/teemat/tyoturvallisuus/tyoturvallisuuslain-soveltamisopas/tyonantajan-yleiset-velvollisuudet/10-ss-tyon-vaarojen-selvittaminen-ja-arviointi) | Vaarojen selvittäminen, poistaminen ja jäljelle jäävän riskin arviointi. |
| [ISO/IEC 27001:2022](https://www.iso.org/standard/27001) 6.1 ja Annex A -teemat | Tietoturvariskin tunnistus (CIA) ja neljä kontrolliteemaa, ei 93 kontrollin kirjastoa. |
| [ISO/IEC 27005:2022](https://www.iso.org/standard/80585.html) | Tietoturvariskiprosessi ISO 31000:n päälle. |
| [NIST CSF 2.0](https://www.nist.gov/cyberframework) | Govern, Identify, Protect, Detect, Respond, Recover käsittelyvihjeenä. |

## Miten ohjeita käytetään

- Uusi/muokkaa riski: kategoria valitaan ennen kuvausta. Tunnistuskysymykset ja kuvauksen ohjepohja vaihtuvat kategorian mukaan (`OPS` → työturvallisuus, `CYBER` → tietoturva). Uudessa riskissä tyhjä kuvaus täytetään pohjalla; nappi *Käytä ohjepohjaa kuvauksessa* kirjoittaa pohjan kenttään.
- Arviointi: todennäköisyys- ja vaikutusvalinnat käyttävät työsuojelu-/ISO-asteikkoa; perustelun paikkamerkki vaatii lähteen ja jäännösriskin.
- Käsittely: ISO 31000 -strategiatekstit plus kategoriakohtainen kontrolliohje (esim. ISO 45001 -hierarkia). Hyväksynnän perustelun paikkamerkki on ISO 31000 -accept-ohje.

Katalogi: `packages/risk-engine/src/guidance.ts`.
