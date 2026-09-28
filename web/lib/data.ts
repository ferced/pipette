import "server-only";
import type { DayIndex, Edition, Method, Paper, SiteIndex } from "./types";

const DATA_URL = process.env.DATA_URL || "https://pipette-day-data.s3.us-east-1.amazonaws.com";
const DATA_DIR = process.env.DATA_DIR;
/** Every fetch of Pipette's data carries this tag; /api/revalidate invalidates it after each daily run. */
export const DATA_TAG = "pipette-data";
const MEM_TTL = 120;

// Small in-process cache. Day files can exceed the 2 MB limit of the Next data cache,
// so large files are memoized here instead.
const mem = new Map<string, { at: number; value: unknown }>();

async function load<T>(path: string, ttl: number): Promise<T | null> {
  const hit = mem.get(path);
  // Memory is per server instance and cannot be revalidated remotely, so keep it short.
  if (hit && Date.now() - hit.at < Math.min(ttl, MEM_TTL) * 1000) return hit.value as T;
  let value: T | null = null;
  if (DATA_DIR) {
    const fs = await import("node:fs/promises");
    const p = await import("node:path");
    try {
      value = JSON.parse(await fs.readFile(p.join(/*turbopackIgnore: true*/ process.cwd(), DATA_DIR, path), "utf8")) as T;
    } catch {
      value = null;
    }
  } else {
    const res = await fetch(`${DATA_URL}/${path}`, { next: { revalidate: ttl, tags: [DATA_TAG] } }).catch(() => null);
    value = res && res.ok ? ((await res.json()) as T) : null;
  }
  if (value !== null) mem.set(path, { at: Date.now(), value });
  if (mem.size > 400) mem.delete(mem.keys().next().value as string);
  return value;
}

export const getSiteIndex = () => load<SiteIndex>("v1/index.json", 300);
export const getEdition = (day: string) => load<Edition>(`v1/days/${day}/edition.json`, 600);
export const getDayIndex = (day: string) => load<DayIndex>(`v1/days/${day}/index.json`, 600);
export const getMethod = () => load<Method>("v1/method.json", 3600);

export async function getPaper(id: string) {
  if (!/^[A-Za-z0-9._-]{3,200}$/.test(id)) return null;
  return load<Paper>(`v1/p/${id}.json`, 86400);
}

export const isDay = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().startsWith(s);

/** The compact lists of the most recent `n` days that have data, newest first. */
export async function getRecent(n: number) {
  const idx = await getSiteIndex();
  const days = (idx?.days ?? []).slice(0, n).map((d) => d.date);
  const lists = await Promise.all(days.map((d) => getDayIndex(d)));
  return lists.filter((x): x is NonNullable<typeof x> => !!x);
}
