import "server-only";
import type { DayIndex, Edition, Method, Paper, SiteIndex } from "./types";

const DATA_URL = process.env.DATA_URL || "https://pipette-day-data.s3.us-east-1.amazonaws.com";
const DATA_DIR = process.env.DATA_DIR;

/*
 * Cache tags. /api/revalidate is called by the ingest Lambda after every run and invalidates
 * DATA_TAG (files that change with every run) plus only the days and papers that run touched.
 * Paper pages never carry DATA_TAG, so a daily run does not re-render tens of thousands of them:
 * on Vercel every re-render counts as Fast Origin Transfer, and the Hobby plan allows 10 GB a month.
 */
export const DATA_TAG = "pipette-data";
export const dayTag = (day: string) => `pipette-day-${day}`;
export const paperTag = (id: string) => `pipette-paper-${id}`;

const HOUR = 3600;
const DAY = 86400;
// Fallback TTLs, in case a revalidate call is lost. Fresh data normally arrives through the tags,
// and a short TTL here would re-render every listing page (fields, topics, sources) that often.
const INDEX_TTL = 6 * HOUR;
const RECENT_DAY_TTL = 6 * HOUR;
const PAST_DAY_TTL = 7 * DAY;
export const PAPER_TTL = 30 * DAY;
const MEM_TTL = 120;

// Small in-process cache. Day files can exceed the 2 MB limit of the Next data cache,
// so large files are memoized here instead. Only those: a page that reads from memory
// skips fetch(), so it would not pick up the file's cache tags.
const mem = new Map<string, { at: number; value: unknown }>();
const DATA_CACHE_MAX = 1_900_000;

async function load<T>(path: string, ttl: number, tags: string[]): Promise<T | null> {
  const hit = mem.get(path);
  // Memory is per server instance and cannot be revalidated remotely, so keep it short.
  if (hit && Date.now() - hit.at < Math.min(ttl, MEM_TTL) * 1000) return hit.value as T;
  let value: T | null = null;
  let memoize = false;
  if (DATA_DIR) {
    const fs = await import("node:fs/promises");
    const p = await import("node:path");
    try {
      value = JSON.parse(await fs.readFile(p.join(/*turbopackIgnore: true*/ process.cwd(), DATA_DIR, path), "utf8")) as T;
      memoize = true;
    } catch {
      value = null;
    }
  } else {
    const res = await fetch(`${DATA_URL}/${path}`, { next: { revalidate: ttl, tags } }).catch(() => null);
    if (res && res.ok) {
      const text = await res.text();
      value = JSON.parse(text) as T;
      memoize = text.length > DATA_CACHE_MAX;
    }
  }
  if (value !== null && memoize) mem.set(path, { at: Date.now(), value });
  if (mem.size > 400) mem.delete(mem.keys().next().value as string);
  return value;
}

export const isDay = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().startsWith(s);

/** Days older than two days are only re-published by hand (backfills), and those runs revalidate them. */
const dayTtl = (day: string) => (Date.now() - Date.parse(day + "T00:00:00Z") > 2 * DAY * 1000 ? PAST_DAY_TTL : RECENT_DAY_TTL);

export const getSiteIndex = () => load<SiteIndex>("v1/index.json", INDEX_TTL, [DATA_TAG]);
export const getEdition = (day: string) => load<Edition>(`v1/days/${day}/edition.json`, dayTtl(day), [dayTag(day)]);
export const getDayIndex = (day: string) => load<DayIndex>(`v1/days/${day}/index.json`, dayTtl(day), [dayTag(day)]);
export const getMethod = () => load<Method>("v1/method.json", INDEX_TTL, [DATA_TAG]);

export async function getPaper(id: string) {
  if (!/^[A-Za-z0-9._-]{3,200}$/.test(id)) return null;
  return load<Paper>(`v1/p/${id}.json`, PAPER_TTL, [paperTag(id)]);
}

/** The compact lists of the most recent `n` days that have data, newest first. */
export async function getRecent(n: number) {
  const idx = await getSiteIndex();
  const days = (idx?.days ?? []).slice(0, n).map((d) => d.date);
  const lists = await Promise.all(days.map((d) => getDayIndex(d)));
  return lists.filter((x): x is NonNullable<typeof x> => !!x);
}
