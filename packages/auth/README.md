# @riskflow/auth

Server logic for the Auth.js session and tenant membership. The package does not depend on React and does not export fake sessions.

- Identity (`authSubject`) does not imply tenant access.
- `loadTenantAccess` returns `null` if membership is missing or revoked.
- A platform administrator (`platformAdmin`) does not get automatic read access to tenant data.
- Invite tokens are stored as hashes only.
- Local development uses `http://127.0.0.1:3000` (not `localhost`) as the OIDC `redirect_uri` so Auth.js and oidc-provider stay on the same origin.
