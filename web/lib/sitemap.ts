import { SITE } from "./entry";

export type SmUrl = { path: string; lastmod?: string; changefreq?: string; priority?: number; bilingual?: boolean };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const en = (path: string) => SITE + (path === "/" ? "" : path);
const es = (path: string) => SITE + (path === "/" ? "/es" : `/es${path}`);

/** A urlset where every page is listed in English and Spanish, each declaring both versions. */
export function urlset(urls: SmUrl[]) {
  const rows: string[] = [];
  for (const u of urls) {
    const alts = u.bilingual === false
      ? ""
      : `<xhtml:link rel="alternate" hreflang="en" href="${esc(en(u.path))}"/><xhtml:link rel="alternate" hreflang="es" href="${esc(es(u.path))}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(en(u.path))}"/>`;
    const meta =
      (u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "") +
      (u.changefreq ? `<changefreq>${u.changefreq}</changefreq>` : "") +
      (u.priority !== undefined ? `<priority>${u.priority.toFixed(1)}</priority>` : "");
    rows.push(`<url><loc>${esc(en(u.path))}</loc>${meta}${alts}</url>`);
    if (u.bilingual !== false) rows.push(`<url><loc>${esc(es(u.path))}</loc>${meta}${alts}</url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${rows.join("\n")}\n</urlset>\n`;
}

export function sitemapIndex(items: { loc: string; lastmod?: string }[]) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items
    .map((i) => `<sitemap><loc>${esc(i.loc)}</loc>${i.lastmod ? `<lastmod>${i.lastmod}</lastmod>` : ""}</sitemap>`)
    .join("\n")}\n</sitemapindex>\n`;
}

export const XML_HEADERS = { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" };
