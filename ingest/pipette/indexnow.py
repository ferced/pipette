"""Tell IndexNow engines (Bing, Yandex, Seznam, Naver...) which pages changed today.
Google does not use IndexNow; it reads the sitemaps."""
import json
import os
import urllib.request

SITE = "https://pipette.day"
HOST = "pipette.day"


def ping(urls, log=print):
    key = os.environ.get("INDEXNOW_KEY")
    if not key or not urls:
        return
    for i in range(0, len(urls), 9000):
        body = json.dumps({
            "host": HOST, "key": key, "keyLocation": f"{SITE}/{key}.txt", "urlList": urls[i:i + 9000],
        }).encode()
        req = urllib.request.Request("https://api.indexnow.org/indexnow", data=body,
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                log(f"[indexnow] {len(urls[i:i + 9000])} urls -> HTTP {r.status}")
        except Exception as e:  # never fail the day because of a ping
            log(f"[indexnow] failed: {e}")


def urls_for_day(day, paper_ids, fields):
    paths = ["/", f"/d/{day}", "/f", "/archive", "/open-data", "/source/arxiv", "/source/biorxiv", "/source/medrxiv", "/source/journals"]
    paths += [f"/f/{f}" for f in fields]
    paths += [f"/p/{pid}" for pid in paper_ids]
    out = []
    for p in paths:
        out.append(SITE + ("" if p == "/" else p))
        out.append(SITE + ("/es" if p == "/" else "/es" + p))
    return out
