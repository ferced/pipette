import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Saved from "@/components/Saved";
import { isLang, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/saved">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return pageMeta({ lang: l, path: "/saved", title: t(l).saved_title, description: t(l).saved_lead, index: false });
}

export default async function SavedPage({ params }: PageProps<"/[lang]/saved">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = t(lang);
  return (
    <div className="wrap">
      <div className="page-h">
        <h1>{d.saved_title}</h1>
        <p>{d.saved_lead}</p>
      </div>
      <Saved lang={lang} />
    </div>
  );
}
