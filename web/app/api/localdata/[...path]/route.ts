// Development only: serves the ingest output folder so the browser can read day files
// the same way it reads /data/... in production. Disabled when DATA_DIR is not set.
import { readFile } from "node:fs/promises";
import { join, normalize } from "node:path";

export async function GET(_req: Request, ctx: RouteContext<"/api/localdata/[...path]">) {
  const dir = process.env.DATA_DIR;
  if (!dir) return new Response("Not found", { status: 404 });
  const { path } = await ctx.params;
  const rel = normalize(path.join("/"));
  if (rel.includes("..")) return new Response("Bad path", { status: 400 });
  try {
    const body = await readFile(join(/*turbopackIgnore: true*/ process.cwd(), dir, rel), "utf8");
    return new Response(body, { headers: { "content-type": "application/json" } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
