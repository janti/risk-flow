import express from "express";
import net from "node:net";
import Provider from "oidc-provider";

const PORT = Number(process.env.OIDC_PORT ?? 3300);
const ISSUER = process.env.AUTH_ISSUER ?? `http://127.0.0.1:${PORT}`;
const CLIENT_ID = process.env.AUTH_CLIENT_ID ?? "riskflow-web";
const CLIENT_SECRET = process.env.AUTH_CLIENT_SECRET ?? "riskflow_oidc_dev_only";
const APP_ORIGIN = process.env.AUTH_URL ?? "http://127.0.0.1:3000";
const LOCAL_PASSWORD = "riskflow_dev_only";

const ACCOUNTS = {
  "acme-admin": { email: "admin@acme.example", name: "Acme Admin", password: LOCAL_PASSWORD },
  "acme-manager": { email: "manager@acme.example", name: "Acme Manager", password: LOCAL_PASSWORD },
  "acme-employee": { email: "employee@acme.example", name: "Acme Employee", password: LOCAL_PASSWORD },
  "acme-risk-manager": {
    email: "risk-manager@acme.example",
    name: "Acme Risk Manager",
    password: LOCAL_PASSWORD,
  },
  "acme-revoked": { email: "revoked@acme.example", name: "Acme Revoked", password: LOCAL_PASSWORD },
  "globex-admin": { email: "admin@globex.example", name: "Globex Admin", password: LOCAL_PASSWORD },
  "globex-manager": { email: "manager@globex.example", name: "Globex Manager", password: LOCAL_PASSWORD },
  "globex-employee": { email: "employee@globex.example", name: "Globex Employee", password: LOCAL_PASSWORD },
  "globex-risk-manager": {
    email: "risk-manager@globex.example",
    name: "Globex Risk Manager",
    password: LOCAL_PASSWORD,
  },
  "platform-admin": { email: "platform@riskflow.example", name: "Platform Admin", password: LOCAL_PASSWORD },
};

await main();

async function main() {
  if (await isPortOpen(PORT)) {
    console.info(`OIDC already listening on ${PORT}.`);
    return;
  }

  const oidc = new Provider(ISSUER, {
    clients: [
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uris: [
          `${APP_ORIGIN}/api/auth/callback/oidc`,
          "http://127.0.0.1:3000/api/auth/callback/oidc",
          "http://localhost:3000/api/auth/callback/oidc",
        ],
        post_logout_redirect_uris: [APP_ORIGIN, "http://127.0.0.1:3000", "http://localhost:3000"],
        grant_types: ["authorization_code"],
        response_types: ["code"],
        token_endpoint_auth_method: "client_secret_post",
      },
    ],
    conformIdTokenClaims: false,
    pkce: { required: () => true, methods: ["S256"] },
    cookies: {
      keys: [process.env.OIDC_COOKIE_KEY ?? "riskflow_oidc_cookie_dev_only_min_32ch"],
    },
    features: {
      devInteractions: { enabled: false },
      rpInitiatedLogout: { enabled: true },
    },
    claims: {
      openid: ["sub"],
      email: ["email", "email_verified"],
      profile: ["name"],
    },
    findAccount: async (_ctx, id) => {
      const account = ACCOUNTS[id];
      if (!account) {
        return undefined;
      }
      return {
        accountId: id,
        async claims() {
          return {
            sub: id,
            email: account.email,
            email_verified: true,
            name: account.name,
          };
        },
      };
    },
    interactions: {
      url: (_ctx, interaction) => `/interaction/${interaction.uid}`,
    },
  });

  oidc.proxy = true;
  oidc.on("grant.error", (ctx, error) => {
    console.error("OIDC grant.error", {
      detail: error.error_detail,
      error: error.error,
      redirect_uri: ctx.oidc?.params?.redirect_uri,
      hasCode: Boolean(ctx.oidc?.params?.code),
      hasVerifier: Boolean(ctx.oidc?.params?.code_verifier),
    });
  });
  oidc.on("server_error", (_ctx, error) => {
    console.error("OIDC server_error", error);
  });

  const parseLoginBody = express.urlencoded({ extended: false });
  const app = express();

  app.get("/interaction/:uid", async (req, res, next) => {
    try {
      await oidc.interactionDetails(req, res);
      res.status(200).type("html").send(loginPage(req.params.uid, Boolean(req.query.error)));
    } catch (error) {
      next(error);
    }
  });

  app.post("/interaction/:uid/login", parseLoginBody, async (req, res, next) => {
    try {
      const login = String(req.body.login ?? "");
      const password = String(req.body.password ?? "");
      const account = ACCOUNTS[login];
      if (!account || account.password !== password) {
        res.redirect(`/interaction/${req.params.uid}?error=1`);
        return;
      }

      const details = await oidc.interactionDetails(req, res);
      const grant = new oidc.Grant({
        accountId: login,
        clientId: String(details.params.client_id),
      });
      grant.addOIDCScope("openid email profile");
      const grantId = await grant.save();
      await oidc.interactionFinished(
        req,
        res,
        { login: { accountId: login }, consent: { grantId } },
        { mergeWithLastSubmission: false },
      );
    } catch (error) {
      next(error);
    }
  });

  app.use(oidc.callback());

  await new Promise((resolve) => {
    app.listen(PORT, "127.0.0.1", () => resolve(undefined));
  });
  console.info(`OIDC issuer ${ISSUER}`);
}

function loginPage(uid, invalid) {
  const options = Object.entries(ACCOUNTS)
    .map(([id, account]) => `<option value="${id}">${account.name} (${account.email})</option>`)
    .join("");
  return `<!doctype html>
<html lang="fi">
  <head>
    <meta charset="utf-8" />
    <title>RiskFlow paikallinen OIDC</title>
    <style>
      body { font-family: sans-serif; max-width: 32rem; margin: 4rem auto; }
      label { display: block; margin-top: 1rem; }
      select, input, button { width: 100%; padding: 0.5rem; margin-top: 0.25rem; }
      .error { color: #b91c1c; }
    </style>
  </head>
  <body>
    <h1>Paikallinen OIDC-kirjautuminen</h1>
    <p>Tämä on oikea OIDC Authorization Code -palvelin paikalliseen kehitykseen. Salasana on <code>riskflow_dev_only</code>.</p>
    ${invalid ? '<p class="error" data-testid="oidc-error">Virheellinen tunnus tai salasana.</p>' : ""}
    <form method="post" action="/interaction/${uid}/login">
      <label>Tunnus
        <select name="login" data-testid="oidc-login">${options}</select>
      </label>
      <label>Salasana
        <input type="password" name="password" data-testid="oidc-password" value="riskflow_dev_only" />
      </label>
      <button type="submit" data-testid="oidc-submit">Kirjaudu</button>
    </form>
  </body>
</html>`;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}
