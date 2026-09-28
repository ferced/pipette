"""Rank papers, pick the daily edition and write the public JSON files.

Layout (all JSON, gzip-encoded):
  v1/index.json                 list of days
  v1/method.json                the exact questions and ranking rule
  v1/days/<day>/edition.json    counts + the picked papers (full records)
  v1/days/<day>/index.json      every paper of the day (compact records)
  v1/p/<id>.json                one full record per paper (permalink data)
  v1/search/recent.json         titles of the last 14 days, for search
"""
import gzip
import json
import os
from collections import Counter, defaultdict
from datetime import datetime, timezone

EDITION_SIZE = 20
PER_FIELD = 3
PER_TOPIC = 2
HYPE_FLAG = 0.6  # same threshold the site uses for the "bold claims" label


def rank(p):
    j = p.get("j")
    if not j:
        return -9.0
    s = j["appeal"] + 0.9 * j["advance"] + 0.4 * j["practical"] - 2.4 * max(0.0, j["hype"] - 0.5) - 0.25 * j["level"]
    if len(p.get("abstract") or "") < 300:
        s -= 1.0
    if j.get("kind") == "perspective":
        s -= 0.3
    return round(s, 3)


def pick_edition(papers):
    # Papers flagged for claiming more than they show never make the edition (they stay in the full list).
    ok = [p for p in papers if p.get("j") and p.get("sentences") and p.get("field") and p["j"]["hype"] < HYPE_FLAG]
    ok.sort(key=lambda p: -p["rank"])
    # A quiet day (weekends: arXiv does not announce) gets a shorter edition.
    size = max(8, min(EDITION_SIZE, round(len(ok) / 12)))
    picked, per_field, per_topic = [], Counter(), Counter()
    # 1) best paper of each field, if it is good enough to stand next to the others
    best_by_field = {}
    for p in ok:
        best_by_field.setdefault(p["field"], p)
    floor = ok[min(len(ok) - 1, size * 2)]["rank"] if ok else 0
    for p in sorted(best_by_field.values(), key=lambda p: -p["rank"]):
        if p["rank"] >= floor and len(picked) < size:
            picked.append(p)
            per_field[p["field"]] += 1
            per_topic[(p["field"], p["topic"])] += 1
    # 2) fill by rank with diversity caps
    for p in ok:
        if len(picked) >= size:
            break
        if p in picked or per_field[p["field"]] >= PER_FIELD or per_topic[(p["field"], p["topic"])] >= PER_TOPIC:
            continue
        picked.append(p)
        per_field[p["field"]] += 1
        per_topic[(p["field"], p["topic"])] += 1
    picked.sort(key=lambda p: -p["rank"])
    return picked


def full_record(p):
    """Public record of one paper. When the abstract's licence does not allow republishing
    (closed journal articles) only the two sentences Jev selected are quoted."""
    j = p.get("j") or {}
    sents = p.get("sentences") or []
    key = j.get("key")
    cav = j.get("caveat")
    rec = {
        "id": p["id"], "src": p["src"], "venue": p["venue"], "date": p["date"], "title": p["title"],
        "authors": p["authors"][:50], "n_authors": len(p["authors"]), "url": p["url"], "pdf": p.get("pdf"),
        "doi": p.get("doi"), "code": p.get("code") or [], "note": p.get("note"), "cats": p.get("cats") or [],
        "status": p["status"], "published": p.get("published"), "license": p.get("license"),
        "field": p.get("field"), "topic": p.get("topic"), "rank": p.get("rank"), "pick": bool(p.get("pick")),
        "j": j,
        "key_text": sents[key] if key is not None and key < len(sents) else None,
        "caveat_text": sents[cav] if cav is not None and cav < len(sents) else None,
        "summary": p.get("summary"),
    }
    if p.get("open", True):
        rec["sentences"] = sents
    else:
        rec["sentences"] = None
        rec["abstract_withheld"] = True
    return rec


def compact(p):
    j = p.get("j") or {}
    sents = p.get("sentences") or []
    key = j.get("key")
    return {
        "id": p["id"], "t": p["title"], "au": p["authors"][:3], "na": len(p["authors"]), "src": p["src"],
        "v": p["venue"], "f": p.get("field"), "tp": p.get("topic"), "k": j.get("kind"), "ev": j.get("evidence"),
        "ap": j.get("appeal"), "ad": j.get("advance"), "lv": j.get("level"), "hy": j.get("hype"),
        "pr": j.get("practical"), "key": sents[key] if key is not None and key < len(sents) else None,
        "code": 1 if p.get("code") else 0, "pub": 1 if (p["status"] == "journal" or p.get("published")) else 0,
        "rk": p.get("rank"), "pk": 1 if p.get("pick") else 0,
    }


class Store:
    """Writes to a local folder or to S3 (when bucket is set)."""

    def __init__(self, root=None, bucket=None):
        self.root, self.bucket = root, bucket
        if bucket:
            import boto3
            self.s3 = boto3.client("s3")

    def put(self, path, obj, max_age=300):
        raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        body = gzip.compress(raw, 6)
        if self.bucket:
            self.s3.put_object(Bucket=self.bucket, Key=path, Body=body, ContentType="application/json; charset=utf-8",
                               ContentEncoding="gzip", CacheControl=f"public, max-age={max_age}")
        else:
            full = os.path.join(self.root, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "wb") as f:
                f.write(raw)

    def get(self, path):
        try:
            if self.bucket:
                r = self.s3.get_object(Bucket=self.bucket, Key=path)
                data = r["Body"].read()
                if r.get("ContentEncoding") == "gzip":
                    data = gzip.decompress(data)
                return json.loads(data)
            with open(os.path.join(self.root, path), "rb") as f:
                return json.loads(f.read())
        except Exception:
            return None


def publish_day(store, day, papers, method, tokens, log=print, annotate=None):
    for p in papers:
        p["rank"] = rank(p)
    papers = [p for p in papers if p.get("field")]  # failed + unknown field: nothing honest to show
    edition = pick_edition(papers)
    for p in edition:
        p["pick"] = True
    if annotate:
        annotate(edition)  # e.g. plain-language summaries for the picks
    papers.sort(key=lambda p: -p["rank"])

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(16) as ex:
        list(ex.map(lambda p: store.put(f"v1/p/{p['id']}.json", full_record(p), max_age=86400), papers))

    by_field = Counter(p["field"] for p in papers)
    by_source = Counter(p["src"] for p in papers)
    topics = defaultdict(Counter)
    for p in papers:
        topics[p["field"]][p["topic"]] += 1
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    ed = {
        "date": day, "generated_at": now, "model": method["model_version"], "total": len(papers),
        "by_field": dict(by_field), "by_source": dict(by_source), "topics": {f: dict(c) for f, c in topics.items()},
        "jev_tokens": tokens, "picks": [full_record(p) for p in edition],
    }
    store.put(f"v1/days/{day}/edition.json", ed, max_age=600)
    store.put(f"v1/days/{day}/index.json", {"date": day, "papers": [compact(p) for p in papers]}, max_age=600)

    idx = store.get("v1/index.json") or {"days": []}
    days = {d["date"]: d for d in idx["days"]}
    days[day] = {"date": day, "total": len(papers), "by_source": dict(by_source)}
    ordered = sorted(days.values(), key=lambda d: d["date"], reverse=True)
    store.put("v1/index.json", {"latest": ordered[0]["date"], "updated_at": now, "days": ordered}, max_age=300)

    # search index: titles of the last 14 days
    recent = []
    for d in ordered[:14]:
        di = store.get(f"v1/days/{d['date']}/index.json") if d["date"] != day else {"papers": [compact(p) for p in papers]}
        for c in (di or {}).get("papers", []):
            recent.append([c["id"], c["t"], d["date"], c["f"], c["tp"]])
    store.put("v1/search/recent.json", {"updated_at": now, "items": recent}, max_age=600)
    store.put("v1/method.json", method, max_age=3600)
    log(f"[publish] {day}: {len(papers)} papers, edition of {len(edition)}, fields {dict(by_field)}")
    return ed
