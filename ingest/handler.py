"""Entry point for AWS Lambda and for local runs.

Lambda:  event {"day": "YYYY-MM-DD"} (optional, defaults to today UTC),
         {"backfill": 7} to process the last N days,
         {"refresh": true} to re-run today only if arXiv was still missing on a weekday.
         {"summarize": ["2026-09-25", ...]} to add AI summaries to published editions.
Local:   python handler.py 2026-09-25 [--out ./out] [--limit 50] [--bucket name] [--summarize-only [--force]]
"""
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipette import enrich, indexnow, jev, publish, sources, summarize  # noqa: E402


def run_day(day, store, limit=None, log=print):
    t0 = time.time()
    papers = sources.fetch_all(day, log=log)
    if limit:
        papers = papers[:limit]
    if not papers:
        log(f"[{day}] no papers, nothing to publish")
        return None
    papers, tokens = enrich.enrich_all(papers, workers=int(os.environ.get("JEV_WORKERS", "12")), log=log)
    retry = [p for p in papers if p.get("j") is None]
    if retry:
        log(f"[jev] retrying {len(retry)} failed papers")
        again, t2 = enrich.enrich_all(retry, workers=4, log=log)
        tokens += t2
    model_version = next((p["j"].get("model") for p in papers if p.get("j")), jev.MODEL)
    method = {**enrich.method_doc(), "model_version": model_version}
    def annotate(edition):
        # Only openly licensed abstracts get a summary (closed ones are not republished).
        summarize.summarize_records([p for p in edition if p.get("open", True)], log=log)

    ed = publish.publish_day(store, day, papers, method, tokens, log=log, annotate=annotate)
    if ed and store.bucket:
        ids = [p["id"] for p in papers if p.get("field")]
        indexnow.ping(indexnow.urls_for_day(day, ids, sorted(ed["by_field"].keys())), log=log)
    log(f"[{day}] done in {time.time()-t0:.0f}s")
    return {"day": day, "total": ed["total"] if ed else 0}


def summarize_day(day, store, log=print, force=False):
    """Adds summaries to an already published edition, without re-reading any paper."""
    ed = store.get(f"v1/days/{day}/edition.json")
    if not ed:
        log(f"[{day}] no edition")
        return {"day": day, "summarized": 0}
    todo = [p for p in ed["picks"] if p.get("sentences") and (force or not p.get("summary"))]
    done = summarize.summarize_records(todo, log=log)
    for p in todo:
        if p.get("summary"):
            store.put(f"v1/p/{p['id']}.json", p, max_age=86400)
    store.put(f"v1/days/{day}/edition.json", ed, max_age=600)
    return {"day": day, "summarized": done, "candidates": len(todo)}


def lambda_handler(event, context):
    event = event or {}
    if event.get("selftest"):
        import anthropic

        return {"anthropic": anthropic.__version__, "summaries": summarize.enabled(), "model": summarize.MODEL}
    store = publish.Store(bucket=os.environ["BUCKET"])
    if event.get("summarize"):
        days = event["summarize"] if isinstance(event["summarize"], list) else [event["summarize"]]
        return [summarize_day(d, store, force=bool(event.get("force"))) for d in days]
    if event.get("backfill"):
        n = int(event["backfill"])
        today = datetime.now(timezone.utc)
        days = [(today - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(n - 1, -1, -1)]
    else:
        day = event.get("day") or sources.today_utc()
        if event.get("refresh"):
            ed = store.get(f"v1/days/{day}/edition.json")
            weekday = datetime.strptime(day, "%Y-%m-%d").weekday() < 5
            if ed and (ed.get("by_source", {}).get("arxiv") or not weekday):
                return [{"day": day, "skipped": "complete"}]
        days = [day]
    return [run_day(d, store) for d in days]


if __name__ == "__main__":
    args = sys.argv[1:]
    day = args[0] if args and not args[0].startswith("--") else sources.today_utc()
    out = args[args.index("--out") + 1] if "--out" in args else os.path.join(os.path.dirname(__file__), "out")
    limit = int(args[args.index("--limit") + 1]) if "--limit" in args else None
    bucket = args[args.index("--bucket") + 1] if "--bucket" in args else None
    store = publish.Store(root=None if bucket else out, bucket=bucket)
    if "--summarize-only" in args:
        print(summarize_day(day, store, force="--force" in args))
    else:
        run_day(day, store, limit=limit)
