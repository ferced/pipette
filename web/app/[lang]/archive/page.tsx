import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSiteIndex } from "@/lib/data";
import { formatDay, href, isLang, num, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/archive">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return pageMeta({ lang: l, path: "/archive", title: l === "es" ? "Archivo de ediciones diarias" : "Archive of daily editions", description: l === "es" ? "Todas las ediciones diarias de Pipette, con la lista completa de papers de cada día." : "Every daily edition of Pipette, with the full list of papers for each day." });
}

export default async function ArchivePage({ params }: PageProps<"/[lang]/archive">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = t(lang);
  const idx = await getSiteIndex();
  return (
    <div className="wrap" style={{ maxWidth: 760 }}>
      <div className="page-h">
        <h1>{d.archive_title}</h1>
        <p>{d.archive_lead}</p>
      </div>
      <ul className="days" style={{ paddingBottom: 60 }}>
        {(idx?.days ?? []).map((day) => (
          <li key={day.date}>
            <Link href={href(lang, `/d/${day.date}`)}>
              <span>{formatDay(day.date, lang)}</span>
              <span className="n">
                {num(day.total, lang)} {d.papers}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
