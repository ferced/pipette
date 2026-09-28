import { getSiteIndex } from "@/lib/data";
import { SITE } from "@/lib/entry";
import { XML_HEADERS, sitemapIndex } from "@/lib/sitemap";

export const revalidate = 3600;

export async function GET() {
  const idx = await getSiteIndex();
  const days = idx?.days ?? [];
  const body = sitemapIndex([
    { loc: `${SITE}/sitemaps/pages.xml`, lastmod: idx?.updated_at?.slice(0, 10) },
    ...days.map((d) => ({ loc: `${SITE}/sitemaps/papers-${d.date}.xml`, lastmod: d.date })),
  ]);
  return new Response(body, { headers: XML_HEADERS });
}
