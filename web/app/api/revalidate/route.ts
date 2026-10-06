import { revalidateTag } from "next/cache";
import { DATA_TAG, dayTag, isDay, paperTag } from "@/lib/data";

/**
 * Called by the ingest Lambda after it publishes an edition or its summaries, so pages
 * stop serving cached data right away. Protected by REVALIDATE_SECRET.
 *
 * Body (optional): {"days": ["YYYY-MM-DD", ...], "papers": ["<id>", ...]}, the days and papers
 * that run rewrote. Without it, today and yesterday (UTC). Never "everything": each page that
 * goes stale gets re-rendered by the next crawler that asks for it, and that is what costs.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { days?: unknown; papers?: unknown } | null;
  const now = Date.now();
  const fallback = [0, 1].map((n) => new Date(now - n * 86400000).toISOString().slice(0, 10));
  const days = (Array.isArray(body?.days) ? body.days : fallback).filter((d): d is string => typeof d === "string" && isDay(d)).slice(0, 62);
  const papers = (Array.isArray(body?.papers) ? body.papers : [])
    .filter((p): p is string => typeof p === "string" && /^[A-Za-z0-9._-]{3,200}$/.test(p))
    .slice(0, 5000);

  revalidateTag(DATA_TAG, { expire: 0 });
  for (const d of days) revalidateTag(dayTag(d), { expire: 0 });
  for (const p of papers) revalidateTag(paperTag(p), { expire: 0 });
  return Response.json({ ok: true, revalidated: { data: true, days, papers: papers.length }, now });
}
