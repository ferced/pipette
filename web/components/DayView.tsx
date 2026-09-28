import Link from "next/link";
import { getDayIndex, getEdition } from "@/lib/data";
import { FIELDS, fieldName, formatDay, href, num, t } from "@/lib/i18n";
import { fromPaper, permalink } from "@/lib/entry";
import { WEBSITE_ID, breadcrumbs, url } from "@/lib/seo";
import { texPlain } from "@/lib/tex";
import { JsonLd } from "./JsonLd";
import type { Lang } from "@/lib/types";
import DotField from "./DotField";
import { EntryView } from "./EntryView";

const SOURCE_NAMES: Record<string, string> = { arxiv: "arXiv", biorxiv: "bioRxiv", medrxiv: "medRxiv", journal: "Journals" };

export async function DayView({ day, lang, home = false }: { day: string; lang: Lang; home?: boolean }) {
  const d = t(lang);
  const [ed, idx] = await Promise.all([getEdition(day), getDayIndex(day)]);
  if (!ed || !idx) {
    return (
      <div className="wrap">
        <div className="page-h">
          <h1>{formatDay(day, lang)}</h1>
          <p>{d.day_empty}</p>
        </div>
      </div>
    );
  }

  // Dot field: papers grouped by field (in taxonomy order), best first inside each field.
  const order = FIELDS.map((f) => f.id);
  const pos = new Map(order.map((f, i) => [f, i]));
  const sorted = idx.papers
    .map((p, i) => ({ p, i }))
    .sort((a, b) => (pos.get(a.p.f) ?? 99) - (pos.get(b.p.f) ?? 99) || a.i - b.i);
  const codes = sorted
    .map(({ p }) => {
      const c = String.fromCharCode(97 + (pos.get(p.f) ?? 0));
      return p.pk ? c.toUpperCase() : c;
    })
    .join("");

  const fieldsPresent = FIELDS.filter((f) => ed.by_field[f.id]);
  const cost = (ed.jev_tokens * 0.042) / 1e6;
  const costStr = `US$${cost.toFixed(2)}`;
  const sources = Object.entries(ed.by_source).sort((a, b) => b[1] - a[1]);
  const esSrc = (k: string) => (lang === "es" && k === "journal" ? "Revistas" : SOURCE_NAMES[k] ?? k);

  const pagePath = home ? "/" : `/d/${day}`;
  const editionLd = {
    "@type": "CollectionPage",
    "@id": url(pagePath, lang),
    url: url(pagePath, lang),
    name: lang === "es" ? `Papers nuevos del ${formatDay(day, lang)}` : `New research papers, ${formatDay(day, lang)}`,
    inLanguage: lang,
    datePublished: day,
    isPartOf: { "@id": WEBSITE_ID },
    mainEntity: {
      "@type": "ItemList",
      name: lang === "es" ? "La edición del día" : "Daily edition",
      numberOfItems: ed.picks.length,
      itemListElement: ed.picks.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: permalink(p.id), name: texPlain(p.title) })),
    },
  };

  return (
    <>
      <JsonLd
        nodes={
          home
            ? [editionLd]
            : [editionLd, breadcrumbs([{ name: "Pipette", url: url("/", lang) }, { name: formatDay(day, lang), url: url(pagePath, lang) }])]
        }
      />
      <section className="wrap hero" aria-labelledby="hero-line">
        <p className="hero-date">{formatDay(day, lang)}</p>
        <h1 className="hero-line" id="hero-line">
          {lang === "es" ? (
            <>
              Aparecieron <span className="num">{num(ed.total, lang)}</span> papers nuevos. Los leímos todos. Estos{" "}
              <span className="num">{ed.picks.length}</span> valen tu tiempo.
            </>
          ) : (
            <>
              <span className="num">{num(ed.total, lang)}</span> new papers appeared. We read every one. These{" "}
              <span className="num">{ed.picks.length}</span> are worth your time.
            </>
          )}
        </h1>
        <DotField
          codes={codes}
          fields={order}
          colors={FIELDS.map((f) => f.color)}
          date={day}
          lang={lang}
          label={d.hero_line(num(ed.total, lang), ed.picks.length)}
        />
        <div className="dots-legend" aria-hidden="true">
          {fieldsPresent.map((f) => (
            <span key={f.id}>
              <i className="sw" style={{ background: f.color }} />
              {f[lang]}
            </span>
          ))}
          <span>
            <i className="sw" style={{ background: "var(--indicator)" }} />
            {d.edition_title}
          </span>
        </div>
        <div className="dots-cap">
          <span>{d.hero_dots}</span>
          {!ed.by_source.arxiv && <span>{d.weekend_note}</span>}
        </div>
      </section>

      <div className="wrap cols">
        <section aria-labelledby="edition">
          <div className="sec-head">
            <h2 id="edition">{d.edition_title}</h2>
            <p>{d.edition_note}</p>
          </div>
          <ol className="entries">
            {ed.picks.map((p) => (
              <EntryView key={p.id} e={fromPaper(p)} lang={lang} />
            ))}
          </ol>
          <div className="more">
            <Link className="btn" href={href(lang, `/d/${day}/all`)}>
              {d.see_all} ({num(ed.total, lang)})
            </Link>
          </div>
        </section>

        <aside className="rail">
          <div className="panel">
            <h2>{d.foryou_title}</h2>
            <p>{lang === "es" ? "Decile a Pipette qué querés seguir y ordena los papers del día para vos. Sin cuenta." : "Tell Pipette what you follow and it ranks the day's papers for you. No account needed."}</p>
            <Link className="btn primary" href={href(lang, "/foryou")}>
              {d.foryou_run}
            </Link>
          </div>

          <div>
            <h2>{d.by_field}</h2>
            <ul className="fieldlist">
              {fieldsPresent
                .slice()
                .sort((a, b) => (ed.by_field[b.id] ?? 0) - (ed.by_field[a.id] ?? 0))
                .map((f) => (
                  <li key={f.id}>
                    <Link href={href(lang, `/f/${f.id}`)}>
                      <span className="sw" style={{ background: f.color }} />
                      <span>{fieldName(f.id, lang)}</span>
                      <span className="n">{num(ed.by_field[f.id], lang)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <h2>{d.from_sources}</h2>
            <ul className="srcs">
              {sources.map(([k, v]) => (
                <li key={k}>
                  <Link href={href(lang, `/source/${k === "journal" ? "journals" : k}`)}>{esSrc(k)}</Link>
                  <span className="n">{num(v, lang)}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="fine">
            {d.cost_line(num(ed.total, lang), costStr)}{" "}
            <Link href={href(lang, "/about#method")}>{d.footer_method}</Link>
          </p>
        </aside>
      </div>
      {home && (
        <section className="wrap home-about" aria-labelledby="what">
          {lang === "es" ? (
            <>
              <h2 id="what">Qué es Pipette</h2>
              <p>
                Pipette es un resumen diario y gratuito de la investigación científica nueva. Cada mañana lee todos los preprints nuevos de{" "}
                <Link href={href(lang, "/source/arxiv")}>arXiv</Link>, <Link href={href(lang, "/source/biorxiv")}>bioRxiv</Link> y{" "}
                <Link href={href(lang, "/source/medrxiv")}>medRxiv</Link>, y los artículos nuevos de{" "}
                <Link href={href(lang, "/source/journals")}>58 revistas líderes</Link> como Nature, Science, Cell y The Lancet. Después elige los que valen la pena en cada campo, de la{" "}
                <Link href={href(lang, "/f/ai")}>inteligencia artificial</Link> a la <Link href={href(lang, "/f/health")}>medicina</Link>, la{" "}
                <Link href={href(lang, "/f/physics")}>física</Link> o el <Link href={href(lang, "/f/earth")}>clima</Link>.
              </p>
              <p>
                No reescribe la ciencia: de cada paper muestra la oración del resumen que dice el resultado principal, tal como la escribieron sus autores. No tiene publicidad, no rastrea a nadie y no pide cuenta. Lo hace Ferced.
              </p>
            </>
          ) : (
            <>
              <h2 id="what">What Pipette is</h2>
              <p>
                Pipette is a free daily digest of new scientific research. Every morning it reads every new preprint on{" "}
                <Link href={href(lang, "/source/arxiv")}>arXiv</Link>, <Link href={href(lang, "/source/biorxiv")}>bioRxiv</Link> and{" "}
                <Link href={href(lang, "/source/medrxiv")}>medRxiv</Link>, and every new article in{" "}
                <Link href={href(lang, "/source/journals")}>58 leading journals</Link> such as Nature, Science, Cell and The Lancet. Then it picks the papers worth knowing about in every field, from{" "}
                <Link href={href(lang, "/f/ai")}>artificial intelligence</Link> to <Link href={href(lang, "/f/health")}>medicine</Link>,{" "}
                <Link href={href(lang, "/f/physics")}>physics</Link> and <Link href={href(lang, "/f/earth")}>climate</Link>.
              </p>
              <p>
                It never rewrites science: for each paper it shows the sentence of the abstract that states the main result, exactly as the authors wrote it. No ads, no tracking, no account. Made by Ferced.
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}
