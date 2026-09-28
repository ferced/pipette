import { revalidateTag } from "next/cache";
import { DATA_TAG } from "@/lib/data";

/**
 * Called by the ingest Lambda after it publishes an edition or its summaries, so pages
 * stop serving cached data right away. Protected by REVALIDATE_SECRET.
 */
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) return Response.json({ ok: false }, { status: 401 });
  revalidateTag(DATA_TAG, { expire: 0 });
  return Response.json({ ok: true, revalidated: DATA_TAG, now: Date.now() });
}
