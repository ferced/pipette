"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { href, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { bibtex, type Entry } from "@/lib/entry";

/* ------------------------------------------------------------ saved papers (localStorage) */

const KEY = "pipette.saved.v1";
const listeners = new Set<() => void>();
let cache: Entry[] | null = null;

function read(): Entry[] {
  if (cache) return cache;
  try {
    cache = JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    cache = [];
  }
  return cache!;
}
function write(list: Entry[]) {
  cache = list;
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage full or blocked: keep it in memory for this visit */
  }
  listeners.forEach((l) => l());
}
const EMPTY: Entry[] = [];
export function useSaved() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      const onStorage = (e: StorageEvent) => {
        if (e.key === KEY) {
          cache = null;
          cb();
        }
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(cb);
        window.removeEventListener("storage", onStorage);
      };
    },
    read,
    () => EMPTY,
  );
}
export const savedApi = {
  toggle(e: Entry) {
    const list = read();
    write(list.some((x) => x.id === e.id) ? list.filter((x) => x.id !== e.id) : [e, ...list]);
  },
  clear() {
    write([]);
  },
};

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="13" height="15" viewBox="0 0 13 15" aria-hidden="true">
      <path d="M1.5 1.5h10v12l-5-3.6-5 3.6z" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function SaveButton({ entry, lang }: { entry: Entry; lang: Lang }) {
  const saved = useSaved();
  const on = saved.some((x) => x.id === entry.id);
  const d = t(lang);
  return (
    <button type="button" className="btn" aria-pressed={on} onClick={() => savedApi.toggle(entry)} title={on ? d.saved : d.save}>
      <BookmarkIcon filled={on} />
      {on ? d.saved : d.save}
    </button>
  );
}

/* ------------------------------------------------------------ header widgets */

/** English pages are rendered internally under /en; the public URL has no prefix. */
export function usePublicPath() {
  const p = usePathname() || "/";
  return p.replace(/^\/en(?=\/|$)/, "") || "/";
}

export function NavLinks({ lang, latest }: { lang: Lang; latest: string }) {
  const path = usePublicPath();
  const d = t(lang);
  const items: [string, string][] = [
    [href(lang, "/"), d.nav_today],
    [href(lang, `/d/${latest}/all`), d.nav_explore],
    [href(lang, "/f"), lang === "es" ? "Campos" : "Fields"],
    [href(lang, "/foryou"), d.nav_foryou],
    [href(lang, "/saved"), d.nav_saved],
    [href(lang, "/archive"), d.nav_archive],
    [href(lang, "/about"), d.nav_about],
  ];
  const norm = (p: string) => p.replace(/\/$/, "") || "/";
  const current = norm(path || "/");
  return (
    <nav className="nav" aria-label="Main">
      {items.map(([h, label]) => {
        const active =
          norm(h) === current ||
          (h.includes("/all") && current.endsWith("/all")) ||
          (norm(h).endsWith("/f") && /\/f(\/|$)/.test(current));
        return (
          <Link key={h} href={h} aria-current={active ? "page" : undefined}>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ThemeToggle({ label }: { label: string }) {
  const toggle = () => {
    const root = document.documentElement;
    const cur = root.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("pipette.theme", next);
    } catch {}
  };
  return (
    <button type="button" className="iconbtn" onClick={toggle} aria-label={label} title={label}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 1.8a6.2 6.2 0 0 1 0 12.4z" fill="currentColor" />
      </svg>
    </button>
  );
}

export function LangSwitch({ lang }: { lang: Lang }) {
  const path = usePublicPath();
  const other: Lang = lang === "en" ? "es" : "en";
  const bare = lang === "es" ? path.replace(/^\/es/, "") || "/" : path;
  const target = href(other, bare);
  return (
    <a
      className="iconbtn"
      href={target}
      hrefLang={other}
      lang={other}
      onClick={() => {
        document.cookie = `lang=${other}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      {other === "es" ? "ES" : "EN"}
      <span className="sr">{t(lang).lang_other}</span>
    </a>
  );
}

export function SearchBox({ lang }: { lang: Lang }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      className="searchbox"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim()) router.push(href(lang, `/search?q=${encodeURIComponent(q.trim())}`));
      }}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="6" cy="6" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.5 9.5l3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <label className="sr" htmlFor="q">{t(lang).search_ph}</label>
      <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t(lang).search_ph} />
    </form>
  );
}

/* ------------------------------------------------------------ paper page actions */

export function CopyCite({ entry, lang }: { entry: Entry; lang: Lang }) {
  const [done, setDone] = useState(false);
  const d = t(lang);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(bibtex(entry));
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {}
      }}
    >
      {done ? d.copied : d.cite}
    </button>
  );
}

export function ShareButton({ url, title, lang }: { url: string; title: string; lang: Lang }) {
  const [done, setDone] = useState(false);
  const d = t(lang);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          if (navigator.share) await navigator.share({ url, title });
          else {
            await navigator.clipboard.writeText(url);
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          }
        } catch {}
      }}
    >
      {done ? d.copied : d.share}
    </button>
  );
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
