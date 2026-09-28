"""Fetch pages as a crawler would (no JS) and report SEO essentials."""
import re, sys, json, urllib.request
H = sys.argv[1] if len(sys.argv) > 1 else "https://pipette.day"
paths = sys.argv[2].split(",")
def get(u):
    r = urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)"}), timeout=30)
    return r.status, r.read().decode("utf-8", "replace")
for p in paths:
    st, h = get(H + p)
    f = lambda rx: (re.findall(rx, h, re.S) or [None])
    title = f(r"<title>(.*?)</title>")[0]
    desc = f(r'<meta name="description" content="([^"]*)"')[0]
    canon = f(r'<link rel="canonical" href="([^"]*)"')[0]
    hl = re.findall(r'<link rel="alternate" hrefLang="([^"]*)" href="([^"]*)"', h)
    h1 = [re.sub("<[^>]+>", "", x).strip()[:70] for x in re.findall(r"<h1[^>]*>(.*?)</h1>", h, re.S)]
    ld = [json.loads(x).get("@type") for x in re.findall(r'<script type="application/ld\+json">(.*?)</script>', h, re.S)]
    robots = f(r'<meta name="robots" content="([^"]*)"')[0]
    links = len(set(re.findall(r'href="(/[^"#?]*)"', h)))
    text = len(re.sub(r"\s+", " ", re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", h, flags=re.S)))
    print(f"\n{p} [{st}] {len(h)//1024}KB html, ~{text//1024}KB text, {links} internal links")
    print(f"  title: {title}\n  desc: {(desc or '')[:140]}\n  canonical: {canon}\n  hreflang: {hl}\n  h1: {h1}\n  json-ld: {ld}\n  robots: {robots}")
