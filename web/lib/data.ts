import "server-only";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { gunzipSync } from "node:zlib";
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

async function readLocal<T>(path: string): Promise<T | null> {
  const fs = await import("node:fs/promises");
  const p = await import("node:path");
  try {
    return JSON.parse(await fs.readFile(p.join(/*turbopackIgnore: true*/ process.cwd(), DATA_DIR!, path), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Small files, through the Next data cache, so pages carry their tags. */
async function load<T>(path: string, ttl: number, tags: string[]): Promise<T | null> {
  if (DATA_DIR) return readLocal<T>(path);
  const res = await fetch(`${DATA_URL}/${path}`, { next: { revalidate: ttl, tags } }).catch(() => null);
  return res && res.ok ? ((await res.json()) as T) : null;
}

/** A plain HTTP read, which Next does not see (it only patches fetch). */
function readRaw(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const get = url.startsWith("https:") ? httpsGet : httpGet;
    const req = get(url, { headers: { "Accept-Encoding": "gzip" }, timeout: 20000 }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return resolve(null);
      }
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("error", () => resolve(null));
      res.on("end", () => {
        const body = Buffer.concat(chunks);
        try {
          resolve(res.headers["content-encoding"] === "gzip" ? gunzipSync(body) : body);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

/*
 * Day indexes (every paper of a day, ~1.3 MB on a weekday) skip the Next data cache: paper and
 * listing pages read them on every render, and on Vercel each data-cache read counts as origin
 * transfer (43 GB in the 30 days before the October 2026 block). The bucket is in the functions'
 * region, so reading it directly costs nothing. They are memoized per server instance instead;
 * pages that need fresh day data also read a small tagged file (site index or edition).
 */
const dayMem = new Map<string, { at: number; value: DayIndex }>();
const DAY_MEM_MAX = 10;

export const isDay = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().startsWith(s);

/** Days older than two days are only re-published by hand (backfills), and those runs revalidate them. */
const isPast = (day: string) => Date.now() - Date.parse(day + "T00:00:00Z") > 2 * DAY * 1000;
const dayTtl = (day: string) => (isPast(day) ? PAST_DAY_TTL : RECENT_DAY_TTL);

export const getSiteIndex = () => load<SiteIndex>("v1/index.json", INDEX_TTL, [DATA_TAG]);
export const getEdition = (day: string) => load<Edition>(`v1/days/${day}/edition.json`, dayTtl(day), [dayTag(day)]);
export const getMethod = () => load<Method>("v1/method.json", INDEX_TTL, [DATA_TAG]);

export async function getDayIndex(day: string): Promise<DayIndex | null> {
  const path = `v1/days/${day}/index.json`;
  if (DATA_DIR) return readLocal<DayIndex>(path);
  const hit = dayMem.get(day);
  if (hit && Date.now() - hit.at < (isPast(day) ? HOUR : 120) * 1000) return hit.value;
  const raw = await readRaw(`${DATA_URL}/${path}`);
  let value: DayIndex | null = null;
  try {
    value = raw ? (JSON.parse(raw.toString("utf8")) as DayIndex) : null;
  } catch {
    value = null;
  }
  if (value) {
    dayMem.delete(day);
    dayMem.set(day, { at: Date.now(), value });
    if (dayMem.size > DAY_MEM_MAX) dayMem.delete(dayMem.keys().next().value as string);
  }
  return value;
}

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
