import "server-only";

export type EnableBankingCredentials = { applicationId: string; privateKeyPem: string };

/** Throws with a clear message if the two required env vars aren't set —
 * callers see this as a clean action error, not an opaque crypto failure. */
export function getEnableBankingCredentials(): EnableBankingCredentials {
  const applicationId = process.env.ENABLE_BANKING_APPLICATION_ID;
  const privateKeyB64 = process.env.ENABLE_BANKING_PRIVATE_KEY_B64;
  if (!applicationId || !privateKeyB64) {
    throw new Error("Enable Banking isn't configured — missing ENABLE_BANKING_APPLICATION_ID / ENABLE_BANKING_PRIVATE_KEY_B64.");
  }
  return { applicationId, privateKeyPem: Buffer.from(privateKeyB64, "base64").toString("utf8") };
}
