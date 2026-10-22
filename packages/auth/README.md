# @riskflow/auth

Auth.js-istunnon ja tenant-jäsenyyden palvelinlogiikka. Paketti ei riipu Reactista eikä vie valeistuntoja.

- Identiteetti (`authSubject`) ei tarkoita tenant-pääsyä.
- `loadTenantAccess` palauttaa `null`, jos jäsenyys puuttuu tai on peruttu.
- Alustan ylläpitäjä (`platformAdmin`) ei saa automaattista lukuoikeutta tenant-dataan.
- Kutsutokenit tallennetaan vain tiivisteinä.
- Paikallinen kehitys käyttää `http://127.0.0.1:3000` (ei `localhost`) OIDC `redirect_uri`-osoitteena, jotta Auth.js ja oidc-provider pysyvät samassa originissa.
