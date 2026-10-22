import { NextResponse, type NextRequest } from "next/server";

// Two sites from one deployment, told apart by host: app.chogxbet.xyz is the app (pages in src/app/(app)/, served as they are),
// chogxbet.xyz is only the landing page (src/app/landing/). Everything else on the bare domain, including links from before the
// split (/app/duels/3), moves to the same path on the app host.
// localhost and Vercel preview URLs (*.vercel.app) have no app. subdomain (Privy's embedded wallet also refuses http://app.localhost),
// so they serve the app directly, with the landing page at /landing.
export function proxy(req: NextRequest) {
  const { pathname, search, protocol } = req.nextUrl;
  // The Host header, not nextUrl's host: in dev that's the server's own address whichever host was asked for.
  const host = req.headers.get("host") ?? req.nextUrl.host;
  const isApp = host.startsWith("app.") || /(\.vercel\.app|^localhost|^127\.0\.0\.1)(:\d+)?$/.test(host);
  const old = pathname === "/app" || pathname.startsWith("/app/");
  const path = old ? pathname.slice(4) || "/" : pathname;
  if (/^app\.localhost(:\d+)?$/.test(host)) return NextResponse.redirect(`${protocol}//${host.slice(4)}${path}${search}`, 307);
  if (isApp) return old ? NextResponse.redirect(`${protocol}//${host}${path}${search}`, 307) : undefined;
  if (pathname === "/") return NextResponse.rewrite(new URL("/landing", req.url));
  return NextResponse.redirect(`${protocol}//app.${host.replace(/^www\./, "")}${path}${search}`, 307);
}

// Not for build assets, the /og share images, or files in public/ (anything with an extension): both hosts serve those as they are.
export const config = {
  matcher: ["/((?!_next/|og|landing|.*\\.).*)"],
};
