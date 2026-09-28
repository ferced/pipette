import { getDayIndex, getEdition, getSiteIndex } from "@/lib/data";
import { FIELD } from "@/lib/i18n";
import { SITE } from "@/lib/entry";
import { texPlain } from "@/lib/tex";

export const revalidate = 1800;

const x = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(_req: Request, ctx: RouteContext<"/rss/[feed]">) {
  const { feed } = await ctx.params;
  const name = feed.replace(/\.xml$/, "");
  const idx = await getSiteIndex();
  if (!idx) return new Response("No data", { status: 503 });
  const days = idx.days.slice(0, 3).map((d) => d.date);

  type It = { id: string; title: string; key: string; date: string; cat: string };
  const items: It[] = [];
  if (name === "edition") {
    for (const day of days) {
      const ed = await getEdition(day);
      ed?.picks.forEach((p) => items.push({ id: p.id, title: p.title, key: p.key_text || "", date: day, cat: FIELD[p.field]?.en ?? p.field }));
    }
  } else if (FIELD[name]) {
    for (const day of days) {
      const di = await getDayIndex(day);
      di?.papers
        .filter((p) => p.f === name)
        .slice(0, 25)
        .forEach((p) => items.push({ id: p.id, title: p.t, key: p.key || "", date: day, cat: FIELD[name].en }));
    }
  } else {
    return new Response("Unknown feed", { status: 404 });
  }

  const title = name === "edition" ? "Pipette — daily edition" : `Pipette — ${FIELD[name].en}`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${x(title)}</title>
<link>${SITE}</link>
<atom:link href="${SITE}/rss/${name}.xml" rel="self" type="application/rss+xml"/>
<description>New research worth knowing, picked every day from every new paper. In the authors' own words. Made by Ferced.</description>
<language>en</language>
${items
  .map(
    (i) => `<item>
<title>${x(texPlain(i.title))}</title>
<link>${SITE}/p/${i.id}</link>
<guid isPermaLink="true">${SITE}/p/${i.id}</guid>
<pubDate>${new Date(i.date + "T12:00:00Z").toUTCString()}</pubDate>
<category>${x(i.cat)}</category>
<description>${x(texPlain(i.key))}</description>
</item>`,
  )
  .join("\n")}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=1800" } });
}
