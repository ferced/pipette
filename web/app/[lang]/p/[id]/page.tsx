import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyCite, SaveButton, ShareButton } from "@/components/client";
import { External } from "@/components/EntryView";
import { Drop } from "@/components/Logo";
import { Tex } from "@/components/Tex";
import { getDayIndex, getPaper } from "@/lib/data";
import { JsonLd } from "@/components/JsonLd";
import { EntryList } from "@/components/Listing";
import { FERCED, WEBSITE_ID, breadcrumbs, clampText, pageMeta, url } from "@/lib/seo";
import { fromItem } from "@/lib/entry";
import { FIELD, evidenceName, fieldName, formatDay, href, isLang, kindName, topicName, t } from "@/lib/i18n";
import { fromPaper, permalink, signals } from "@/lib/entry";
import { texPlain } from "@/lib/tex";
import type { Lang, Paper } from "@/lib/types";

export const revalidate = 86400;
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/p/[id]">): Promise<Metadata> {
  const { lang, id } = await params;
  const l = isLang(lang) ? lang : "en";
  const p = await getPaper(id);
  if (!p) return { title: "Not found", robots: { index: false } };
  const title = texPlain(p.title);
  const lead = texPlain(p.key_text || (p.sentences || [])[0] || "");
  const desc = clampText(lead || title, 158);
  const base = pageMeta({ lang: l, path: `/p/${id}`, title, description: desc, ogType: "article" });
  const d = p.date.replace(/-/g, "/");
  const arxivId = p.src === "arxiv" ? p.id.replace(/^arxiv-/, "") : undefined;
  return {
    ...base,
    openGraph: { ...base.openGraph, type: "article", publishedTime: p.date, authors: p.authors.slice(0, 10), section: FIELD[p.field]?.en, tags: [FIELD[p.field]?.en ?? "", topicName(p.field, p.topic, "en")] },
    other: {
      citation_title: title,
      citation_author: p.authors.slice(0, 50),
      citation_publication_date: d,
      citation_online_date: d,
      ...(p.src === "journal" ? { citation_journal_title: p.venue } : { citation_technical_report_institution: p.venue }),
      ...(p.doi ? { citation_doi: p.doi } : {}),
      ...(arxivId ? { citation_arxiv_id: arxivId } : {}),
      citation_abstract_html_url: p.url,
    },
  };
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function Dist({ rows }: { rows: { label: string; p: number }[] }) {
  const max = Math.max(...rows.map((r) => r.p));
  return (
    <div className="dist">
      {rows.map((r) => (
        <div key={r.label} className={`dist-row${r.p === max && rows.length > 1 ? " top" : ""}`}>
          <span>{r.label}</span>
          <span className="track">
            <span className="fill" style={{ width: `${Math.max(2, r.p * 100)}%`, display: "block" }} />
          </span>
          <span className="p">{pct(r.p)}</span>
        </div>
      ))}
    </div>
  );
}

function Reading({ p, lang }: { p: Paper; lang: Lang }) {
  const d = t(lang);
  const j = p.j;
  const yes = lang === "es" ? "Sí" : "Yes";
  const scale = (vals: number[], labels: string[]) => labels.map((label, i) => ({ label, p: vals[i] ?? 0 }));
  const top = (m: Record<string, number>, name: (k: string) => string) =>
    Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k, v]) => ({ label: name(k), p: v }));
  return (
    <section className="reading panel" aria-labelledby="reading">
      <h2 className="sec-h" id="reading">{d.details}</h2>
      <p>{d.jev_lead}</p>
      <div className="q">
        <h3>{d.q_kind}</h3>
        <Dist rows={top(j.kind_p, (k) => kindName(k, lang))} />
      </div>
      <div className="q">
        <h3>{d.q_evidence}</h3>
        <Dist rows={top(j.evidence_p, (k) => evidenceName(k, lang))} />
      </div>
      <div className="q">
        <h3>{d.q_appeal}</h3>
        <Dist rows={scale(j.appeal_p, d.appeal_levels)} />
      </div>
      <div className="q">
        <h3>{d.q_advance}</h3>
        <Dist rows={scale(j.advance_p, d.advance_levels)} />
      </div>
      <div className="q">
        <h3>{d.q_level}</h3>
        <Dist rows={scale(j.level_p, d.level_levels)} />
      </div>
      <div className="q">
        <h3>{d.q_hype}</h3>
        <Dist rows={[{ label: yes, p: j.hype }]} />
      </div>
      <div className="q">
        <h3>{d.q_practical}</h3>
        <Dist rows={[{ label: yes, p: j.practical }]} />
      </div>
      <p className="fine">
        {lang === "es" ? "Modelo" : "Model"}: {j.model}.{" "}
        <Link href={href(lang, "/about#method")}>{d.footer_method}</Link>
      </p>
    </section>
  );
}

export default async function PaperPage({ params }: PageProps<"/[lang]/p/[id]">) {
  const { lang, id } = await params;
  if (!isLang(lang)) notFound();
  const p = await getPaper(id);
  if (!p) notFound();
  const d = t(lang);
  const e = fromPaper(p);
  const sig = signals(e, lang);
  const color = FIELD[p.field]?.color;
  const key = p.j.key;
  const cav = p.j.caveat;
  const status = p.src === "journal" ? d.journal : p.published ? d.published_version : d.preprint;
  const authorsComment = lang === "es" ? "Comentario de los autores" : "Authors' comment";
  const day = await getDayIndex(p.date);
  const pool = (day?.papers ?? []).filter((x) => x.id !== p.id);
  const sameTopic = pool.filter((x) => x.f === p.field && x.tp === p.topic);
  const related = (sameTopic.length >= 3 ? sameTopic : pool.filter((x) => x.f === p.field))
    .sort((a, b) => b.rk - a.rk)
    .slice(0, 5)
    .map((x) => fromItem(x, p.date));
  const plainTitle = texPlain(p.title);
  const abstractText = p.sentences ? texPlain(p.sentences.join(" ")) : undefined;
  const identifiers = [
    ...(p.doi ? [{ "@type": "PropertyValue", propertyID: "DOI", value: p.doi }] : []),
    ...(p.src === "arxiv" ? [{ "@type": "PropertyValue", propertyID: "arXiv", value: p.id.replace(/^arxiv-/, "") }] : []),
  ];
  const articleLd = {
    "@type": "ScholarlyArticle",
    "@id": `${url(`/p/${p.id}`, "en")}#article`,
    headline: plainTitle.slice(0, 110),
    name: plainTitle,
    author: p.authors.slice(0, 50).map((name) => ({ "@type": "Person", name })),
    datePublished: p.date,
    inLanguage: "en",
    ...(abstractText ? { abstract: abstractText } : {}),
    description: texPlain(p.key_text || ""),
    genre: kindName(p.j.kind, "en"),
    about: [{ "@type": "Thing", name: FIELD[p.field]?.en }, { "@type": "Thing", name: topicName(p.field, p.topic, "en") }],
    isPartOf: { "@type": p.src === "journal" ? "Periodical" : "DataCatalog", name: p.venue },
    publisher: { "@type": "Organization", name: p.venue },
    url: p.url,
    sameAs: [p.url, ...(p.doi ? [`https://doi.org/${p.doi}`] : [])],
    ...(identifiers.length ? { identifier: identifiers } : {}),
    isAccessibleForFree: p.src !== "journal" || !p.abstract_withheld,
    mainEntityOfPage: { "@type": "WebPage", "@id": url(`/p/${p.id}`, lang), isPartOf: { "@id": WEBSITE_ID }, publisher: { "@id": FERCED["@id"] } },
  };
  const publishedLabel = lang === "es" ? "Versión publicada" : "Published version";

  return (
    <div className="wrap paper">
      <JsonLd
        nodes={[
          articleLd,
          breadcrumbs([
            { name: "Pipette", url: url("/", lang) },
            { name: fieldName(p.field, lang), url: url(`/f/${p.field}`, lang) },
            { name: topicName(p.field, p.topic, lang), url: url(`/f/${p.field}/${p.topic}`, lang) },
            { name: plainTitle.slice(0, 80), url: url(`/p/${p.id}`, lang) },
          ]),
        ]}
      />
      <article>
        <div className="where">
          <span className="sw" style={{ background: color }} aria-hidden="true" />
          <Link href={href(lang, `/f/${p.field}`)}>{fieldName(p.field, lang)}</Link>
          <span className="sep" aria-hidden="true">/</span>
          <Link href={href(lang, `/f/${p.field}/${p.topic}`)}>{topicName(p.field, p.topic, lang)}</Link>
        </div>
        <h1 lang="en">
          <Tex text={p.title} />
        </h1>
        <p className="authors" lang="en">
          {p.authors.join(", ")}
          {p.n_authors > p.authors.length ? ` ${d.authors_more(p.n_authors - p.authors.length)}` : ""}
        </p>
        <div className="meta-row">
          {sig.map((s) => (
            <span
              key={s.label}
              className={`sig ${s.tone === "on" ? "on" : s.tone === "warn" ? "warn" : s.tone === "pre" ? "status-pre" : ""}`}
            >
              {s.label}
            </span>
          ))}
        </div>

        <div className="abstract">
          <h2>{d.in_their_words}</h2>
          <div lang="en">
          {p.sentences ? (
            <>
              <p>
                {p.sentences.map((s, i) => (
                  <span key={i}>
                    <Tex text={s} className={i === key ? "hl-key" : i === cav ? "hl-cav" : undefined} />{" "}
                  </span>
                ))}
              </p>
              <div className="legend">
                {key !== null && (
                  <span>
                    <i style={{ background: "var(--indicator-soft)", boxShadow: "inset 0 -2px 0 var(--indicator)" }} />
                    {d.key_label}
                  </span>
                )}
                {cav !== null ? (
                  <span>
                    <i style={{ background: "var(--caveat-soft)", boxShadow: "inset 0 -2px 0 var(--caveat)" }} />
                    {d.caveat_label}
                  </span>
                ) : (
                  <span>{d.no_caveat}</span>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="notice">{d.withheld}</p>
              {p.key_text && (
                <div className="quote-block">
                  <div className="ql">{d.key_label}</div>
                  <div className="drop-quote">
                    <Drop />
                    <Tex as="blockquote" text={p.key_text} />
                  </div>
                </div>
              )}
              {p.caveat_text && (
                <div className="quote-block">
                  <div className="ql">{d.caveat_label}</div>
                  <Tex as="blockquote" className="hl-cav" text={p.caveat_text} />
                </div>
              )}
            </>
          )}
          </div>
        </div>

        <div style={{ marginTop: 30 }} className="linklist">
          <a className="btn primary" href={p.url} target="_blank" rel="noopener">
            {d.read_paper} <External />
          </a>
          {p.pdf && (
            <a className="btn" href={p.pdf} target="_blank" rel="noopener">
              {d.pdf}
            </a>
          )}
          {p.code.map((c) => (
            <a key={c} className="btn" href={c} target="_blank" rel="noopener">
              {d.code}
            </a>
          ))}
          <SaveButton entry={e} lang={lang} />
          <CopyCite entry={e} lang={lang} />
          <ShareButton url={permalink(p.id)} title={texPlain(p.title)} lang={lang} />
        </div>

        <p className="note">
          {d.appeared}: <Link href={href(lang, `/d/${p.date}`)}>{formatDay(p.date, lang)}</Link>. {p.venue}. {status}.
        </p>
        {p.doi && (
          <p className="note">
            {d.doi}:{" "}
            <a href={`https://doi.org/${p.doi}`} target="_blank" rel="noopener">
              {p.doi}
            </a>
          </p>
        )}
        {p.published && p.src !== "journal" && (
          <p className="note">
            {publishedLabel}: {p.published}
          </p>
        )}
        {p.note && (
          <p className="note">
            {authorsComment}: <span lang="en">{p.note}</span>
          </p>
        )}

        {related.length > 0 && (
          <section className="related" aria-labelledby="related">
            <h2 id="related">
              {lang === "es" ? `Más de ${topicName(p.field, p.topic, lang)} ese día` : `More on ${topicName(p.field, p.topic, lang)} that day`}
            </h2>
            <EntryList entries={related} lang={lang} />
            <p className="note">
              <Link href={href(lang, `/f/${p.field}/${p.topic}`)}>
                {lang === "es" ? `Todos los papers nuevos de ${topicName(p.field, p.topic, lang)}` : `All new papers on ${topicName(p.field, p.topic, lang)}`}
              </Link>
            </p>
          </section>
        )}
      </article>
      <aside>
        <Reading p={p} lang={lang} />
      </aside>
    </div>
  );
}
