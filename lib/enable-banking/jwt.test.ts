import { generateKeyPairSync, createVerify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signEnableBankingJwt } from "./jwt";

function testKeyPair() {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

function base64urlDecode(segment: string): Buffer {
  const padded = segment.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64");
}

describe("signEnableBankingJwt", () => {
  it("produces a JWT with the header/claims Enable Banking's API expects", () => {
    const { privateKey } = testKeyPair();
    const jwt = signEnableBankingJwt("app-id-123", privateKey, { iat: 1000, exp: 4600 });
    const [headerB64, payloadB64] = jwt.split(".");

    const header = JSON.parse(base64urlDecode(headerB64).toString("utf8"));
    expect(header).toEqual({ typ: "JWT", alg: "RS256", kid: "app-id-123" });

    const payload = JSON.parse(base64urlDecode(payloadB64).toString("utf8"));
    expect(payload).toEqual({
      iss: "enablebanking.com",
      aud: "api.enablebanking.com",
      iat: 1000,
      exp: 4600,
    });
  });

  it("produces a signature verifiable against the matching public key", () => {
    const { publicKey, privateKey } = testKeyPair();
    const jwt = signEnableBankingJwt("app-id-123", privateKey, { iat: 1000, exp: 4600 });
    const [headerB64, payloadB64, signatureB64] = jwt.split(".");
    const signingInput = `${headerB64}.${payloadB64}`;

    const verifier = createVerify("RSA-SHA256");
    verifier.update(signingInput);
    const valid = verifier.verify(publicKey, base64urlDecode(signatureB64));
    expect(valid).toBe(true);
  });

  it("fails verification against a different key pair's public key", () => {
    const { privateKey } = testKeyPair();
    const { publicKey: otherPublicKey } = testKeyPair();
    const jwt = signEnableBankingJwt("app-id-123", privateKey, { iat: 1000, exp: 4600 });
    const [headerB64, payloadB64, signatureB64] = jwt.split(".");

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${headerB64}.${payloadB64}`);
    const valid = verifier.verify(otherPublicKey, base64urlDecode(signatureB64));
    expect(valid).toBe(false);
  });

  it("produces base64url output with no padding or unsafe characters", () => {
    const { privateKey } = testKeyPair();
    const jwt = signEnableBankingJwt("app-id-123", privateKey, { iat: 1000, exp: 4600 });
    expect(jwt).not.toMatch(/[+/=]/);
    expect(jwt.split(".")).toHaveLength(3);
  });
});
