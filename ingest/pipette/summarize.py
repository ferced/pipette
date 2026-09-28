"""Plain-language summaries for the daily edition, written by an open model on Amazon Bedrock
and checked by Jev.

Models were chosen with qa/summary_bench.py (see docs/research/resumenes-ia.html): Kimi K2.5
first, Llama 4 Maverick when Kimi fails. Bedrock runs inside Pipette's AWS account, so the
Lambda authenticates with its IAM role and no text leaves AWS for the model provider.

Pipette's promise is that readers see the authors' words first. Summaries therefore:
- exist only for the papers in the edition, and only when the abstract is openly licensed;
- are written from the title and abstract alone, sentence by sentence, each sentence citing
  the abstract sentences it relies on;
- are checked by Jev: every English sentence must be supported by the sentences it cites and
  every Spanish sentence must say the same thing as its English one. Anything that fails is
  dropped, and a summary with fewer than two surviving sentences is not published.
"""
import json
import os
import re
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from . import jev

# (Bedrock model id, public name, max output tokens) in order of preference
MODELS = [
    ("moonshotai.kimi-k2.5", "Kimi K2.5", 8000),
    ("us.meta.llama4-maverick-17b-instruct-v1:0", "Llama 4 Maverick", 8000),
]
MODEL = MODELS[0][1]
REGION = os.environ.get("BEDROCK_REGION", "us-east-1")
SUPPORT_MIN = 0.65
TRANSLATION_MIN = 0.6
MIN_SENTENCES = 2

SYSTEM = """You write plain-language summaries of new scientific papers for Pipette, a free daily digest. Pipette's promise is that readers always see the authors' own words first. Your summary is shown below the abstract and labelled as written by AI, so it must never say anything the abstract does not say.

Rules:
- Use only the title and abstract you are given. No outside knowledge, and no guesses about methods, results or implications the abstract does not state.
- Write for a curious reader with no background in the field, in everyday words. Explain an unavoidable technical term in a few plain words.
- Write 3 to 5 short sentences. Each sentence carries one idea and has at most 25 words. Skip background the reader does not need.
- Cover what the authors did, what they found, and, only if the abstract says so, why it matters or what limits it.
- Keep the authors' level of certainty. If they write "suggests" or "may", do not turn it into a fact. Copy numbers exactly.
- No hype words such as breakthrough, revolutionary or game-changing. No exclamation marks, no emojis, no questions.
- For every sentence, list the indices of the abstract sentences it relies on.
- Give each sentence in English and in Spanish. The Spanish is neutral Latin American Spanish in the third person and says exactly what the English sentence says."""

SCHEMA = {
    "type": "object",
    "properties": {
        "sentences": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "en": {"type": "string"},
                    "es": {"type": "string"},
                    "sources": {"type": "array", "items": {"type": "integer"}},
                },
                "required": ["en", "es", "sources"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["sentences"],
    "additionalProperties": False,
}


def enabled():
    """Summaries are switched on per environment (the Lambda sets SUMMARIES=on)."""
    return os.environ.get("SUMMARIES", "").lower() in ("1", "on", "true", "yes")


def _user_message(title, sentences):
    lines = "\n".join(f"[{i}] {s}" for i, s in enumerate(sentences))
    return f"Title: {title}\n\nAbstract, one sentence per line with its index:\n{lines}"


FORMAT = ("\n\nReply with only a JSON object, no other text, matching this JSON schema:\n"
          + json.dumps(SCHEMA))


def _client():
    import boto3
    from botocore.config import Config

    return boto3.client("bedrock-runtime", region_name=REGION,
                        config=Config(read_timeout=180, retries={"max_attempts": 4, "mode": "adaptive"}))


def _parse(text):
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no json")
    return json.loads(text[start:end + 1])["sentences"]


def draft(title, sentences, model=MODELS[0], client=None):
    """Ask one model for a draft. Returns (sentences, public model name) or (None, reason)."""
    model_id, name, max_tokens = model
    client = client or _client()
    try:
        r = client.converse(
            modelId=model_id,
            system=[{"text": SYSTEM}],
            messages=[{"role": "user", "content": [{"text": _user_message(title, sentences) + FORMAT}]}],
            inferenceConfig={"maxTokens": max_tokens, "temperature": 0.2},
        )
    except Exception as e:  # throttling after retries, model errors, network
        return None, f"{name}: {type(e).__name__}"
    if r.get("stopReason") == "max_tokens":
        return None, f"{name}: max_tokens"
    text = "".join(b.get("text", "") for b in r["output"]["message"]["content"])
    try:
        return _parse(text) or [], name
    except (ValueError, KeyError, json.JSONDecodeError):
        return None, f"{name}: json"


def check(sentences, draft_sentences):
    """Ask Jev whether each draft sentence is supported by its sources and translated faithfully.
    Returns the draft sentences annotated with `support` and `translation` probabilities."""
    n = len(sentences)
    clean = []
    for d in draft_sentences:
        src = sorted({i for i in d.get("sources", []) if isinstance(i, int) and 0 <= i < n})
        if not src or not d.get("en", "").strip() or not d.get("es", "").strip():
            continue
        clean.append({"en": d["en"].strip(), "es": d["es"].strip(), "sources": src})
    if not clean:
        return []
    state = {
        "abstract_sentences": {f"s{i}": s for i, s in enumerate(sentences)},
        "summary": {f"e{k}": c["en"] for k, c in enumerate(clean)},
        "spanish": {f"e{k}": c["es"] for k, c in enumerate(clean)},
    }
    questions = {}
    for k, c in enumerate(clean):
        cited = ", ".join(f"`abstract_sentences.s{i}`" for i in c["sources"])
        questions[f"support_{k}"] = {
            "type": "noul",
            "instructions": f"Is everything stated in `summary.e{k}` supported by {cited}?",
            "criteria": {
                "true": "Every claim, number and level of certainty in the summary sentence appears in the cited abstract sentences",
                "false": "The summary sentence adds, exaggerates or changes something the cited abstract sentences do not say",
            },
        }
        questions[f"translation_{k}"] = {
            "type": "noul",
            "instructions": f"Does `spanish.e{k}` say the same thing as `summary.e{k}`, without adding or leaving out information?",
            "criteria": {
                "true": "The Spanish sentence is a faithful translation of the English sentence",
                "false": "The Spanish sentence adds, removes or changes information",
            },
        }
    answers = jev.ask(state, questions)["answers"]
    abstract = " ".join(sentences)
    for k, c in enumerate(clean):
        c["support"] = round(float(answers[f"support_{k}"]["noul"]), 2)
        c["translation"] = round(float(answers[f"translation_{k}"]["noul"]), 2)
        c["numbers_ok"] = numbers_ok(c["en"], abstract)
    return clean


_NUM = re.compile(r"\d+(?:[.,]\d+)*")


def _numbers(text):
    return {n.replace(",", "") for n in _NUM.findall(text)}


def numbers_ok(sentence, abstract):
    """Every number in the summary sentence must appear literally in the abstract.
    A deterministic check on top of Jev: numbers are where paraphrase goes wrong most easily."""
    return _numbers(sentence) <= _numbers(abstract)


def keep(checked):
    """Sentences that pass every check, in order."""
    return [c for c in checked
            if c["support"] >= SUPPORT_MIN and c["translation"] >= TRANSLATION_MIN and c.get("numbers_ok", True)]


def summarize_record(rec, client=None, log=print):
    """Summary for one full record (see publish.full_record), or None.
    Tries each model in MODELS until one produces a summary that passes every check."""
    sentences = rec.get("sentences")
    if not sentences or len(sentences) < 2:
        return None  # closed-licence abstract or too short: nothing to build on
    for model in MODELS:
        drafted, name = draft(rec["title"], sentences, model=model, client=client)
        if drafted is None:
            log(f"  [summary] {rec['id']}: no draft ({name})")
            continue
        checked = check(sentences, drafted)
        kept = keep(checked)
        if len(kept) >= MIN_SENTENCES:
            return {
                "model": name,
                "checked_by": jev.MODEL,
                "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "sentences": kept,
                "dropped": len(checked) - len(kept),
            }
        log(f"  [summary] {rec['id']}: {name}: only {len(kept)} of {len(checked)} sentences passed")
    return None


def summarize_records(records, workers=4, log=print):
    """Adds `summary` to each record in place. Returns how many got one."""
    if not enabled():
        log("[summary] SUMMARIES is not on, skipping summaries")
        return 0
    client = _client()

    def work(rec):
        try:
            rec["summary"] = summarize_record(rec, client=client, log=log)
        except Exception as e:  # a summary must never break the day
            log(f"  [summary] {rec.get('id')}: failed: {e}")
            rec["summary"] = None
        return rec

    with ThreadPoolExecutor(workers) as ex:
        list(ex.map(work, records))
    done = sum(1 for r in records if r.get("summary"))
    log(f"[summary] {done} of {len(records)} edition papers summarized")
    return done
