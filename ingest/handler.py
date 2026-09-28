"""Entry point for AWS Lambda and for local runs.

Lambda:  event {"day": "YYYY-MM-DD"} (optional, defaults to today UTC),
         {"backfill": 7} to process the last N days,
         {"refresh": true} to re-run today only if arXiv was still missing on a weekday.
Local:   python handler.py 2026-09-25 [--out ./out] [--limit 50]
"""
import os
import sys
import time
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pipette import enrich, indexnow, jev, publish, sources  # noqa: E402


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
    ed = publish.publish_day(store, day, papers, method, tokens, log=log)
    if ed and store.bucket:
        ids = [p["id"] for p in papers if p.get("field")]
        indexnow.ping(indexnow.urls_for_day(day, ids, sorted(ed["by_field"].keys())), log=log)
    log(f"[{day}] done in {time.time()-t0:.0f}s")
    return {"day": day, "total": ed["total"] if ed else 0}


def lambda_handler(event, context):
    event = event or {}
    store = publish.Store(bucket=os.environ["BUCKET"])
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
    run_day(day, publish.Store(root=None if bucket else out, bucket=bucket), limit=limit)
