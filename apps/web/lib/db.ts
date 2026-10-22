import { createTenantDatabase, type TenantDatabase } from "@riskflow/database";
import { assertRuntimeSecrets } from "@riskflow/shared";

let database: TenantDatabase | undefined;
let secretsChecked = false;

export function getAppDatabase(): TenantDatabase {
  if (!secretsChecked) {
    assertRuntimeSecrets();
    secretsChecked = true;
  }
  const url =
    process.env.DATABASE_URL_APP ??
    "postgresql://riskflow_app:riskflow_app_dev_only@127.0.0.1:5432/riskflow";
  database ??= createTenantDatabase(url);
  return database;
}
