import { DayView } from "@/components/DayView";
import { getSiteIndex } from "@/lib/data";
import type { Metadata } from "next";
import { isLang, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return l === "es"
    ? pageMeta({
        lang: l, path: "/", absoluteTitle: true,
        title: "Pipette: papers científicos nuevos, todos los días y de todos los campos",
        description: "Cada mañana Pipette lee todos los papers nuevos de arXiv, bioRxiv, medRxiv y 58 revistas como Nature y Science, y te muestra los que valen la pena, en palabras de sus autores. Gratis y sin publicidad.",
      })
    : pageMeta({
        lang: l, path: "/", absoluteTitle: true,
        title: "Pipette: the best new research papers, every day, from every field",
        description: "Every morning Pipette reads every new paper on arXiv, bioRxiv, medRxiv and 58 journals like Nature and Science, and shows you the ones worth reading, in their authors' own words. Free, no ads.",
      });
}

export const revalidate = 300;

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  const idx = await getSiteIndex();
  if (!idx) {
    return (
      <div className="wrap page-h">
        <h1>Pipette</h1>
        <p>{t(l).day_empty}</p>
      </div>
    );
  }
  return <DayView day={idx.latest} lang={l} home />;
}
