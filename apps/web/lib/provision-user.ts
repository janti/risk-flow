import { claimOrCreateUser } from "@riskflow/auth";
import { getAppDatabase } from "./db";

export async function provisionUser(input: {
  authSubject: string;
  email: string;
  displayName: string;
}): Promise<{ id: string; authSubject: string }> {
  try {
    return await claimOrCreateUser(getAppDatabase(), input);
  } catch (error) {
    console.error("User provisioning failed.", error);
    throw error;
  }
}
