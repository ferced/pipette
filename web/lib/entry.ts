import type { Item, Lang, Paper } from "./types";

/** "claude-opus-5" -> "Claude Opus 5" */
export function modelName(id: string) {
  return id
    .replace(/-\d{8}$/, "")
    .split("-")
    .map((w, i, a) => (/^\d+$/.test(w) && /^\d+$/.test(a[i - 1] ?? "") ? "." + w : (i ? " " : "") + w.charAt(0).toUpperCase() + w.slice(1)))
    .join("")
    .replace(/ \./g, ".");
}
import { t } from "./i18n";

/** What a list entry needs, whether it comes from a full record or a compact one. */
export type Entry = {
  id: string; title: string; authors: string[]; nAuthors: number; venue: string; src: Paper["src"];
  field: string; topic: string; kind: string; evidence: string; appeal: number; advance: number;
  level: number; hype: number; practical: number; key: string | null; code: boolean; pub: boolean;
  date: string; url?: string; rank?: number;
  summary?: { en: string[]; es: string[]; model: string };
};

export function fromPaper(p: Paper): Entry {
  return {
    id: p.id, title: p.title, authors: p.authors.slice(0, 3), nAuthors: p.n_authors, venue: p.venue, src: p.src,
    field: p.field, topic: p.topic, kind: p.j.kind, evidence: p.j.evidence, appeal: p.j.appeal, advance: p.j.advance,
    level: p.j.level, hype: p.j.hype, practical: p.j.practical, key: p.key_text, code: p.code.length > 0,
    pub: p.status === "journal" || !!p.published, date: p.date, url: p.url,
    summary: p.summary?.sentences?.length
      ? { en: p.summary.sentences.map((s) => s.en), es: p.summary.sentences.map((s) => s.es), model: p.summary.model }
      : undefined,
  };
}

export function fromItem(i: Item, date: string): Entry {
  return {
    id: i.id, title: i.t, authors: i.au, nAuthors: i.na, venue: i.v, src: i.src, field: i.f, topic: i.tp,
    kind: i.k, evidence: i.ev, appeal: i.ap, advance: i.ad, level: i.lv, hype: i.hy, practical: i.pr,
    key: i.key, code: !!i.code, pub: !!i.pub, date, rank: i.rk,
  };
}

export type Signal = { label: string; tone: "on" | "warn" | "pre" | "plain" };

export function signals(e: Entry, lang: Lang): Signal[] {
  const d = t(lang);
  const out: Signal[] = [];
  if (e.src === "journal") out.push({ label: d.journal, tone: "on" });
  else if (e.pub) out.push({ label: d.published_version, tone: "on" });
  else out.push({ label: d.preprint_short, tone: "pre" });
  if (e.hype >= 0.6) out.push({ label: d.bold_claims, tone: "warn" });
  if (e.appeal >= 1.8) out.push({ label: d.broad, tone: "on" });
  if (e.advance >= 2.5) out.push({ label: d.big_step, tone: "plain" });
  if (e.practical >= 0.75) out.push({ label: d.practical, tone: "plain" });
  if (e.level <= 0.7) out.push({ label: d.easy_read, tone: "plain" });
  if (e.code) out.push({ label: d.has_code, tone: "plain" });
  return out;
}

export function authorLine(e: { authors: string[]; nAuthors: number }, lang: Lang) {
  const shown = e.authors.slice(0, 3).join(", ");
  const rest = e.nAuthors - Math.min(3, e.authors.length);
  return rest > 0 ? `${shown} ${t(lang).authors_more(rest)}` : shown;
}

export const SITE = "https://pipette.day";
export const permalink = (id: string) => `${SITE}/p/${id}`;

export function sourceUrl(e: Entry) {
  if (e.url) return e.url;
  if (e.src === "arxiv") return `https://arxiv.org/abs/${e.id.replace(/^arxiv-/, "")}`;
  return permalink(e.id);
}

export function bibtex(e: Entry) {
  const year = e.date.slice(0, 4);
  const first = (e.authors[0] || "anon").split(" ").pop()!.toLowerCase().replace(/[^a-z]/g, "");
  const key = `${first}${year}${e.id.slice(-5).replace(/[^a-z0-9]/gi, "")}`;
  const authors = e.nAuthors > e.authors.length ? [...e.authors, "others"] : e.authors;
  const lines = [
    `@article{${key},`,
    `  title = {${e.title}},`,
    `  author = {${authors.join(" and ")}},`,
    `  year = {${year}},`,
    e.src === "arxiv" ? `  eprint = {${e.id.replace(/^arxiv-/, "")}},\n  archivePrefix = {arXiv},` : `  journal = {${e.venue}},`,
    `  url = {${sourceUrl(e)}},`,
    `  note = {Found with Pipette, ${permalink(e.id)}}`,
    `}`,
  ];
  return lines.join("\n");
}
