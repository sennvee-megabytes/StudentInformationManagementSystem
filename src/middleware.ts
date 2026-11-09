import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/student", "/staff", "/admin", "/change-password"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const cookieName = process.env.NODE_ENV === "production" ? "__Host-sims_sid" : "sims_sid";

  // Cheap gate only. Real authorization happens in pages/route handlers (defense in depth).
  if (PROTECTED.some((p) => pathname.startsWith(p)) && !req.cookies.get(cookieName)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
