import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Crumbs, EntryList, TopicChips, collect } from "@/components/Listing";
import { getRecent } from "@/lib/data";
import { FIELD, FIELDS, href, isLang, num } from "@/lib/i18n";
import { breadcrumbs, pageMeta, url, WEBSITE_ID } from "@/lib/seo";
import { permalink } from "@/lib/entry";
import { texPlain } from "@/lib/tex";

export const revalidate = 3600;
export const dynamicParams = false;
export function generateStaticParams() {
  return FIELDS.map((f) => ({ field: f.id }));
}

const DAYS = 3;

function copy(lang: "en" | "es", name: string) {
  return lang === "es"
    ? {
        title: `Papers nuevos de ${name}: lo mejor de cada día`,
        h1: `Papers nuevos de ${name}`,
        desc: `Los mejores papers nuevos de ${name} de arXiv, bioRxiv, medRxiv y 58 revistas, elegidos cada mañana entre todo lo publicado. Resultados en palabras de sus autores. Gratis y sin publicidad.`,
      }
    : {
        title: `Latest ${name} papers, picked daily`,
        h1: `New ${name} papers`,
        desc: `The best new ${name} research papers from arXiv, bioRxiv, medRxiv and 58 leading journals, picked every morning from everything published. Main results in the authors' own words. Free, no ads.`,
      };
}

export async function generateMetadata({ params }: PageProps<"/[lang]/f/[field]">): Promise<Metadata> {
  const { lang, field } = await params;
  const l = isLang(lang) ? lang : "en";
  const f = FIELD[field];
  if (!f) return {};
  const c = copy(l, f[l]);
  return {
    ...pageMeta({ lang: l, path: `/f/${field}`, title: c.title, description: c.desc }),
    alternates: {
      ...pageMeta({ lang: l, path: `/f/${field}`, title: c.title, description: c.desc }).alternates,
      types: { "application/rss+xml": `/rss/${field}.xml` },
    },
  };
}

export default async function FieldPage({ params }: PageProps<"/[lang]/f/[field]">) {
  const { lang, field } = await params;
  if (!isLang(lang) || !FIELD[field]) notFound();
  const f = FIELD[field];
  const name = f[lang];
  const c = copy(lang, name);
  const days = await getRecent(DAYS);
  const entries = collect(days, (p) => p.f === field, 60);
  const total = days.reduce((n, d) => n + d.papers.filter((p) => p.f === field).length, 0);
  const counts: Record<string, number> = {};
  days.forEach((d) => d.papers.forEach((p) => p.f === field && (counts[p.tp] = (counts[p.tp] || 0) + 1)));
  const home = lang === "es" ? "Inicio" : "Home";
  const fieldsName = lang === "es" ? "Campos" : "Fields";

  const intro =
    lang === "es"
      ? `En los últimos ${days.length} días aparecieron ${num(total, lang)} papers nuevos de ${name}. Pipette los leyó todos y estos son los ${entries.length} con más interés, avance real y afirmaciones prudentes. Cada uno muestra la oración de su resumen que dice el resultado principal, tal como la escribieron sus autores.`
      : `${num(total, lang)} new ${name} papers appeared in the last ${days.length} days. Pipette read every one, and these are the ${entries.length} with the broadest interest, a real step forward and careful claims. Each shows the sentence of its abstract that states the main result, exactly as its authors wrote it.`;

  return (
    <div className="wrap">
      <JsonLd
        nodes={[
          {
            "@type": "CollectionPage",
            "@id": url(`/f/${field}`, lang),
            url: url(`/f/${field}`, lang),
            name: c.h1,
            description: c.desc,
            inLanguage: lang,
            isPartOf: { "@id": WEBSITE_ID },
            about: { "@type": "Thing", name: f.en },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: entries.length,
              itemListElement: entries.slice(0, 30).map((e, i) => ({ "@type": "ListItem", position: i + 1, url: permalink(e.id), name: texPlain(e.title) })),
            },
          },
          breadcrumbs([
            { name: "Pipette", url: url("/", lang) },
            { name: fieldsName, url: url("/f", lang) },
            { name, url: url(`/f/${field}`, lang) },
          ]),
        ]}
      />
      <div className="page-h">
        <Crumbs items={[{ name: home, href: href(lang, "/") }, { name: fieldsName, href: href(lang, "/f") }, { name }]} />
        <h1>{c.h1}</h1>
        <p>{intro}</p>
        <TopicChips field={field} topics={f.topics} lang={lang} counts={counts} />
      </div>
      <div className="cols" style={{ paddingTop: 0 }}>
        <section aria-label={c.h1}>
          <EntryList entries={entries} lang={lang} heading={lang === "es" ? `Lo mejor de los últimos ${days.length} días` : `The best of the last ${days.length} days`} />
        </section>
        <aside className="rail">
          <div>
            <h2>{lang === "es" ? "Otros campos" : "Other fields"}</h2>
            <ul className="fieldlist">
              {FIELDS.filter((x) => x.id !== field).map((x) => (
                <li key={x.id}>
                  <Link href={href(lang, `/f/${x.id}`)}>
                    <span className="sw" style={{ background: x.color }} />
                    <span>{x[lang]}</span>
                    <span />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <p className="fine">
            <a href={`/rss/${field}.xml`}>RSS</a>
            {" · "}
            <Link href={href(lang, "/about#method")}>{lang === "es" ? "Cómo elegimos" : "How we pick"}</Link>
          </p>
        </aside>
      </div>
    </div>
  );
}
