"""Benchmark of summary models on real Pipette papers.

Every model gets the exact production instructions (ingest/pipette/summarize.py) on the same
papers; Jev then checks every sentence exactly as in production. Models run on Amazon Bedrock
(same AWS account as Pipette) or, for Claude Sonnet 5, through the Claude Code CLI.

Usage: JEV_API_KEY=... python qa/summary_bench.py [n_papers] [model_key ...]
Writes qa/bench/<model_key>.json with every draft, score, token count and latency.
"""
import gzip
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

import boto3

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "ingest"))
from pipette import summarize  # noqa: E402

OUT = os.path.join(HERE, "bench")
DAYS = ["2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25"]

MODELS = {
    # key: (runner, model id)
    "claude-sonnet-5": ("cli", "claude-sonnet-5"),
    "claude-haiku-4.5": ("cli", "claude-haiku-4-5"),
    "nova-2-lite": ("bedrock", "us.amazon.nova-2-lite-v1:0"),
    "nova-micro": ("bedrock", "us.amazon.nova-micro-v1:0"),
    "qwen3-32b": ("bedrock", "qwen.qwen3-32b-v1:0"),
    "qwen3-next-80b": ("bedrock", "qwen.qwen3-next-80b-a3b"),
    "gpt-oss-120b": ("bedrock", "openai.gpt-oss-120b-1:0"),
    "gpt-oss-20b": ("bedrock", "openai.gpt-oss-20b-1:0"),
    "deepseek-v3.2": ("bedrock", "deepseek.v3.2"),
    "gemma-3-27b": ("bedrock", "google.gemma-3-27b-it"),
    "gemma-3-12b": ("bedrock", "google.gemma-3-12b-it"),
    "llama-4-maverick": ("bedrock", "us.meta.llama4-maverick-17b-instruct-v1:0"),
    "mistral-large-3": ("bedrock", "mistral.mistral-large-3-675b-instruct"),
    "ministral-3-14b": ("bedrock", "mistral.ministral-3-14b-instruct"),
    "glm-4.7": ("bedrock", "zai.glm-4.7"),
    "glm-4.7-flash": ("bedrock", "zai.glm-4.7-flash"),
    "kimi-k2.5": ("bedrock", "moonshotai.kimi-k2.5"),
    "nemotron-nano-3-30b": ("bedrock", "nvidia.nemotron-nano-3-30b"),
}

FORMAT = ("\n\nReply with only a JSON object, no other text, matching this JSON schema:\n"
          + json.dumps(summarize.SCHEMA))


def get(url):
    b = urllib.request.urlopen(url).read()
    return json.loads(gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b)


def papers(n):
    out = []
    for day in DAYS:
        ed = get(f"https://pipette.day/data/v1/days/{day}/edition.json")
        out += [p for p in ed["picks"] if p.get("sentences") and len(p["sentences"]) >= 3]
    # round-robin across fields, deterministic
    by_field = {}
    for p in sorted(out, key=lambda p: p["id"]):
        by_field.setdefault(p["field"], []).append(p)
    picked = []
    while len(picked) < n and any(by_field.values()):
        for f in sorted(by_field):
            if by_field[f] and len(picked) < n:
                picked.append(by_field[f].pop(0))
    return picked


def parse_json(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < 0:
        raise ValueError("no json")
    return json.loads(text[start:end + 1])["sentences"]


bedrock = boto3.client("bedrock-runtime", region_name="us-east-1")


def run_bedrock(model_id, title, sentences):
    msg = summarize._user_message(title, sentences) + FORMAT
    kwargs = dict(modelId=model_id, messages=[{"role": "user", "content": [{"text": msg}]}],
                  inferenceConfig={"maxTokens": 12000, "temperature": 0.2})
    try:
        r = bedrock.converse(system=[{"text": summarize.SYSTEM}], **kwargs)
    except bedrock.exceptions.ValidationException:
        # some models reject system prompts or temperature: fold instructions into the message
        kwargs["messages"][0]["content"][0]["text"] = summarize.SYSTEM + "\n\n" + msg
        kwargs["inferenceConfig"] = {"maxTokens": 8000}
        r = bedrock.converse(**kwargs)
    text = "".join(b.get("text", "") for b in r["output"]["message"]["content"])
    u = r.get("usage", {})
    return text, u.get("inputTokens", 0), u.get("outputTokens", 0)


def run_cli(model_id, title, sentences):
    prompt = summarize.SYSTEM + FORMAT + "\n\n" + summarize._user_message(title, sentences)
    exe = shutil.which("claude.cmd") or shutil.which("claude")
    out = subprocess.run([exe, "-p", "--model", model_id, "--output-format", "json"], input=prompt,
                         capture_output=True, text=True, encoding="utf-8", timeout=600)
    data = json.loads(out.stdout)
    u = data.get("usage", {})
    tokens_in = u.get("input_tokens", 0) + u.get("cache_read_input_tokens", 0) + u.get("cache_creation_input_tokens", 0)
    return data.get("result", ""), tokens_in, u.get("output_tokens", 0)


def bench(key, ps):
    runner, model_id = MODELS[key]
    fn = run_bedrock if runner == "bedrock" else run_cli

    def one(p):
        t0 = time.time()
        row = {"id": p["id"], "field": p["field"], "title": p["title"]}
        try:
            text, tin, tout = fn(model_id, p["title"], p["sentences"])
            row.update(latency=round(time.time() - t0, 1), tokens_in=tin, tokens_out=tout, raw=text[:6000])
            draft = parse_json(text)
            row["json_ok"] = True
        except Exception as e:  # count as a failed paper, keep going
            row.update(json_ok=False, error=str(e)[:300], latency=round(time.time() - t0, 1))
            return row
        try:
            checked = summarize.check(p["sentences"], draft)
        except Exception as e:
            row.update(error=f"jev: {e}"[:300], checked=[])
            return row
        kept = summarize.keep(checked)
        row.update(drafted=len(draft), valid=len(checked), checked=checked, kept=len(kept),
                   publishable=len(kept) >= summarize.MIN_SENTENCES)
        return row

    workers = 2 if runner == "cli" else 4
    with ThreadPoolExecutor(workers) as ex:
        rows = list(ex.map(one, ps))
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, f"{key}.json"), "w", encoding="utf-8") as f:
        json.dump({"model": key, "model_id": model_id, "runner": runner, "rows": rows}, f, ensure_ascii=False, indent=1)
    drafted = sum(r.get("drafted", 0) for r in rows)
    kept = sum(r.get("kept", 0) for r in rows)
    pub = sum(1 for r in rows if r.get("publishable"))
    ok = sum(1 for r in rows if r.get("json_ok"))
    print(f"{key:22} json {ok}/{len(rows)}  publishable {pub}/{len(rows)}  sentences kept {kept}/{drafted}", flush=True)


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    keys = sys.argv[2:] or list(MODELS)
    ps = papers(n)
    print(f"{len(ps)} papers from {DAYS[0]}..{DAYS[-1]} across {len({p['field'] for p in ps})} fields", flush=True)
    for k in keys:
        try:
            bench(k, ps)
        except Exception as e:
            print(f"{k:22} FAILED: {e}", flush=True)
