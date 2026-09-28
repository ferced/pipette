import json, sys
for n in sys.argv[1:]:
    d = json.load(open(n, encoding="utf-8")); c = d["categories"]; a = d["audits"]
    print(n, {k: round(v["score"] * 100) for k, v in c.items()}, "LCP", a["largest-contentful-paint"]["displayValue"], "CLS", a["cumulative-layout-shift"]["displayValue"], "TBT", a["total-blocking-time"]["displayValue"], "FCP", a["first-contentful-paint"]["displayValue"])
    for cat in c.values():
        for r in cat["auditRefs"]:
            au = a[r["id"]]
            if au.get("score") is not None and au["score"] < 0.9 and r.get("weight", 0) > 0:
                print("   ", cat["id"], r["id"], au.get("displayValue", ""), au["title"][:70])
