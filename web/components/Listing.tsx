import Link from "next/link";
import { fromItem, type Entry } from "@/lib/entry";
import { formatDay, href, num } from "@/lib/i18n";
import type { DayIndex, Item, Lang } from "@/lib/types";
import { EntryView } from "./EntryView";

/** Best papers across several days, as entries tagged with their day. */
export function collect(days: DayIndex[], keep: (p: Item) => boolean, limit: number): Entry[] {
  const all: Entry[] = [];
  for (const d of days) for (const p of d.papers) if (keep(p)) all.push(fromItem(p, d.date));
  return all.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0)).slice(0, limit);
}

export function Crumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ol>
        {items.map((it, i) => (
          <li key={i}>{it.href ? <Link href={it.href}>{it.name}</Link> : <span aria-current="page">{it.name}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function EntryList({ entries, lang, heading }: { entries: Entry[]; lang: Lang; heading?: string }) {
  return (
    <>
    {heading && <h2 className="list-h">{heading}</h2>}
    <ul className="rows">
      {entries.map((e) => (
        <EntryView
          key={e.id}
          e={e}
          lang={lang}
          compact
          extra={
            <Link className="when" href={href(lang, `/d/${e.date}`)}>
              {formatDay(e.date, lang, "short")}
            </Link>
          }
        />
      ))}
    </ul>
    </>
  );
}

export function TopicChips({ field, topics, lang, counts }: { field: string; topics: { id: string; en: string; es: string }[]; lang: Lang; counts: Record<string, number> }) {
  return (
    <div className="chips" style={{ marginTop: 14 }}>
      {topics
        .filter((t) => counts[t.id])
        .map((t) => (
          <Link key={t.id} className="chip" href={href(lang, `/f/${field}/${t.id}`)}>
            {t[lang]} <span className="n">{num(counts[t.id], lang)}</span>
          </Link>
        ))}
    </div>
  );
}
