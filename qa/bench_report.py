"""Turns qa/bench/*.json into a table of metrics (and a JSON the HTML report reads).

Prices are USD per million tokens: Bedrock prices from the AWS Pricing API (us-east-1,
on-demand standard, fetched 2026-09-28); Claude prices from Anthropic's price list.
"""
import gzip
import json
import os
import re
import statistics
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ingest"))
from pipette import summarize  # noqa: E402

PRICES = {  # key: (provider label, $/M in, $/M out, token factor vs. measured, where)
    "claude-sonnet-5": ("Anthropic", 2.00, 10.00, 1.3, "API de Anthropic"),
    "claude-haiku-4.5": ("Anthropic", 1.00, 5.00, 1.0, "API de Anthropic o Bedrock"),
    "nova-2-lite": ("Amazon", 0.33, 2.75, 1.0, "Bedrock"),
    "nova-micro": ("Amazon", 0.035, 0.14, 1.0, "Bedrock"),
    "qwen3-32b": ("Alibaba (abierto)", 0.15, 0.60, 1.0, "Bedrock"),
    "qwen3-next-80b": ("Alibaba (abierto)", 0.14, 1.20, 1.0, "Bedrock"),
    "gpt-oss-120b": ("OpenAI (abierto)", 0.15, 0.60, 1.0, "Bedrock"),
    "gpt-oss-20b": ("OpenAI (abierto)", 0.07, 0.30, 1.0, "Bedrock"),
    "deepseek-v3.2": ("DeepSeek (abierto)", 0.62, 1.85, 1.0, "Bedrock"),
    "gemma-3-27b": ("Google (abierto)", 0.23, 0.38, 1.0, "Bedrock"),
    "gemma-3-12b": ("Google (abierto)", 0.09, 0.29, 1.0, "Bedrock"),
    "llama-4-maverick": ("Meta (abierto)", 0.24, 0.97, 1.0, "Bedrock"),
    "mistral-large-3": ("Mistral (abierto)", 0.50, 1.50, 1.0, "Bedrock"),
    "ministral-3-14b": ("Mistral (abierto)", 0.20, 0.20, 1.0, "Bedrock"),
    "glm-4.7": ("Z.ai (abierto)", 0.60, 2.20, 1.0, "Bedrock"),
    "glm-4.7-flash": ("Z.ai (abierto)", 0.07, 0.40, 1.0, "Bedrock"),
    "kimi-k2.5": ("Moonshot (abierto)", 0.60, 3.00, 1.0, "Bedrock"),
    "nemotron-nano-3-30b": ("NVIDIA (abierto)", 0.06, 0.24, 1.0, "Bedrock"),
}
PAPERS_PER_MONTH = 20 * 30
HYPE = ["breakthrough", "revolutionary", "game-changing", "groundbreaking", "unprecedented", "!",
        "revolucionari", "innovador", "sin precedentes", "histórico"]
_cache = {}


def syllables(word):
    w = re.sub(r"[^a-z]", "", word.lower())
    if not w:
        return 0
    groups = re.findall(r"[aeiouy]+", w)
    n = len(groups) - (1 if w.endswith("e") and len(groups) > 1 else 0)
    return max(1, n)


def flesch(text):
    """Flesch reading ease (English): higher is easier. 60-70 is plain English."""
    sents = max(1, len(re.findall(r"[.!?](\s|$)", text)))
    words = re.findall(r"[A-Za-z][A-Za-z'-]*", text)
    if not words:
        return 0
    syl = sum(syllables(w) for w in words)
    return 206.835 - 1.015 * len(words) / sents - 84.6 * syl / len(words)


def acronyms(text):
    return len(re.findall(r"\b[A-Z][A-Z0-9]{1,}s?\b", text))


def abstract(pid):
    if pid not in _cache:
        b = urllib.request.urlopen(f"https://pipette.day/data/v1/p/{pid}.json").read()
        rec = json.loads(gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b)
        _cache[pid] = " ".join(rec["sentences"])
    return _cache[pid]


def load():
    runs = {}
    for f in sorted(os.listdir(os.path.join(HERE, "bench"))):
        if f.endswith(".json") and not f.startswith("_"):
            d = json.load(open(os.path.join(HERE, "bench", f), encoding="utf-8"))
            runs[d["model"]] = d
    return runs


def metrics(runs):
    # Claude Code adds its own system prompt, so for CLI runs the input side is estimated
    # from the models called directly (same prompt, same papers).
    direct_in = [r["tokens_in"] for d in runs.values() if d["runner"] == "bedrock" for r in d["rows"] if r.get("tokens_in")]
    typical_in = statistics.median(direct_in) if direct_in else 1000
    out = []
    for key, d in runs.items():
        rows = d["rows"]
        n = len(rows)
        drafted = sum(r.get("drafted", 0) for r in rows)
        sents = [c for r in rows for c in r.get("checked", [])]
        for r in rows:
            for c in r.get("checked", []):
                c["numbers_ok"] = summarize.numbers_ok(c["en"], abstract(r["id"]))
        kept = [c for c in sents if c["support"] >= summarize.SUPPORT_MIN and c["translation"] >= summarize.TRANSLATION_MIN and c["numbers_ok"]]
        publishable = sum(
            1 for r in rows
            if len(summarize.keep(r.get("checked", []))) >= summarize.MIN_SENTENCES
        )
        words = [len(c["en"].split()) for c in sents]
        tin = [r["tokens_in"] for r in rows if r.get("tokens_in")]
        tout = [r["tokens_out"] for r in rows if r.get("tokens_out")]
        lat = [r["latency"] for r in rows if r.get("latency") is not None and r.get("json_ok")]
        label, pin, pout, factor, where = PRICES.get(key, ("?", 0, 0, 1, "?"))
        avg_in = (typical_in if d["runner"] == "cli" else statistics.mean(tin) if tin else typical_in) * factor
        if d["runner"] == "cli":
            # Claude Code reports its own overhead too; estimate from the text actually produced
            chars = [len(r.get("raw") or "") for r in rows if r.get("json_ok")]
            avg_out = (statistics.mean(chars) / 3.6 if chars else 0) * factor
        else:
            avg_out = (statistics.mean(tout) if tout else 0) * factor
        cost = PAPERS_PER_MONTH * (avg_in * pin + avg_out * pout) / 1e6
        out.append({
            "key": key, "provider": label, "where": where, "runner": d["runner"], "papers": n,
            "json_ok": sum(1 for r in rows if r.get("json_ok")),
            "publishable": publishable,
            "drafted": drafted, "kept": len(kept),
            "keep_rate": round(len(kept) / drafted, 3) if drafted else 0,
            "support": round(statistics.mean([c["support"] for c in sents]), 3) if sents else 0,
            "translation": round(statistics.mean([c["translation"] for c in sents]), 3) if sents else 0,
            "numbers_bad": sum(1 for c in sents if not c["numbers_ok"]),
            "words": round(statistics.mean(words), 1) if words else 0,
            "latency": round(statistics.median(lat), 1) if lat else None,
            "tokens_out": round(avg_out),
            "per_paper": round(len(sents) / max(1, sum(1 for r in rows if r.get("checked"))), 1),
            "long": round(sum(1 for w in words if w > 25) / len(words), 3) if words else 0,
            "hype": sum(1 for c in sents if any(h in (c["en"] + " " + c["es"]).lower() for h in HYPE)),
            "flesch": round(statistics.mean([flesch(" ".join(c["en"] for c in r.get("checked", []))) for r in rows if r.get("checked")]), 1) if sents else 0,
            "acronyms": round(sum(acronyms(c["en"]) for c in sents) / len(sents), 2) if sents else 0,
            "cost_month": round(cost, 2),
            "price": [pin, pout],
        })
    out.sort(key=lambda m: (-m["publishable"], -m["keep_rate"]))
    return out


if __name__ == "__main__":
    runs = load()
    ms = metrics(runs)
    print(f"{'model':22} {'pub':>5} {'kept':>9} {'rate':>6} {'sup':>5} {'tra':>5} {'num':>4} {'words':>6} {'>25w':>5} {'s/pap':>5} {'hype':>4} {'fles':>5} {'acr':>5} {'lat':>6} {'US$/mes':>8}")
    for m in ms:
        print(f"{m['key']:22} {m['publishable']:>2}/{m['papers']:<2} {m['kept']:>4}/{m['drafted']:<4} {m['keep_rate']*100:>5.0f}% {m['support']:>5.2f} {m['translation']:>5.2f} {m['numbers_bad']:>4} {m['words']:>6} {m['long']*100:>4.0f}% {m['per_paper']:>5} {m['hype']:>4} {m['flesch']:>5} {m['acronyms']:>5} {str(m['latency']):>6} {m['cost_month']:>8.2f}")
    json.dump({"metrics": ms, "runs": {k: v for k, v in runs.items()}}, open(os.path.join(HERE, "bench", "_summary.json"), "w", encoding="utf-8"), ensure_ascii=False)
