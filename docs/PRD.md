# Tuotevaatimukset

RiskFlow on toimialariippumaton, tietokantapohjainen ja monitoiminen yritysriskien hallinnan SaaS.

## Ensimmäisen pilotti-MVP:n kyvykkyydet

- tenant voi luoda ja arvioida riskejä
- toimenpiteiden osoittaminen
- riskikäsittelyjen hyväksyntä
- roolikohtaiset dashboardit
- riskilomakkeiden räätälöinti
- oikeutettujen moduulien kytkeminen

Kaikki liiketoimintadata on tenant-eristettyä. Rutiininomainen tenant-konfiguraatio ei vaadi toimittajan työpanosta. Mallimäärittelyt ovat versionoitavia ensimmäisestä päivästä.

## Definition of done

Jokainen ominaisuus täyttää nämä ehdot:

- autentikointi ja tenant-jäsenyys pakotetaan palvelimella
- valtuutus tarkistetaan per operaatio ja tietue
- Zod-validointi, tyypitetyt virheet, listojen sivutus
- testit: positiivinen, kielletty, väärä tenant, virheellinen syöte
- audit-tapahtumat turvallisuus- ja liiketoimintakirjoituksille
- saavutettavuus: labelit, fokusjärjestys, näppäimistö, kontrasti, tyhjä/lataus/virhe
- typecheck, lint ja testit vihreinä; ei salaisuuksia repositoriossa

## Sprint 01 -toimitus

Käyttäjä voi avata proto-kuoren, vaihtaa teemaa ja navigoida paikkamerkkisivuille. Tunnistautumista, tenant-dataa tai valtuutusta ei luvata.

## MVP:n ulkopuolella

Visuaalinen työnkulkueditori, Dashboard Builder, julkiset API/webhookit, SAML/SCIM, kehittyneet compliance-mappingit, kolmannen osapuolen riski, BIA/BCM, tekoälyavustaja, kontrollikirjasto, erilliset tenant-tietokannat, white-label-domainit, raporttisuunnittelija ja yritysbilling. Arkkitehtuuri jättää niille tilaa, mutta niitä ei toteuteta ennenaikaisesti.
