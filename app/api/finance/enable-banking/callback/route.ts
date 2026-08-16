import { NextRequest, NextResponse } from "next/server";
import { enableBankingFetch } from "@/lib/enable-banking/client";
import { prisma } from "@/lib/prisma";
import { ENABLE_BANKING_STATE_COOKIE } from "@/lib/enable-banking/state-cookie";

const CONSENT_VALID_DAYS = 90;

function redirectWithError(request: NextRequest, error: string): NextResponse {
  const response = NextResponse.redirect(new URL(`/finances/link-bank?error=${error}`, request.url));
  response.cookies.delete(ENABLE_BANKING_STATE_COOKIE);
  return response;
}

/**
 * Where Enable Banking redirects the PSU's browser back to after they
 * authenticate with their bank. The user's own app session cookie is still
 * attached (this is a same-origin browser redirect, not a server-to-server
 * call), so no separate auth is needed here — the proxy gate already covers it.
 *
 * `state` is verified against the nonce stashed in a cookie by
 * startEnableBankingAuth, not just parsed — a `code`/`state` pair that leaked
 * or got replayed without ever going through that cookie is rejected rather
 * than silently creating a link.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieValue = request.cookies.get(ENABLE_BANKING_STATE_COOKIE)?.value;

  if (!code || !state || !cookieValue) {
    return redirectWithError(request, "missing_code");
  }

  let pending: { nonce: string; aspspName: string; aspspCountry: string };
  try {
    pending = JSON.parse(cookieValue);
  } catch {
    return redirectWithError(request, "state_invalid");
  }

  if (pending.nonce !== state) {
    return redirectWithError(request, "state_mismatch");
  }

  let session: { session_id: string; accounts: unknown };
  try {
    session = await enableBankingFetch("/sessions", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
  } catch {
    return redirectWithError(request, "session_failed");
  }

  try {
    await prisma.enableBankingLink.create({
      data: {
        aspspName: pending.aspspName,
        aspspCountry: pending.aspspCountry,
        sessionId: session.session_id,
        accounts: session.accounts as object,
        validUntil: new Date(Date.now() + CONSENT_VALID_DAYS * 24 * 60 * 60 * 1000),
      },
    });
  } catch {
    return redirectWithError(request, "save_failed");
  }

  const response = NextResponse.redirect(new URL("/finances/link-bank?linked=1", request.url));
  response.cookies.delete(ENABLE_BANKING_STATE_COOKIE);
  return response;
}
