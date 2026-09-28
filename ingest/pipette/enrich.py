"""The questions Pipette asks Jev about every paper, and how the answers become labels.

Everything here is published verbatim at /method so readers can see exactly how the
machine decides. Jev never writes text: it only picks options and gives probabilities."""
import json
import os
import time
from concurrent.futures import ThreadPoolExecutor

from . import jev
from .text import split_sentences

HERE = os.path.dirname(os.path.abspath(__file__))


def load_taxonomy():
    for p in (os.path.join(HERE, "taxonomy.json"), os.path.join(HERE, "..", "..", "shared", "taxonomy.json")):
        if os.path.exists(p):
            return json.load(open(p, encoding="utf-8"))
    raise FileNotFoundError("taxonomy.json")


TAX = load_taxonomy()
FIELDS = {f["id"]: f for f in TAX["fields"]}

APPEAL = [
    "Only specialists in this exact subfield would care about it",
    "Researchers across this field would find it interesting",
    "Scientists from other fields would find it interesting",
    "A curious member of the public would find it fascinating",
]
ADVANCE = [
    "A small incremental improvement or a minor variation of known work",
    "A solid, useful contribution to its field",
    "A substantial advance that changes how the field approaches a problem",
    "Potentially field-changing: a breakthrough or a first-of-its-kind result",
]
LEVEL = [
    "A general reader can understand the abstract",
    "Understanding the abstract needs some university-level background in the field",
    "Only specialists can understand the abstract",
]

QUESTION_TEXT = {
    "topic": "Which topic best describes what this paper is about?",
    "kind": "What is the main contribution of this paper?",
    "evidence": "What is the main kind of evidence behind the paper's claims?",
    "key": "Which sentence in `sentences` states the paper's main result or contribution most directly?",
    "caveat": "Which sentence in `sentences` admits a limitation or weakness of this study's own results (for example a small sample, a narrow setting, or a result that still needs confirmation)? A sentence describing what was unknown before the study is not a limitation. Answer `none` if no sentence admits a limitation.",
    "appeal": "Who would find this paper interesting?",
    "advance": "How big a step forward does the paper claim to be, judging only from its title and abstract?",
    "level": "How hard is the abstract to understand?",
    "hype": "Does the abstract claim more than the evidence it describes can support, for example sweeping or promotional claims based on limited experiments?",
    "practical": "Does the abstract describe a result that could directly affect people's health, the environment, or technology that people use?",
}


def topic_criteria(field):
    if field and field in FIELDS:
        return {t["id"]: t["d"] for t in FIELDS[field]["topics"]}
    # unknown field (multidisciplinary journals): one flat choice across every topic
    return {f"{f['id']}.{t['id']}": f"{f['en']}: {t['en']} ({t['d']})" for f in TAX["fields"] for t in f["topics"]}


def questions_for(field, n_sent):
    sent = {f"s{i}": None for i in range(n_sent)}
    q = {
        "topic": {"type": "choice", "instructions": QUESTION_TEXT["topic"], "criteria": topic_criteria(field)},
        "kind": {"type": "choice", "instructions": QUESTION_TEXT["kind"], "criteria": {k["id"]: k["d"] for k in TAX["kinds"]}},
        "evidence": {"type": "choice", "instructions": QUESTION_TEXT["evidence"], "criteria": {e["id"]: e["d"] for e in TAX["evidence"]}},
        "appeal": {"type": "score", "instructions": QUESTION_TEXT["appeal"], "criteria": APPEAL},
        "advance": {"type": "score", "instructions": QUESTION_TEXT["advance"], "criteria": ADVANCE},
        "level": {"type": "score", "instructions": QUESTION_TEXT["level"], "criteria": LEVEL},
        "hype": {"type": "noul", "instructions": QUESTION_TEXT["hype"],
                 "criteria": {"true": "The claims go beyond what the described evidence shows", "false": "The claims match the described evidence"}},
        "practical": {"type": "noul", "instructions": QUESTION_TEXT["practical"],
                      "criteria": {"true": "A direct real-world application or impact is described", "false": "The work is basic research with no direct application described"}},
    }
    if n_sent >= 2:
        q["key"] = {"type": "choice", "instructions": QUESTION_TEXT["key"], "criteria": sent}
        q["caveat"] = {"type": "choice", "instructions": QUESTION_TEXT["caveat"],
                       "criteria": {**sent, "none": "No sentence admits a limitation of this study's own results"}}
    return q


def method_doc():
    """The public description of the method, rendered on /about#method."""
    from . import summarize

    doc = {
        "summary": {
            "model": " → ".join(name for _, name, _ in summarize.MODELS),
            "rules": summarize.SYSTEM,
            "checks": [
                f"Every English sentence must be supported by the abstract sentences it cites (Jev, probability at least {summarize.SUPPORT_MIN}).",
                f"Every Spanish sentence must say the same thing as its English sentence (Jev, probability at least {summarize.TRANSLATION_MIN}).",
                "Sentences that fail are removed; a summary needs at least two surviving sentences to be published.",
                "Only papers in the daily edition with an openly licensed abstract get a summary.",
            ],
            "min_sentences": summarize.MIN_SENTENCES,
        },
        "model": jev.MODEL,
        "questions": {k: v for k, v in QUESTION_TEXT.items()},
        "scales": {"appeal": APPEAL, "advance": ADVANCE, "level": LEVEL},
        "kinds": TAX["kinds"], "evidence": TAX["evidence"],
        "ranking": "rank = appeal + 0.9·advance + 0.4·practical − 2.4·max(0, hype − 0.5) − 0.25·level, "
                   "papers flagged for bold claims (hype ≥ 0.6) are left out of the edition, "
                   "then at most 3 papers per field and 2 per topic in the daily edition, "
                   "with the best paper of every field considered first.",
    }
    if not summarize.enabled():
        doc.pop("summary")
    return doc


def _r(x, n=2):
    return round(float(x), n)


def _parse(ans, field, n_sent):
    a = ans["answers"]
    out = {"model": ans.get("model")}
    t = a["topic"]
    if field and field in FIELDS:
        out["field"], out["topic"] = field, t["choice"]
    else:
        f, tp = t["choice"].split(".", 1)
        out["field"], out["topic"] = f, tp
    out["topic_c"] = _r(t["confidence"])
    for k in ("kind", "evidence"):
        out[k] = a[k]["choice"]
        out[k + "_c"] = _r(a[k]["confidence"])
        out[k + "_p"] = {o: _r(p) for o, p in sorted(a[k]["probabilities"].items(), key=lambda kv: -kv[1]) if p >= 0.01}
    for k in ("appeal", "advance", "level"):
        out[k] = _r(a[k]["score"])
        out[k + "_c"] = _r(a[k]["confidence"])
        out[k + "_p"] = [_r(a[k]["probabilities"].get(str(i), 0)) for i in range(len(a[k]["legend"]))]
    out["hype"] = _r(a["hype"]["noul"])
    out["practical"] = _r(a["practical"]["noul"])
    if "key" in a:
        out["key"] = int(a["key"]["choice"][1:])
        out["key_c"] = _r(a["key"]["confidence"])
        c = a["caveat"]["choice"]
        out["caveat"] = None if c == "none" else int(c[1:])
        out["caveat_c"] = _r(a["caveat"]["confidence"])
    else:
        out["key"], out["key_c"], out["caveat"], out["caveat_c"] = (0 if n_sent else None), None, None, None
    return out


def enrich_one(p):
    sents = split_sentences(p["abstract"])
    p["sentences"] = sents
    state = {"title": p["title"], "sentences": {f"s{i}": s for i, s in enumerate(sents)}}
    if p.get("field") and p["field"] in FIELDS:
        state["field"] = FIELDS[p["field"]]["en"]
    if p.get("note"):
        state["author_comments"] = p["note"]
    ans = jev.ask(state, questions_for(p.get("field"), len(sents)))
    j = _parse(ans, p.get("field"), len(sents))
    p["field"], p["topic"] = j.pop("field"), j.pop("topic")
    p["j"] = j
    p["_tokens"] = (ans.get("usage") or {}).get("input_tokens", 0)
    return p


def enrich_all(papers, workers=12, log=print):
    t0, done, failed, tokens = time.time(), [], 0, 0

    def work(p):
        try:
            return enrich_one(p)
        except Exception as e:
            p["j"] = None
            p["_err"] = str(e)[:200]
            return p

    with ThreadPoolExecutor(workers) as ex:
        for i, p in enumerate(ex.map(work, papers)):
            done.append(p)
            if p.get("j") is None:
                failed += 1
            tokens += p.pop("_tokens", 0)
            if (i + 1) % 250 == 0:
                log(f"  enriched {i+1}/{len(papers)} ({time.time()-t0:.0f}s, {failed} failed)")
    log(f"[jev] {len(done)} papers, {failed} failed, {tokens:,} input tokens (~US${tokens*0.042/1e6:.3f}) in {time.time()-t0:.0f}s")
    return done, tokens
