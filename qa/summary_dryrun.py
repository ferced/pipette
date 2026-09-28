"""Dry run of the summary prompt without an API key: drafts come from `claude -p` with the
same instructions and schema, then go through the real Jev checks. Local testing only;
nothing here is published.

Usage: JEV_API_KEY=... python qa/summary_dryrun.py 2026-09-25 5
"""
import gzip
import json
import os
import shutil
import subprocess
import sys
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "ingest"))
from pipette import summarize  # noqa: E402


def get(u):
    b = urllib.request.urlopen(u).read()
    return json.loads(gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b)


def draft_cli(title, sentences):
    prompt = (summarize.SYSTEM + "\n\nReturn only JSON matching this schema, with no other text:\n"
              + json.dumps(summarize.SCHEMA) + "\n\n" + summarize._user_message(title, sentences))
    exe = shutil.which("claude.cmd") or shutil.which("claude")
    out = subprocess.run([exe, "-p", "--output-format", "text"], input=prompt, capture_output=True,
                         text=True, encoding="utf-8", timeout=300)
    t = out.stdout.strip()
    t = t[t.find("{"): t.rfind("}") + 1]
    return json.loads(t)["sentences"]


def main():
    day = sys.argv[1] if len(sys.argv) > 1 else "2026-09-25"
    n = int(sys.argv[2]) if len(sys.argv) > 2 else 4
    ed = get(f"https://pipette.day/data/v1/days/{day}/edition.json")
    results = {}
    for p in [p for p in ed["picks"] if p.get("sentences")][:n]:
        d = draft_cli(p["title"], p["sentences"])
        checked = summarize.check(p["sentences"], d)
        kept = summarize.keep(checked)
        results[p["id"]] = {"model": "dry-run", "checked_by": "jev-latest", "created": "dry-run",
                            "sentences": kept, "dropped": len(checked) - len(kept)}
        print("\n==", p["title"][:90])
        for c in checked:
            mark = "KEEP" if c in kept else "DROP"
            print(f" {mark} s={c['support']:.2f} t={c['translation']:.2f} src={c['sources']} | {c['en']}")
            print(f"      es: {c['es']}")
    out = os.path.join(os.path.dirname(__file__), "summary-dryrun")
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, f"{day}.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
