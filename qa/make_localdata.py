"""Builds qa/localdata: a real day from production plus the dry-run summaries, so the site can
be checked locally with DATA_DIR=../qa/localdata. Nothing here is published."""
import gzip, json, os, sys, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ingest"))
from pipette import enrich, jev  # noqa: E402
BASE = "https://pipette.day/data/"
OUT = os.path.join(os.path.dirname(__file__), "localdata")
def get(path):
    b = urllib.request.urlopen(BASE + path).read()
    return json.loads(gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b)
def put(path, obj):
    f = os.path.join(OUT, path); os.makedirs(os.path.dirname(f), exist_ok=True)
    json.dump(obj, open(f, "w", encoding="utf-8"), ensure_ascii=False)
day = sys.argv[1] if len(sys.argv) > 1 else "2026-09-25"
summaries = json.load(open(os.path.join(os.path.dirname(__file__), "summary-dryrun", f"{day}.json"), encoding="utf-8"))
idx = get("v1/index.json"); put("v1/index.json", {**idx, "latest": day, "days": [d for d in idx["days"] if d["date"] <= day]})
ed = get(f"v1/days/{day}/edition.json")
for p in ed["picks"]:
    p["summary"] = summaries.get(p["id"])
    put(f"v1/p/{p['id']}.json", p)
put(f"v1/days/{day}/edition.json", ed)
di = get(f"v1/days/{day}/index.json"); put(f"v1/days/{day}/index.json", di)
put("v1/search/recent.json", get("v1/search/recent.json"))
put("v1/method.json", {**enrich.method_doc(), "model_version": "jev-1.13.0"})
for c in di["papers"][:0]: pass
print("ok", sum(1 for p in ed["picks"] if p.get("summary")), "summaries in", OUT)
