"""End-to-end checks of the production site."""
import asyncio, sys, re
from playwright.async_api import async_playwright
H = sys.argv[1] if len(sys.argv) > 1 else "https://pipette-gray.vercel.app"
ok = lambda c, m: print(("PASS " if c else "FAIL ") + m)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 1440, "height": 900}, locale="en-US", extra_http_headers={"Accept-Language": "en-US"})
        pg = await ctx.new_page()
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)

        await pg.goto(H + "/d/2026-09-25", wait_until="networkidle")
        entries = await pg.locator("ol.entries > li").count()
        ok(entries == 20, f"weekday edition shows 20 entries ({entries})")
        hero = await pg.locator(".hero-line").inner_text()
        ok("2,132" in hero, f"hero counts papers: {hero[:60]}")
        ok(await pg.locator(".dots canvas").count() == 1, "dot field rendered")
        first_title = (await pg.locator("ol.entries > li .title").first.inner_text()).strip()

        # Save the first paper, then find it in Saved
        await pg.locator("ol.entries > li").first.get_by_role("button", name="Save").click()
        ok(await pg.locator("ol.entries > li").first.get_by_role("button", name="Saved").count() == 1, "save toggles to Saved")
        await pg.goto(H + "/saved", wait_until="networkidle")
        saved_titles = await pg.locator(".rows .title").all_inner_texts()
        ok(any(first_title[:40] in t for t in saved_titles), "saved paper appears on /saved")
        ok(await pg.get_by_role("button", name="Export BibTeX").count() == 1, "BibTeX export button present")
        async with pg.expect_download() as dl:
            await pg.get_by_role("button", name="Export BibTeX").click()
        d = await dl.value
        path = await d.path()
        bib = open(path, encoding="utf-8").read()
        ok(bib.startswith("@article{") and "pipette.day/p/" in bib, "BibTeX file downloads with permalink")

        # Paper page from the edition
        await pg.goto(H + "/d/2026-09-25", wait_until="networkidle")
        await pg.locator("ol.entries > li .title a").nth(1).click()
        await pg.wait_for_url("**/p/**", timeout=20000)
        await pg.wait_for_selector(".reading", timeout=20000)
        ok("/p/" in pg.url, f"paper page opens: {pg.url}")
        ok(await pg.locator(".hl-key").count() >= 1 or await pg.locator(".notice").count() == 1, "key sentence highlighted (or licence notice)")
        ok(await pg.locator(".reading .q").count() >= 7, "Jev reading panel lists the questions")

        # Explorer filters
        await pg.goto(H + "/d/2026-09-25/all", wait_until="networkidle")
        await pg.wait_for_selector(".rows .row")
        total = await pg.locator(".bar span").first.inner_text()
        await pg.select_option("#fx-f", "space")
        await pg.wait_for_timeout(400)
        after = await pg.locator(".bar span").first.inner_text()
        ok(total != after and "space" in pg.url, f"field filter narrows list: {total} -> {after}")
        fields = set(await pg.locator(".rows .row .where a").first.all_inner_texts())
        ok(all("Space" in f for f in fields), "filtered rows are Space & cosmos")
        await pg.check("text=Hide bold claims")
        await pg.wait_for_timeout(300)
        ok("hype=1" in pg.url, "hide bold claims reflected in URL")
        await pg.fill("#fx-q", "galaxy")
        await pg.wait_for_timeout(400)
        ok(await pg.locator(".rows .row").count() >= 1, "text filter finds galaxies")

        # Search
        await pg.goto(H + "/search?q=black%20hole", wait_until="networkidle")
        await pg.wait_for_selector(".days li", timeout=15000)
        ok(await pg.locator(".days li").count() >= 3, f"search returns results ({await pg.locator('.days li').count()})")

        # For you
        await pg.goto(H + "/foryou", wait_until="networkidle")
        await pg.fill("#interest", "protein folding and structure prediction")
        await pg.get_by_role("button", name="Find my papers").click()
        await pg.wait_for_selector(".match", timeout=30000)
        m = await pg.locator(".match").first.inner_text()
        ok("%" in m, f"For you ranks with Jev: first {m}")

        # Language switch
        await pg.goto(H + "/about", wait_until="networkidle")
        await pg.get_by_role("link", name=re.compile("ES")).click()
        await pg.wait_for_url("**/es/about", timeout=20000)
        await pg.wait_for_load_state("networkidle")
        ok(pg.url.endswith("/es/about"), f"language switch goes to {pg.url}")
        ok("Por qué existe Pipette" in await pg.locator("h1").inner_text(), "Spanish about page")
        await pg.goto(H + "/", wait_until="networkidle")
        ok(pg.url.rstrip("/").endswith("/es"), f"root remembers Spanish: {pg.url}")
        ok(await pg.evaluate("document.documentElement.lang") == "es", "html lang=es")

        # Theme toggle persists
        await pg.locator("button[aria-label*='claro']").click()
        t = await pg.evaluate("document.documentElement.dataset.theme")
        await pg.reload(wait_until="networkidle")
        t2 = await pg.evaluate("document.documentElement.dataset.theme")
        ok(t == t2 and t in ("dark", "light"), f"theme persists across reload ({t})")

        # Cookies: only lang
        cookies = [c["name"] for c in await ctx.cookies()]
        ok(set(cookies) <= {"lang"}, f"cookies set: {cookies}")

        # Third-party requests: none besides own origin
        reqs = []
        pg.on("request", lambda r: reqs.append(r.url))
        await pg.goto(H + "/es", wait_until="networkidle")
        foreign = {re.sub(r"^https?://([^/]+).*", r"\1", u) for u in reqs if not u.startswith(H) and not u.startswith("data:")}
        ok(not foreign, f"no third-party requests: {foreign or 'none'}")

        noise = [e for e in errs if "Encountered a script tag" not in e]
        ok(not noise, f"no console errors: {noise[:3]}")
        await b.close()
asyncio.run(main())
