import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Crumbs, EntryList, collect } from "@/components/Listing";
import { getRecent } from "@/lib/data";
import { FIELD, FIELDS, href, isLang, num } from "@/lib/i18n";
import { breadcrumbs, pageMeta, url, WEBSITE_ID } from "@/lib/seo";
import { permalink } from "@/lib/entry";
import { texPlain } from "@/lib/tex";

export const revalidate = 3600;
export const dynamicParams = false;
export function generateStaticParams() {
  return FIELDS.flatMap((f) => f.topics.map((t) => ({ field: f.id, topic: t.id })));
}

const DAYS = 7;

function find(field: string, topic: string) {
  const f = FIELD[field];
  const t = f?.topics.find((x) => x.id === topic);
  return f && t ? { f, t } : null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/f/[field]/[topic]">): Promise<Metadata> {
  const { lang, field, topic } = await params;
  const l = isLang(lang) ? lang : "en";
  const ft = find(field, topic);
  if (!ft) return {};
  const title = l === "es" ? `Papers nuevos sobre ${ft.t.es} (${ft.f.es})` : `New research papers on ${ft.t.en} (${ft.f.en})`;
  const desc =
    l === "es"
      ? `Los papers más interesantes de la última semana sobre ${ft.t.es.toLowerCase()}, elegidos cada día entre todo lo nuevo de arXiv, bioRxiv, medRxiv y 58 revistas. En palabras de sus autores, sin publicidad.`
      : `The most interesting new papers of the past week on ${ft.t.en.toLowerCase()}: ${ft.t.d.toLowerCase()}. Picked daily from everything new on arXiv, bioRxiv, medRxiv and 58 journals.`;
  return pageMeta({ lang: l, path: `/f/${field}/${topic}`, title, description: desc.slice(0, 300) });
}

export default async function TopicPage({ params }: PageProps<"/[lang]/f/[field]/[topic]">) {
  const { lang, field, topic } = await params;
  if (!isLang(lang)) notFound();
  const ft = find(field, topic);
  if (!ft) notFound();
  const { f, t } = ft;
  const days = await getRecent(DAYS);
  const entries = collect(days, (p) => p.f === field && p.tp === topic, 50);
  const total = days.reduce((n, d) => n + d.papers.filter((p) => p.f === field && p.tp === topic).length, 0);
  const h1 = lang === "es" ? `Papers nuevos sobre ${t.es}` : `New papers on ${t.en}`;
  const home = lang === "es" ? "Inicio" : "Home";
  const fieldsName = lang === "es" ? "Campos" : "Fields";
  const intro =
    lang === "es"
      ? `${num(total, lang)} papers nuevos sobre ${t.es.toLowerCase()} en los últimos ${days.length} días, dentro de ${f.es}. Acá están los ${entries.length} que Pipette considera más valiosos, con el resultado principal en palabras de sus autores.`
      : `${num(total, lang)} new papers on ${t.en.toLowerCase()} in the last ${days.length} days, within ${f.en}. These are the ${entries.length} Pipette rates most worth reading, with the main result in the authors' own words.`;

  return (
    <div className="wrap">
      <JsonLd
        nodes={[
          {
            "@type": "CollectionPage",
            "@id": url(`/f/${field}/${topic}`, lang),
            url: url(`/f/${field}/${topic}`, lang),
            name: h1,
            inLanguage: lang,
            isPartOf: { "@id": WEBSITE_ID },
            about: { "@type": "Thing", name: t.en, description: t.d },
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: entries.length,
              itemListElement: entries.slice(0, 30).map((e, i) => ({ "@type": "ListItem", position: i + 1, url: permalink(e.id), name: texPlain(e.title) })),
            },
          },
          breadcrumbs([
            { name: "Pipette", url: url("/", lang) },
            { name: fieldsName, url: url("/f", lang) },
            { name: f[lang], url: url(`/f/${field}`, lang) },
            { name: t[lang], url: url(`/f/${field}/${topic}`, lang) },
          ]),
        ]}
      />
      <div className="page-h">
        <Crumbs
          items={[
            { name: home, href: href(lang, "/") },
            { name: fieldsName, href: href(lang, "/f") },
            { name: f[lang], href: href(lang, `/f/${field}`) },
            { name: t[lang] },
          ]}
        />
        <h1>{h1}</h1>
        <p>{intro}</p>
      </div>
      <div className="cols" style={{ paddingTop: 0 }}>
        <section aria-label={h1}>
          {entries.length ? (
            <EntryList entries={entries} lang={lang} heading={lang === "es" ? "Lo mejor de la semana" : "The best of the week"} />
          ) : (
            <p className="empty">{lang === "es" ? "No hubo papers de este tema en la última semana." : "No papers on this topic in the past week."}</p>
          )}
        </section>
        <aside className="rail">
          <div>
            <h2>{lang === "es" ? `Más temas de ${f.es}` : `More in ${f.en}`}</h2>
            <ul className="fieldlist">
              {f.topics
                .filter((x) => x.id !== topic)
                .map((x) => (
                  <li key={x.id}>
                    <Link href={href(lang, `/f/${field}/${x.id}`)}>
                      <span className="sw" style={{ background: f.color }} />
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
