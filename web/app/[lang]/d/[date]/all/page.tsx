import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Explorer from "@/components/Explorer";
import { isDay } from "@/lib/data";
import { formatDay, isLang, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export const revalidate = 600;
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/d/[date]/all">): Promise<Metadata> {
  const { lang, date } = await params;
  const l = isLang(lang) ? lang : "en";
  return pageMeta({ lang: l, path: `/d/${date}/all`, title: `${t(l).explore_title}, ${formatDay(date, l)}`, description: t(l).edition_note, index: false });
}

export default async function AllPage({ params }: PageProps<"/[lang]/d/[date]/all">) {
  const { lang, date } = await params;
  if (!isLang(lang) || !isDay(date)) notFound();
  const d = t(lang);
  return (
    <div className="wrap">
      <div className="page-h">
        <h1>{d.explore_title}</h1>
        <p>{formatDay(date, lang)}</p>
      </div>
      <Suspense fallback={<p className="empty"><span className="spin" /> {d.loading}</p>}>
        <Explorer date={date} lang={lang} />
      </Suspense>
    </div>
  );
}
