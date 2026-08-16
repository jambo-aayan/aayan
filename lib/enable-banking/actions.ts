"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { enableBankingFetch } from "./client";
import { ENABLE_BANKING_STATE_COOKIE } from "./state-cookie";

export type StartAuthResult = { ok: true; url: string } | { ok: false; error: string };

/** How long to request the linked-account consent for. Enable Banking's own
 * session response doesn't echo this back (see docs/research/enable-banking-api.md),
 * so this requested value also becomes the working "valid until" we store. */
const REQUESTED_CONSENT_DAYS = 90;

const STATE_COOKIE_MAX_AGE_SECONDS = 600; // 10 minutes — plenty for a bank-login redirect round trip

/**
 * Kicks off an Enable Banking authorization for one ASPSP (bank) and returns
 * the URL to send the PSU's browser to.
 *
 * The `state` sent to Enable Banking is a bare random nonce — on its own
 * that's not proof of anything, since a `code`/`state` pair can leak via
 * browser history, a Referer header, or an access log, and be replayed. The
 * nonce (plus which ASPSP it's for) is also stashed in a short-lived httpOnly
 * cookie scoped to the callback path; the callback compares the two and
 * only proceeds on a match, which is the standard OAuth `state` CSRF
 * mitigation — the bare-nonce comparison the earlier version of this
 * function skipped.
 */
export async function startEnableBankingAuth(aspspName: string, aspspCountry: string): Promise<StartAuthResult> {
  try {
    const app = await enableBankingFetch<{ redirect_urls: string[] }>("/application");
    const redirectUrl = app.redirect_urls[0];
    if (!redirectUrl) {
      return { ok: false, error: "No redirect URL registered on the Enable Banking application." };
    }

    const nonce = randomUUID();
    const validUntil = new Date(Date.now() + REQUESTED_CONSENT_DAYS * 24 * 60 * 60 * 1000);
    const result = await enableBankingFetch<{ url: string }>("/auth", {
      method: "POST",
      body: JSON.stringify({
        access: { valid_until: validUntil.toISOString() },
        aspsp: { name: aspspName, country: aspspCountry },
        state: nonce,
        redirect_url: redirectUrl,
        psu_type: "personal",
      }),
    });

    const store = await cookies();
    store.set(ENABLE_BANKING_STATE_COOKIE, JSON.stringify({ nonce, aspspName, aspspCountry }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/api/finance/enable-banking/callback",
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    });

    return { ok: true, url: result.url };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Couldn't start bank authorization." };
  }
}
