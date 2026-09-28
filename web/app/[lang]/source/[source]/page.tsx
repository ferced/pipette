import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Crumbs, EntryList, collect } from "@/components/Listing";
import { getRecent } from "@/lib/data";
import { FIELDS, href, isLang, num } from "@/lib/i18n";
import { breadcrumbs, pageMeta, url, WEBSITE_ID } from "@/lib/seo";
import { permalink } from "@/lib/entry";
import { texPlain } from "@/lib/tex";
import type { Lang } from "@/lib/types";

export const revalidate = 3600;
export const dynamicParams = false;

const SOURCES = {
  arxiv: {
    key: "arxiv",
    en: { title: "New arXiv papers today, the ones worth reading", h1: "New arXiv papers", desc: "Every new arXiv paper of the day, read and ranked: the best new preprints in AI, physics, mathematics, astronomy and computer science, with the main result in the authors' words." },
    es: { title: "Papers nuevos de arXiv hoy, los que valen la pena", h1: "Papers nuevos de arXiv", desc: "Todos los papers nuevos de arXiv del día, leídos y ordenados: los mejores preprints de IA, física, matemática, astronomía y computación, con el resultado principal en palabras de sus autores." },
  },
  biorxiv: {
    key: "biorxiv",
    en: { title: "New bioRxiv preprints today, the ones worth reading", h1: "New bioRxiv preprints", desc: "The best new bioRxiv preprints in biology, neuroscience, genetics and ecology, picked every day from everything posted. Main results in the authors' own words." },
    es: { title: "Preprints nuevos de bioRxiv hoy, los que valen la pena", h1: "Preprints nuevos de bioRxiv", desc: "Los mejores preprints nuevos de bioRxiv en biología, neurociencia, genética y ecología, elegidos cada día entre todo lo publicado. En palabras de sus autores." },
  },
  medrxiv: {
    key: "medrxiv",
    en: { title: "New medRxiv preprints today, the ones worth reading", h1: "New medRxiv preprints", desc: "The best new medRxiv preprints in medicine and public health, picked every day. Preprints are not yet peer-reviewed: Pipette marks them clearly and flags bold claims." },
    es: { title: "Preprints nuevos de medRxiv hoy, los que valen la pena", h1: "Preprints nuevos de medRxiv", desc: "Los mejores preprints nuevos de medRxiv en medicina y salud pública, elegidos cada día. Todavía no tienen revisión por pares: Pipette lo marca y señala las afirmaciones fuertes." },
  },
  journals: {
    key: "journal",
    en: { title: "New papers in Nature, Science, Cell, The Lancet and more", h1: "New papers in leading journals", desc: "The best new peer-reviewed papers from 58 leading journals, including Nature, Science, Cell, PNAS, The Lancet, NEJM, JAMA and Physical Review Letters, picked every day." },
    es: { title: "Papers nuevos en Nature, Science, Cell, The Lancet y más", h1: "Papers nuevos en revistas líderes", desc: "Los mejores papers nuevos con revisión por pares de 58 revistas líderes, entre ellas Nature, Science, Cell, PNAS, The Lancet, NEJM, JAMA y Physical Review Letters, elegidos cada día." },
  },
} as const;

type Src = keyof typeof SOURCES;

export function generateStaticParams() {
  return Object.keys(SOURCES).map((source) => ({ source }));
}

export async function generateMetadata({ params }: PageProps<"/[lang]/source/[source]">): Promise<Metadata> {
  const { lang, source } = await params;
  const l: Lang = isLang(lang) ? lang : "en";
  const s = SOURCES[source as Src];
  if (!s) return {};
  return pageMeta({ lang: l, path: `/source/${source}`, title: s[l].title, description: s[l].desc });
}

export default async function SourcePage({ params }: PageProps<"/[lang]/source/[source]">) {
  const { lang, source } = await params;
  if (!isLang(lang)) notFound();
  const s = SOURCES[source as Src];
  if (!s) notFound();
  const c = s[lang];
  // Weekends have no arXiv: look back far enough to always show three days of this source.
  const recent = await getRecent(7);
  const days = recent.filter((d) => d.papers.some((p) => p.src === s.key)).slice(0, 3);
  const entries = collect(days, (p) => p.src === s.key, 60);
  const total = days.reduce((n, d) => n + d.papers.filter((p) => p.src === s.key).length, 0);
  const home = lang === "es" ? "Inicio" : "Home";
  const intro =
    lang === "es"
      ? `${num(total, lang)} papers nuevos en ${days.length} días. Pipette los leyó todos; estos son los ${entries.length} mejores, de todos los campos.`
      : `${num(total, lang)} new papers over ${days.length} days. Pipette read all of them; these are the ${entries.length} best, across every field.`;
  return (
    <div className="wrap">
      <JsonLd
        nodes={[
          {
            "@type": "CollectionPage",
            "@id": url(`/source/${source}`, lang),
            url: url(`/source/${source}`, lang),
            name: c.h1,
            description: c.desc,
            inLanguage: lang,
            isPartOf: { "@id": WEBSITE_ID },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: entries.length,
              itemListElement: entries.slice(0, 30).map((e, i) => ({ "@type": "ListItem", position: i + 1, url: permalink(e.id), name: texPlain(e.title) })),
            },
          },
          breadcrumbs([
            { name: "Pipette", url: url("/", lang) },
            { name: c.h1, url: url(`/source/${source}`, lang) },
          ]),
        ]}
      />
      <div className="page-h">
        <Crumbs items={[{ name: home, href: href(lang, "/") }, { name: c.h1 }]} />
        <h1>{c.h1}</h1>
        <p>{c.desc}</p>
        <p style={{ marginTop: 8 }}>{intro}</p>
      </div>
      <div className="cols" style={{ paddingTop: 0 }}>
        <section aria-label={c.h1}>
          <EntryList entries={entries} lang={lang} heading={lang === "es" ? `Lo mejor de los últimos ${days.length} días` : `The best of the last ${days.length} days`} />
        </section>
        <aside className="rail">
          <div>
            <h2>{lang === "es" ? "Otras fuentes" : "Other sources"}</h2>
            <ul className="fieldlist">
              {(Object.keys(SOURCES) as Src[])
                .filter((k) => k !== source)
                .map((k) => (
                  <li key={k}>
                    <Link href={href(lang, `/source/${k}`)}>
                      <span className="sw" style={{ background: "var(--ink-3)" }} />
                      <span>{SOURCES[k][lang].h1}</span>
                      <span />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
          <div>
            <h2>{lang === "es" ? "Por campo" : "By field"}</h2>
            <ul className="fieldlist">
              {FIELDS.map((x) => (
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
        </aside>
      </div>
    </div>
  );
}
