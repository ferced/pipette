"""Full-page screenshots of Pipette at desktop and phone sizes, light and dark."""
import sys, asyncio
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:3217"
PAGES = sys.argv[2].split(",") if len(sys.argv) > 2 else ["/"]
SIZES = {"desk": (1440, 900), "phone": (390, 844)}
SCHEMES = sys.argv[3].split(",") if len(sys.argv) > 3 else ["light"]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for scheme in SCHEMES:
            for name, (w, h) in SIZES.items():
                ctx = await b.new_context(viewport={"width": w, "height": h}, color_scheme=scheme, locale="en-US",
                                          extra_http_headers={"Accept-Language": "en-US"}, device_scale_factor=1)
                page = await ctx.new_page()
                errs = []
                page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
                page.on("pageerror", lambda e: errs.append(str(e)))
                for path in PAGES:
                    await page.goto(BASE + path, wait_until="networkidle", timeout=90000)
                    await page.wait_for_timeout(1800)
                    sw = await page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                    fn = f"{name}-{scheme}-{path.strip('/').replace('/', '_').replace('?', '_') or 'home'}.png"
                    await page.screenshot(path=fn, full_page=True)
                    print(fn, "overflow-x:", sw, "errors:", errs[:3])
                    errs.clear()
                await ctx.close()
        await b.close()
asyncio.run(main())
