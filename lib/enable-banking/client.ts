import "server-only";
import { signEnableBankingJwt } from "./jwt";
import { getEnableBankingCredentials } from "./env";

const BASE_URL = "https://api.enablebanking.com";
const JWT_TTL_SECONDS = 3600;

function jwt(): string {
  const { applicationId, privateKeyPem } = getEnableBankingCredentials();
  const iat = Math.floor(Date.now() / 1000);
  return signEnableBankingJwt(applicationId, privateKeyPem, { iat, exp: iat + JWT_TTL_SECONDS });
}

/** A thin, authenticated fetch wrapper around Enable Banking's API — every
 * call gets a freshly-signed JWT (they're cheap to mint, no reason to cache
 * one past its natural request). Throws on a non-2xx response with the
 * response body included, since Enable Banking's error bodies are the only
 * place a PSD2-level rejection reason shows up. */
export async function enableBankingFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${jwt()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!response.ok) {
    const body = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(`Enable Banking API ${response.status} on ${path}: ${body}`);
  }
  return response.json() as Promise<T>;
}
