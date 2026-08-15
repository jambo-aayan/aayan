import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session-cookie-name";

/**
 * Cheap, edge-level gate: only checks the session cookie is present, not that
 * it's still valid in the database — that authoritative check happens in the
 * protected layout, which runs in the Node.js runtime where Prisma works.
 * This just avoids serving protected pages to obviously-logged-out requests.
 */
export function proxy(request: NextRequest) {
  const hasSessionCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /login (the login page itself)
     * - /api/login, /api/health (public API routes)
     * - static assets, PWA files, Next internals
     *
     * /brand/ must stay excluded too — next/image's optimizer fetches the
     * source file via an internal same-origin request, which otherwise hits
     * this same gate and gets redirected to /login (HTML, not image bytes).
     */
    "/((?!login|api/login|api/health|_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|brand/).*)",
  ],
};
