import type { Metadata } from "next";
import { SITE } from "./entry";
import type { Lang } from "./types";

/** Public URL of a path in a language. English lives at the root. */
export const url = (path: string, lang: Lang = "en") =>
  SITE + (lang === "es" ? (path === "/" ? "/es" : `/es${path}`) : path === "/" ? "" : path);

/** Canonical + hreflang (en, es, x-default) for a path that exists in both languages. */
export function alternates(path: string, lang: Lang): Metadata["alternates"] {
  return {
    canonical: url(path, lang),
    languages: { en: url(path, "en"), es: url(path, "es"), "x-default": url(path, "en") },
  };
}

/** Standard metadata block for a page: title, description, canonical, hreflang, Open Graph. */
export function pageMeta(opts: {
  lang: Lang;
  path: string;
  title: string;
  description: string;
  index?: boolean;
  ogType?: "website" | "article";
  absoluteTitle?: boolean;
}): Metadata {
  const { lang, path, title, description, index = true, ogType = "website", absoluteTitle = false } = opts;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: alternates(path, lang),
    robots: index ? { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } : { index: false, follow: true },
    openGraph: {
      type: ogType,
      title,
      description,
      url: url(path, lang),
      siteName: "Pipette",
      locale: lang === "es" ? "es_AR" : "en_US",
      alternateLocale: lang === "es" ? ["en_US"] : ["es_AR"],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const FERCED = { "@type": "Organization", "@id": "https://ferced.com/#organization", name: "Ferced", url: "https://ferced.com/" };
export const WEBSITE_ID = `${SITE}/#website`;

export function breadcrumbs(items: { name: string; url: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: it.url })),
  };
}

export function ld(...nodes: object[]) {
  return JSON.stringify({ "@context": "https://schema.org", "@graph": nodes }).replace(/</g, "\\u003c");
}

export function clampText(s: string, n = 158) {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t;
}
