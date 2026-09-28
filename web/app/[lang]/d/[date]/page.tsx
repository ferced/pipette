import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DayView } from "@/components/DayView";
import { getEdition, isDay } from "@/lib/data";
import { pageMeta } from "@/lib/seo";
import { isLang } from "@/lib/i18n";

export const revalidate = 600;

export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: PageProps<"/[lang]/d/[date]">): Promise<Metadata> {
  const { lang, date } = await params;
  const l = isLang(lang) ? lang : "en";
  const long = new Date(date + "T12:00:00Z").toLocaleDateString(l === "es" ? "es-AR" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  const ed = isDay(date) ? await getEdition(date) : null;
  const n = ed ? ed.total.toLocaleString(l === "es" ? "es-AR" : "en-US") : "";
  return l === "es"
    ? pageMeta({ lang: l, path: `/d/${date}`, title: `Papers científicos nuevos del ${long}`, description: `Los ${ed?.picks.length ?? 20} mejores de ${n} papers nuevos del ${long}, de arXiv, bioRxiv, medRxiv y revistas líderes, con el resultado principal en palabras de sus autores.` })
    : pageMeta({ lang: l, path: `/d/${date}`, title: `New research papers, ${long}`, description: `The ${ed?.picks.length ?? 20} best of ${n} new research papers from ${long}, from arXiv, bioRxiv, medRxiv and leading journals, with the main result in the authors' own words.` });
}

export default async function DayPage({ params }: PageProps<"/[lang]/d/[date]">) {
  const { lang, date } = await params;
  if (!isLang(lang) || !isDay(date)) notFound();
  return <DayView day={date} lang={lang} />;
}
