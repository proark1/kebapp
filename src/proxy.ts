import { getSessionCookie } from "better-auth/cookies";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) {
    return NextResponse.next();
  }

  const loginURL = new URL("/anmelden", request.url);
  loginURL.searchParams.set(
    "weiter",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );

  return NextResponse.redirect(loginURL);
}

export const config = {
  matcher: [
    "/app/:path*",
    "/admin/:path*",
    "/support/:path*",
    "/antrag",
    "/status",
  ],
};
