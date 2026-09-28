import { NextResponse, type NextRequest } from "next/server";

/**
 * English lives at the root ("/p/…"), Spanish under "/es/…".
 * Internally every page is rendered by app/[lang], so root paths are rewritten to /en.
 * The only cookie Pipette sets is "lang", to remember a language someone chose.
 */
export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (pathname === "/es" || pathname.startsWith("/es/")) return NextResponse.next();

  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname.slice(3) || "/";
    return NextResponse.redirect(url, 308);
  }

  if (pathname === "/") {
    const pref = req.cookies.get("lang")?.value;
    const al = (req.headers.get("accept-language") || "").trim().toLowerCase();
    if (pref === "es" || (!pref && al.startsWith("es"))) {
      const url = req.nextUrl.clone();
      url.pathname = "/es";
      return NextResponse.redirect(url, 307);
    }
  }

  const url = req.nextUrl.clone();
  url.pathname = "/en" + (pathname === "/" ? "" : pathname);
  url.search = search;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: [
    "/((?!api|rss|data|_next|favicon|icon|apple-icon|manifest|robots.txt|sitemap.xml|.*opengraph-image|.*\\.(?:png|jpg|jpeg|svg|ico|webp|txt|xml|json|css|js|map|woff2?)$).*)",
  ],
};
