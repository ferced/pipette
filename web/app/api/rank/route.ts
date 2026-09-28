import { getDayIndex, getSiteIndex, isDay } from "@/lib/data";
import { texPlain } from "@/lib/tex";
import type { Item } from "@/lib/types";

/**
 * POST /api/rank  { interest: string, fields?: string[], day?: "YYYY-MM-DD" }
 * Ranks the day's papers against a reader's own description of their interests.
 * Nothing is stored: the sentence is sent to Jev once and forgotten.
 */

export const maxDuration = 30;

const JEV = "https://api.typesafe.ai/v1/systemone";
const CHUNK = 40;
const MAX_CANDIDATES = 240;

const STOP = new Set(
  "the and for with about from that this into over under new any all are was were how what which who why when where our your their its not but can may more most less very also just like want interested interest follow following research papers paper study studies anything something things thing los las del por para con sobre que una uno unos unas como mas más todo toda todos cosas cosa nuevo nueva nuevos nuevas quiero sigo seguir interesa interesan investigación papers estudios".split(" "),
);

const hits = new Map<string, { n: number; reset: number }>();
function limited(ip: string) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.reset) {
    hits.set(ip, { n: 1, reset: now + 10 * 60_000 });
    return false;
  }
  h.n += 1;
  if (hits.size > 5000) hits.clear();
  return h.n > 30;
}

function tokens(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => w.slice(0, 6));
}

function lexical(interest: string[], p: Item) {
  if (!interest.length) return 0;
  const title = new Set(tokens(texPlain(p.t)));
  const key = new Set(tokens(p.key || ""));
  let s = 0;
  for (const w of interest) {
    if (title.has(w)) s += 2;
    if (key.has(w)) s += 1;
  }
  return s;
}

async function askJev(interest: string, batch: Item[]) {
  const papers: Record<string, { title: string; main_result: string }> = {};
  const questions: Record<string, unknown> = {};
  batch.forEach((p, i) => {
    papers[`p${i}`] = { title: texPlain(p.t), main_result: texPlain(p.key || "") };
    questions[`q${i}`] = {
      type: "noul",
      instructions: `Would a reader whose interests are described in \`reader_interest\` want to read \`papers.p${i}\`?`,
      criteria: {
        true: "The paper is about what the reader says they want to follow",
        false: "The paper is unrelated, or only loosely related, to what the reader wants to follow",
      },
    };
  });
  const res = await fetch(JEV, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "jev-latest", state: { reader_interest: interest, papers }, questions }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jev ${res.status}`);
  const j = (await res.json()) as { answers: Record<string, { noul: number }> };
  return batch.map((p, i) => ({ p, s: j.answers[`q${i}`]?.noul ?? 0 }));
}

export async function POST(req: Request) {
  const ip = (req.headers.get("x-forwarded-for") || "local").split(",")[0].trim();
  if (limited(ip)) return Response.json({ error: "rate" }, { status: 429 });

  let body: { interest?: string; fields?: string[]; day?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const interest = (body.interest || "").trim().slice(0, 300);
  const fields = Array.isArray(body.fields) ? body.fields.filter((f) => typeof f === "string").slice(0, 13) : [];
  if (interest.length < 3) return Response.json({ error: "interest too short" }, { status: 400 });
  if (!process.env.JEV_API_KEY) return Response.json({ error: "not configured" }, { status: 503 });

  const day = body.day && isDay(body.day) ? body.day : (await getSiteIndex())?.latest;
  const idx = day ? await getDayIndex(day) : null;
  if (!idx) return Response.json({ error: "no data" }, { status: 404 });

  const pool = fields.length ? idx.papers.filter((p) => fields.includes(p.f)) : idx.papers;
  const words = tokens(interest);
  const scored = pool.map((p) => ({ p, l: lexical(words, p) }));
  const byWords = scored.filter((x) => x.l > 0).sort((a, b) => b.l - a.l || b.p.rk - a.p.rk).slice(0, 150).map((x) => x.p);
  const seen = new Set(byWords.map((p) => p.id));
  const byRank = pool
    .slice()
    .sort((a, b) => b.rk - a.rk)
    .filter((p) => !seen.has(p.id))
    .slice(0, MAX_CANDIDATES - byWords.length);
  const candidates = [...byWords, ...byRank].slice(0, MAX_CANDIDATES);

  const batches: Item[][] = [];
  for (let i = 0; i < candidates.length; i += CHUNK) batches.push(candidates.slice(i, i + CHUNK));
  try {
    const results = (await Promise.all(batches.map((b) => askJev(interest, b)))).flat();
    results.sort((a, b) => b.s - a.s || b.p.rk - a.p.rk);
    return Response.json(
      {
        day,
        candidates: candidates.length,
        results: results.slice(0, 40).map((r) => ({ ...r.p, match: Math.round(r.s * 100) / 100 })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "ranking failed" }, { status: 502 });
  }
}
