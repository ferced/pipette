import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ForYou from "@/components/ForYou";
import { getEdition, getSiteIndex } from "@/lib/data";
import { isLang, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/[lang]/foryou">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return pageMeta({ lang: l, path: "/foryou", title: l === "es" ? "Tu feed de papers, con tus palabras" : "Your research feed, in your own words", description: l === "es" ? "Describí qué querés seguir y Pipette ordena los papers nuevos del día para vos. Sin cuenta: tus intereses quedan en tu navegador." : "Describe what you want to follow and Pipette ranks today's new papers for you. No account: your interests stay in your browser." });
}

export default async function ForYouPage({ params }: PageProps<"/[lang]/foryou">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = t(lang);
  const idx = await getSiteIndex();
  const day = idx?.latest ?? "";
  const ed = day ? await getEdition(day) : null;
  return (
    <div className="wrap">
      <div className="page-h">
        <h1>{d.foryou_title}</h1>
        <p>{d.foryou_lead}</p>
      </div>
      <Suspense>
        <ForYou day={day} lang={lang} counts={ed?.by_field ?? {}} />
      </Suspense>
    </div>
  );
}
