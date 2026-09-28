"""Plain-language summaries for the daily edition, written by Claude and checked by Jev.

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
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

from . import jev

MODEL = os.environ.get("SUMMARY_MODEL", "claude-sonnet-5")
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
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


def _user_message(title, sentences):
    lines = "\n".join(f"[{i}] {s}" for i, s in enumerate(sentences))
    return f"Title: {title}\n\nAbstract, one sentence per line with its index:\n{lines}"


def draft(title, sentences, client=None):
    """Ask Claude for a structured draft. Returns (sentences, model) or (None, reason)."""
    import anthropic  # imported lazily: the pipeline runs without it when summaries are off

    client = client or anthropic.Anthropic(max_retries=4, timeout=120.0)
    try:
        response = client.messages.create(
            model=MODEL,
            max_tokens=4000,
            system=SYSTEM,
            messages=[{"role": "user", "content": _user_message(title, sentences)}],
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
        )
    except anthropic.APIStatusError as e:
        return None, f"api {e.status_code}"
    except anthropic.APIConnectionError:
        return None, "connection"
    if response.stop_reason == "refusal":
        return None, "refusal"
    if response.stop_reason == "max_tokens":
        return None, "max_tokens"
    text = next((b.text for b in response.content if b.type == "text"), None)
    if not text:
        return None, "empty"
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None, "json"
    return data.get("sentences") or [], response.model


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
    for k, c in enumerate(clean):
        c["support"] = round(float(answers[f"support_{k}"]["noul"]), 2)
        c["translation"] = round(float(answers[f"translation_{k}"]["noul"]), 2)
    return clean


def keep(checked):
    """Sentences that pass both checks, in order."""
    return [c for c in checked if c["support"] >= SUPPORT_MIN and c["translation"] >= TRANSLATION_MIN]


def summarize_record(rec, client=None, log=print):
    """Summary for one full record (see publish.full_record), or None."""
    sentences = rec.get("sentences")
    if not sentences or len(sentences) < 2:
        return None  # closed-licence abstract or too short: nothing to build on
    for attempt in (1, 2):
        drafted, model = draft(rec["title"], sentences, client=client)
        if drafted is None:
            log(f"  [summary] {rec['id']}: no draft ({model})")
            if model in ("refusal", "json", "empty"):
                return None
            time.sleep(2 * attempt)
            continue
        checked = check(sentences, drafted)
        kept = keep(checked)
        if len(kept) >= MIN_SENTENCES:
            return {
                "model": model,
                "checked_by": jev.MODEL,
                "created": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "sentences": kept,
                "dropped": len(checked) - len(kept),
            }
        log(f"  [summary] {rec['id']}: only {len(kept)} of {len(checked)} sentences passed, attempt {attempt}")
    return None


def summarize_records(records, workers=4, log=print):
    """Adds `summary` to each record in place. Returns how many got one."""
    if not enabled():
        log("[summary] ANTHROPIC_API_KEY not set, skipping summaries")
        return 0
    import anthropic

    client = anthropic.Anthropic(max_retries=4, timeout=120.0)

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
