import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { Crumbs } from "@/components/Listing";
import { getRecent } from "@/lib/data";
import { FIELDS, href, isLang, num } from "@/lib/i18n";
import { breadcrumbs, pageMeta, url, WEBSITE_ID } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]/f">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return l === "es"
    ? pageMeta({ lang: l, path: "/f", title: "Todos los campos de la ciencia: papers nuevos por tema", description: "Explorá los papers nuevos de cada campo y tema: IA, física, medicina, biología, clima, espacio, matemática y más. Actualizado todas las mañanas, gratis y sin publicidad." })
    : pageMeta({ lang: l, path: "/f", title: "Every field of science: new papers by topic", description: "Browse new research papers in every field and topic: AI, physics, medicine, biology, climate, space, mathematics and more. Updated every morning, free and without ads." });
}

export default async function FieldsHub({ params }: PageProps<"/[lang]/f">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const days = await getRecent(7);
  const counts: Record<string, number> = {};
  const tcounts: Record<string, number> = {};
  days.forEach((d) =>
    d.papers.forEach((p) => {
      counts[p.f] = (counts[p.f] || 0) + 1;
      tcounts[`${p.f}/${p.tp}`] = (tcounts[`${p.f}/${p.tp}`] || 0) + 1;
    }),
  );
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const h1 = lang === "es" ? "Todos los campos" : "Every field";
  return (
    <div className="wrap">
      <JsonLd
        nodes={[
          { "@type": "CollectionPage", "@id": url("/f", lang), url: url("/f", lang), name: h1, inLanguage: lang, isPartOf: { "@id": WEBSITE_ID } },
          breadcrumbs([{ name: "Pipette", url: url("/", lang) }, { name: h1, url: url("/f", lang) }]),
        ]}
      />
      <div className="page-h">
        <Crumbs items={[{ name: lang === "es" ? "Inicio" : "Home", href: href(lang, "/") }, { name: h1 }]} />
        <h1>{h1}</h1>
        <p>
          {lang === "es"
            ? `En la última semana Pipette leyó ${num(total, lang)} papers nuevos. Elegí un campo o un tema para ver los mejores.`
            : `Pipette read ${num(total, lang)} new papers in the past week. Pick a field or a topic to see the best of them.`}
        </p>
      </div>
      <div className="hub">
        {FIELDS.map((f) => (
          <section key={f.id} className="hub-field">
            <h2>
              <span className="sw" style={{ background: f.color }} aria-hidden="true" />
              <Link href={href(lang, `/f/${f.id}`)}>{f[lang]}</Link>
              <span className="n">{num(counts[f.id] || 0, lang)}</span>
            </h2>
            <ul>
              {f.topics.map((t) => (
                <li key={t.id}>
                  <Link href={href(lang, `/f/${f.id}/${t.id}`)}>{t[lang]}</Link>
                  <span className="n">{num(tcounts[`${f.id}/${t.id}`] || 0, lang)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
