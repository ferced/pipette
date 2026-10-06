import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Explorer from "@/components/Explorer";
import { getSiteIndex, isDay } from "@/lib/data";
import { LATEST, formatDay, isLang, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export const revalidate = 600;
export function generateStaticParams() {
  return [];
}

/** "latest" (the header link) resolves here, so the layout does not have to read the site index. */
async function resolve(date: string) {
  if (date !== LATEST) return isDay(date) ? date : null;
  return (await getSiteIndex())?.latest ?? null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/d/[date]/all">): Promise<Metadata> {
  const { lang, date } = await params;
  const l = isLang(lang) ? lang : "en";
  const day = (await resolve(date)) ?? date;
  return pageMeta({ lang: l, path: `/d/${date}/all`, title: `${t(l).explore_title}, ${formatDay(day, l)}`, description: t(l).edition_note, index: false });
}

export default async function AllPage({ params }: PageProps<"/[lang]/d/[date]/all">) {
  const { lang, date } = await params;
  const day = await resolve(date);
  if (!isLang(lang) || !day) notFound();
  const d = t(lang);
  return (
    <div className="wrap">
      <div className="page-h">
        <h1>{d.explore_title}</h1>
        <p>{formatDay(day, lang)}</p>
      </div>
      <Suspense fallback={<p className="empty"><span className="spin" /> {d.loading}</p>}>
        <Explorer date={day} lang={lang} />
      </Suspense>
    </div>
  );
}
