import { createSign } from "node:crypto";

export type EnableBankingJwtClaims = { iat: number; exp: number };

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Signs an Enable Banking API JWT — RS256, `kid` set to the Application ID,
 * `iss`/`aud` fixed literals per Enable Banking's own convention (confirmed
 * against their official code samples, see docs/research/enable-banking-api.md).
 */
export function signEnableBankingJwt(
  applicationId: string,
  privateKeyPem: string,
  claims: EnableBankingJwtClaims
): string {
  const header = { typ: "JWT", alg: "RS256", kid: applicationId };
  const payload = { iss: "enablebanking.com", aud: "api.enablebanking.com", ...claims };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = createSign("RSA-SHA256").update(signingInput).sign(privateKeyPem);
  return `${signingInput}.${base64url(signature)}`;
}
