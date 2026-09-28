import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Crumbs } from "@/components/Listing";
import { getSiteIndex } from "@/lib/data";
import { SITE } from "@/lib/entry";
import { href, isLang, num } from "@/lib/i18n";
import { FERCED, breadcrumbs, pageMeta, url } from "@/lib/seo";

export const revalidate = 3600;

const T = {
  en: {
    title: "Open dataset: every new research paper, labeled daily",
    h1: "Open data",
    desc: "A free, daily-updated JSON dataset of new research papers from arXiv, bioRxiv, medRxiv and 58 journals, with field, topic, kind of contribution, evidence type and calibrated labels from the Jev decision model.",
    lead: "Everything Pipette produces is public. Each day adds about two thousand papers with the labels shown on the site, including every probability. Use it for research, teaching, dashboards or your own feed.",
    files: "Files",
    fields: "What each paper record contains",
    licence: "Licence",
    licenceText: "Pipette's labels, rankings and editions are dedicated to the public domain (CC0 1.0). Titles and abstracts keep the licence of their source: arXiv metadata is CC0, bioRxiv and medRxiv abstracts carry the licence chosen by their authors, and journal metadata comes from OpenAlex (CC0). Closed-licence journal abstracts are not included.",
    cite: "Please credit “Pipette by Ferced (pipette.day)” when you can. It is not required.",
  },
  es: {
    title: "Datos abiertos: cada paper nuevo, clasificado a diario",
    h1: "Datos abiertos",
    desc: "Un dataset JSON gratuito y actualizado todos los días con los papers nuevos de arXiv, bioRxiv, medRxiv y 58 revistas, con campo, tema, tipo de aporte, tipo de evidencia y etiquetas calibradas del modelo de decisión Jev.",
    lead: "Todo lo que produce Pipette es público. Cada día suma unos dos mil papers con las mismas etiquetas que se ven en el sitio, incluidas todas las probabilidades. Usalo para investigar, enseñar, armar tableros o tu propio feed.",
    files: "Archivos",
    fields: "Qué tiene cada registro",
    licence: "Licencia",
    licenceText: "Las etiquetas, rankings y ediciones de Pipette son de dominio público (CC0 1.0). Los títulos y resúmenes mantienen la licencia de su fuente: los metadatos de arXiv son CC0, los resúmenes de bioRxiv y medRxiv tienen la licencia que eligieron sus autores y los metadatos de revistas vienen de OpenAlex (CC0). No se incluyen resúmenes de revistas con licencia cerrada.",
    cite: "Si podés, citá “Pipette by Ferced (pipette.day)”. No es obligatorio.",
  },
};

const RECORD = [
  ["id, title, authors, venue, date, url, pdf, doi", "Identifiers and links to the original"],
  ["status, published", "Preprint or peer-reviewed journal, and the published version when known"],
  ["field, topic", "One of 13 fields and about 110 topics"],
  ["sentences", "The abstract split into sentences (open licences only)"],
  ["j.key, j.caveat", "Index of the sentence with the main result, and of the admitted limitation"],
  ["j.kind, j.evidence", "Kind of contribution and evidence, with the full probability distribution"],
  ["j.appeal, j.advance, j.level", "Calibrated scores for breadth of interest, claimed advance and reading level"],
  ["j.hype, j.practical", "Probability of overclaiming, and of direct real-world impact"],
  ["rank, pick", "Pipette's ranking score and whether it made the daily edition"],
];

export async function generateMetadata({ params }: PageProps<"/[lang]/open-data">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return pageMeta({ lang: l, path: "/open-data", title: T[l].title, description: T[l].desc });
}

export default async function DataPage({ params }: PageProps<"/[lang]/open-data">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const c = T[lang];
  const idx = await getSiteIndex();
  const first = idx?.days.at(-1)?.date;
  const latest = idx?.latest;
  const total = (idx?.days ?? []).reduce((n, d) => n + d.total, 0);
  const files = [
    ["/data/v1/index.json", lang === "es" ? "Lista de días con cantidades" : "List of days with counts"],
    [`/data/v1/days/${latest}/edition.json`, lang === "es" ? "La edición de un día, con registros completos" : "One day's edition, full records"],
    [`/data/v1/days/${latest}/index.json`, lang === "es" ? "Todos los papers de un día, registros compactos" : "Every paper of a day, compact records"],
    ["/data/v1/p/<id>.json", lang === "es" ? "El registro completo de un paper" : "One paper's full record"],
    ["/data/v1/method.json", lang === "es" ? "Las preguntas exactas y la regla de ranking" : "The exact questions and ranking rule"],
    ["/data/v1/search/recent.json", lang === "es" ? "Títulos de las últimas dos semanas" : "Titles of the last two weeks"],
  ];
  return (
    <div className="wrap">
      <JsonLd
        nodes={[
          {
            "@type": "Dataset",
            "@id": `${SITE}/open-data#dataset`,
            name: "Pipette: daily labeled research papers",
            description: T.en.desc,
            url: url("/open-data", "en"),
            sameAs: url("/open-data", "es"),
            keywords: ["research papers", "preprints", "arXiv", "bioRxiv", "medRxiv", "scientific literature", "open data", "classification", "science news"],
            license: "https://creativecommons.org/publicdomain/zero/1.0/",
            isAccessibleForFree: true,
            creator: FERCED,
            publisher: FERCED,
            temporalCoverage: first && latest ? `${first}/..` : undefined,
            dateModified: idx?.updated_at,
            variableMeasured: ["field", "topic", "kind of contribution", "evidence type", "appeal", "claimed advance", "reading level", "overclaiming probability", "practical impact probability"],
            distribution: [
              { "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/v1/index.json` },
              ...(latest ? [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}/data/v1/days/${latest}/index.json` }] : []),
            ],
          },
          breadcrumbs([
            { name: "Pipette", url: url("/", lang) },
            { name: c.h1, url: url("/open-data", lang) },
          ]),
        ]}
      />
      <div className="page-h">
        <Crumbs items={[{ name: lang === "es" ? "Inicio" : "Home", href: href(lang, "/") }, { name: c.h1 }]} />
        <h1>{c.h1}</h1>
        <p>{c.lead}</p>
      </div>
      <div className="prose">
        <p className="fine">
          {lang === "es"
            ? `${num(total, lang)} papers desde el ${first}, actualizado todas las mañanas.`
            : `${num(total, lang)} papers since ${first}, updated every morning.`}
        </p>
        <h2>{c.files}</h2>
        {files.map(([f, d]) => (
          <div className="qa" key={f}>
            <b>{f.includes("<") ? <code>{f}</code> : <a href={f}><code>{f}</code></a>}</b>
            <div>{d}</div>
          </div>
        ))}
        <h2>{c.fields}</h2>
        {RECORD.map(([k, d]) => (
          <div className="qa" key={k}>
            <b><code>{k}</code></b>
            <div lang="en">{d}</div>
          </div>
        ))}
        <h2>{c.licence}</h2>
        <p>{c.licenceText}</p>
        <p>{c.cite}</p>
        <p>
          <Link href={href(lang, "/about#method")}>{lang === "es" ? "Cómo se generan las etiquetas" : "How the labels are made"}</Link>
        </p>
      </div>
    </div>
  );
}
