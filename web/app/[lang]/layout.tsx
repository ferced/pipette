import type { Metadata, Viewport } from "next";
import { STIX_Two_Text, Atkinson_Hyperlegible_Next } from "next/font/google";
import Link from "next/link";
import { notFound } from "next/navigation";
import "katex/dist/katex.min.css";
import "../globals.css";
import { Wordmark } from "@/components/Logo";
import { LangSwitch, NavLinks, SearchBox, ThemeToggle } from "@/components/client";
import { getSiteIndex } from "@/lib/data";
import { FIELDS, href, isLang, t } from "@/lib/i18n";
import { SITE } from "@/lib/entry";
import { FERCED, WEBSITE_ID } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";

const stix = STIX_Two_Text({ subsets: ["latin"], variable: "--font-stix", display: "optional" });
const atkinson = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-atkinson", display: "optional", adjustFontFallback: false });

const THEME_SCRIPT = `try{var t=localStorage.getItem("pipette.theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export function generateStaticParams() {
  return [{ lang: "en" }, { lang: "es" }];
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  const description =
    l === "es"
      ? "Pipette lee todos los días cada paper nuevo de arXiv, bioRxiv, medRxiv y 58 revistas líderes, y te trae los que valen la pena, en palabras de sus autores. Gratis, sin publicidad y sin cuentas."
      : "Pipette reads every new paper on arXiv, bioRxiv, medRxiv and 58 leading journals each day and brings you the ones worth your time, in their authors' own words. Free, no ads, no accounts.";
  return {
    metadataBase: new URL(SITE),
    title: { default: `Pipette — ${t(l).tagline}`, template: "%s | Pipette" },
    description,
    applicationName: "Pipette",
    authors: [{ name: "Ferced", url: "https://ferced.com" }],
    creator: "Ferced",
    publisher: "Ferced",
    category: "science",
    formatDetection: { telephone: false, email: false, address: false },
    openGraph: { siteName: "Pipette", type: "website", locale: l === "es" ? "es_AR" : "en_US", description },
    twitter: { card: "summary_large_image" },
    alternates: { types: { "application/rss+xml": [{ url: "/rss/edition.xml", title: "Pipette daily edition" }] } },
    appleWebApp: { title: "Pipette", statusBarStyle: "default" },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2f0" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1412" },
  ],
};

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = t(lang);
  const idx = await getSiteIndex();
  const latest = idx?.latest ?? "";
  const siteLd = [
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: SITE,
      name: "Pipette",
      alternateName: "pipette.day",
      description: d.tagline,
      inLanguage: ["en", "es"],
      isAccessibleForFree: true,
      publisher: { "@id": FERCED["@id"] },
      potentialAction: { "@type": "SearchAction", target: `${SITE}/search?q={search_term_string}`, "query-input": "required name=search_term_string" },
    },
    { ...FERCED, logo: `${SITE}/apple-icon`, sameAs: ["https://github.com/ferced"] },
  ];
  return (
    <html lang={lang} className={`${stix.variable} ${atkinson.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#main">{lang === "es" ? "Ir al contenido" : "Skip to content"}</a>
        <header className="top">
          <div className="wrap top-in">
            <Link href={href(lang, "/")} className="brand" aria-label="Pipette">
              <Wordmark />
            </Link>
            <NavLinks lang={lang} latest={latest} />
            <div className="tools">
              <SearchBox lang={lang} />
              <LangSwitch lang={lang} />
              <ThemeToggle label={d.theme} />
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="wrap footer-in">
            <div>
              <p className="promise">{d.footer_promise}</p>
              <p>{d.footer_made}</p>
            </div>
            <nav aria-label="Footer">
              <Link href={href(lang, "/about")}>{d.nav_about}</Link>
              <Link href={href(lang, "/about#method")}>{d.footer_method}</Link>
              <Link href={href(lang, "/archive")}>{d.nav_archive}</Link>
              <Link href={href(lang, "/open-data")}>{d.footer_data}</Link>
              <Link href={href(lang, "/f")}>{lang === "es" ? "Todos los campos" : "All fields"}</Link>
              <a href="/rss/edition.xml">{d.footer_rss}</a>
            </nav>
          </div>
          <nav className="wrap footer-fields" aria-label={lang === "es" ? "Campos" : "Fields"}>
            {FIELDS.map((f) => (
              <Link key={f.id} href={href(lang, `/f/${f.id}`)}>
                {f[lang]}
              </Link>
            ))}
            <Link href={href(lang, "/source/arxiv")}>arXiv</Link>
            <Link href={href(lang, "/source/biorxiv")}>bioRxiv</Link>
            <Link href={href(lang, "/source/medrxiv")}>medRxiv</Link>
            <Link href={href(lang, "/source/journals")}>{lang === "es" ? "Revistas" : "Journals"}</Link>
          </nav>
          <div className="wrap footer-bar">
            <span className="made-in">
              {lang === "es" ? "Hecho en Argentina" : "Made in Argentina"}
              <svg width="20" height="13" viewBox="0 0 20 13" role="img" aria-label="Argentina">
                <rect width="20" height="13" rx="2" fill="#74acdf" />
                <rect y="4.33" width="20" height="4.34" fill="#fff" />
                <circle cx="10" cy="6.5" r="1.5" fill="#f6b40e" />
              </svg>
            </span>
            <span>
              &copy; 2026 Pipette · {lang === "es" ? "Un producto de" : "A product of"}{" "}
              <a href="https://ferced.com" target="_blank" rel="noopener">
                Ferced
              </a>
            </span>
          </div>
        </footer>
        <JsonLd nodes={siteLd} />
      </body>
    </html>
  );
}
