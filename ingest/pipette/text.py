"""Text helpers: whitespace cleanup, sentence splitting, code-link detection, author parsing."""
import re

_WS = re.compile(r"\s+")

# Abbreviations that end with a period but do not end a sentence.
_ABBR = (
    "e.g.", "i.e.", "et al.", "etc.", "fig.", "figs.", "eq.", "eqs.", "vs.", "cf.", "approx.",
    "ca.", "dr.", "ref.", "refs.", "sec.", "resp.", "no.", "al.", "st.", "mr.", "ms.", "prof.",
    "inc.", "ltd.", "jr.", "sr.", "vol.", "pp.", "ch.", "tab.", "lemma.", "thm.", "prop.", "def.",
    "u.s.", "u.k.", "e.u.", "a.k.a.", "viz.", "incl.", "est.", "max.", "min.", "avg.", "std.",
)

_SPLIT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9$\\(\[\"“‘'])")


def clean(s):
    if not s:
        return ""
    return _WS.sub(" ", s).strip()


def _ends_with_abbr(s):
    low = s.lower()
    if any(low.endswith(" " + a) or low == a for a in _ABBR):
        return True
    # single capital initial like "J." in names
    return bool(re.search(r"(?:^|\s)[A-Z]\.$", s))


def split_sentences(text, max_sentences=40):
    """Split an abstract into sentences. Keeps LaTeX intact and avoids splitting on
    common abbreviations or decimal numbers."""
    text = clean(text)
    if not text:
        return []
    # Protect math blocks from splitting.
    maths = []

    def _hold(m):
        maths.append(m.group(0))
        return f"\x00{len(maths)-1}\x00"

    protected = re.sub(r"\$[^$]{0,400}\$", _hold, text)
    raw = _SPLIT.split(protected)
    out = []
    buf = ""
    for part in raw:
        buf = (buf + " " + part).strip() if buf else part
        if _ends_with_abbr(buf):
            continue
        if len(buf) < 25:
            if out:  # a short tail joins the previous sentence
                out[-1] = out[-1] + " " + buf
                buf = ""
            # a short head (e.g. "Results.") waits and joins the next one
            continue
        out.append(buf)
        buf = ""
    if buf:
        if out and len(buf) < 25:
            out[-1] += " " + buf
        else:
            out.append(buf)

    def _restore(s):
        return re.sub(r"\x00(\d+)\x00", lambda m: maths[int(m.group(1))], s)

    out = [_restore(s) for s in out]
    if len(out) > max_sentences:
        head = out[: max_sentences - 1]
        head.append(" ".join(out[max_sentences - 1:]))
        out = head
    return out


_CODE = re.compile(
    r"https?://(?:www\.)?(?:github\.com|gitlab\.com|huggingface\.co|bitbucket\.org|codeberg\.org|zenodo\.org)/[^\s,;)\]}>\"']+",
    re.I,
)


def code_links(*texts):
    found = []
    for t in texts:
        for m in _CODE.findall(t or ""):
            u = m.rstrip(".")
            if u not in found:
                found.append(u)
    return found[:4]


def split_authors_arxiv(s):
    s = clean(s)
    s = re.sub(r"\([^)]*\)", "", s)  # drop affiliations in parentheses
    parts = re.split(r",\s*|\s+and\s+", s)
    return [p.strip() for p in parts if p.strip()]


def split_authors_rxiv(s):
    out = []
    for p in (s or "").split(";"):
        p = clean(p)
        if not p:
            continue
        if "," in p:
            last, first = [x.strip() for x in p.split(",", 1)]
            p = f"{first} {last}".strip()
        out.append(p)
    return out


def slug(s):
    return re.sub(r"[^A-Za-z0-9.\-]+", "_", s).strip("_")


def norm_title(t):
    return re.sub(r"[^a-z0-9]+", "", (t or "").lower())[:120]
