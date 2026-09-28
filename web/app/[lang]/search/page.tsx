import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import Search from "@/components/Search";
import { isLang, t } from "@/lib/i18n";
import { pageMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/search">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return pageMeta({ lang: l, path: "/search", title: t(l).search_title, description: t(l).search_lead, index: false });
}

export default async function SearchPage({ params }: PageProps<"/[lang]/search">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = t(lang);
  return (
    <div className="wrap" style={{ maxWidth: 860 }}>
      <div className="page-h">
        <h1>{d.search_title}</h1>
        <p>{d.search_lead}</p>
      </div>
      <Suspense>
        <Search lang={lang} />
      </Suspense>
    </div>
  );
}
