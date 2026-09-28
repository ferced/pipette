import { getDayIndex, getSiteIndex, isDay } from "@/lib/data";
import { FIELDS } from "@/lib/i18n";
import { XML_HEADERS, urlset, type SmUrl } from "@/lib/sitemap";

export const revalidate = 3600;

export async function GET(_req: Request, ctx: RouteContext<"/sitemaps/[name]">) {
  const { name } = await ctx.params;
  const idx = await getSiteIndex();
  const today = idx?.latest;

  if (name === "pages.xml") {
    const urls: SmUrl[] = [
      { path: "/", lastmod: today, changefreq: "daily", priority: 1 },
      { path: "/f", lastmod: today, changefreq: "daily", priority: 0.8 },
      ...FIELDS.map((f) => ({ path: `/f/${f.id}`, lastmod: today, changefreq: "daily", priority: 0.9 })),
      ...FIELDS.flatMap((f) => f.topics.map((t) => ({ path: `/f/${f.id}/${t.id}`, lastmod: today, changefreq: "daily", priority: 0.7 }))),
      ...["arxiv", "biorxiv", "medrxiv", "journals"].map((s) => ({ path: `/source/${s}`, lastmod: today, changefreq: "daily", priority: 0.8 })),
      { path: "/about", changefreq: "monthly", priority: 0.5 },
      { path: "/open-data", lastmod: today, changefreq: "daily", priority: 0.5 },
      { path: "/foryou", changefreq: "monthly", priority: 0.4 },
      { path: "/archive", lastmod: today, changefreq: "daily", priority: 0.5 },
      ...(idx?.days ?? []).map((d) => ({ path: `/d/${d.date}`, lastmod: d.date, changefreq: "monthly", priority: 0.6 })),
    ];
    return new Response(urlset(urls), { headers: XML_HEADERS });
  }

  const m = /^papers-(\d{4}-\d{2}-\d{2})\.xml$/.exec(name);
  if (m && isDay(m[1])) {
    const day = await getDayIndex(m[1]);
    if (!day) return new Response("Not found", { status: 404 });
    const urls: SmUrl[] = day.papers.map((p) => ({ path: `/p/${p.id}`, lastmod: m[1], priority: p.pk ? 0.8 : 0.5 }));
    return new Response(urlset(urls), { headers: XML_HEADERS });
  }
  return new Response("Not found", { status: 404 });
}
