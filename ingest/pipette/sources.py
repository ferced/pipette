"""Fetch new papers for a given UTC day from arXiv, bioRxiv, medRxiv and top journals (OpenAlex).

Every source returns a list of dicts with the same shape (see _paper)."""
import json
import os
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone

from .text import clean, code_links, slug, split_authors_arxiv, split_authors_rxiv

UA = "Pipette/1.0 (https://pipette.day; hola@ferced.com)"
MAILTO = "hola@ferced.com"
HERE = os.path.dirname(os.path.abspath(__file__))


def _get(url, timeout=90, tries=5):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read().decode("utf-8")
        except Exception as e:  # network hiccups, 503 from arXiv, etc.
            last = e
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"GET failed {url}: {last}")


def _paper(**kw):
    base = dict(
        id=None, src=None, venue=None, date=None, title="", authors=[], abstract="",
        url=None, pdf=None, doi=None, code=[], note=None, cats=[], status="preprint",
        published=None, license=None, open=True, field=None,
    )
    base.update(kw)
    return base


# ---------------------------------------------------------------- arXiv

ARXIV_FIELD = [
    # (prefix, field) — first match wins, most specific first
    ("cs.RO", "engineering"), ("cs.SY", "engineering"), ("eess.SY", "engineering"),
    ("eess.SP", "engineering"), ("eess.IV", "engineering"),
    ("cs.AI", "ai"), ("cs.LG", "ai"), ("cs.CL", "ai"), ("cs.CV", "ai"), ("cs.IR", "ai"),
    ("cs.MA", "ai"), ("cs.NE", "ai"), ("stat.ML", "ai"), ("cs.SD", "ai"), ("eess.AS", "ai"),
    ("cs.CY", "society"), ("cs.SI", "society"), ("physics.soc-ph", "society"),
    ("econ", "society"), ("q-fin", "society"),
    ("cs.NA", "math"), ("cs.IT", "math"),
    ("cs", "computing"), ("eess", "engineering"),
    ("math-ph", "physics"), ("math", "math"), ("stat", "math"),
    ("astro-ph", "space"), ("gr-qc", "space"), ("physics.space-ph", "space"),
    ("cond-mat.mtrl-sci", "chemistry"), ("physics.chem-ph", "chemistry"),
    ("physics.ao-ph", "earth"), ("physics.geo-ph", "earth"),
    ("physics.bio-ph", "life"), ("physics.med-ph", "health"),
    ("q-bio.NC", "neuro"), ("q-bio.PE", "ecology"), ("q-bio", "life"),
    ("cond-mat", "physics"), ("hep", "physics"), ("nucl", "physics"), ("quant-ph", "physics"),
    ("physics", "physics"), ("nlin", "physics"),
]


def arxiv_field(cat):
    for pre, f in ARXIV_FIELD:
        if cat == pre or cat.startswith(pre + ".") or cat.startswith(pre + "-") or (pre in ("hep", "nucl") and cat.startswith(pre)):
            return f
    return None


_NS = {"o": "http://www.openarchives.org/OAI/2.0/", "a": "http://arxiv.org/OAI/arXivRaw/"}


def _recent(rfc_date, day, max_days=6):
    from email.utils import parsedate_to_datetime
    try:
        d = parsedate_to_datetime(rfc_date).date()
    except Exception:
        return False
    ref = datetime.strptime(day, "%Y-%m-%d").date()
    return timedelta(0) <= ref - d <= timedelta(days=max_days)


def fetch_arxiv(day):
    """New arXiv submissions announced on `day` (OAI datestamp), version 1 only."""
    url = ("https://oaipmh.arxiv.org/oai?verb=ListRecords&metadataPrefix=arXivRaw"
           f"&from={day}&until={day}")
    out = []
    while url:
        xml = _get(url, timeout=180)
        root = ET.fromstring(xml)
        for rec in root.iter("{http://www.openarchives.org/OAI/2.0/}record"):
            md = rec.find("o:metadata/a:arXivRaw", _NS)
            if md is None:
                continue
            versions = md.findall("a:version", _NS)
            if len(versions) != 1:
                continue  # a revision of an older paper, not a new one
            if not _recent(versions[0].findtext("a:date", default="", namespaces=_NS), day):
                continue  # old paper whose metadata changed (journal ref, DOI...), not new work
            g = lambda tag: clean((md.findtext(f"a:{tag}", default="", namespaces=_NS)))
            aid = g("id")
            cats = g("categories").split()
            comments = g("comments")
            abstract = g("abstract")
            doi = g("doi") or None
            jref = g("journal-ref") or None
            out.append(_paper(
                id="arxiv-" + slug(aid), src="arxiv", venue="arXiv", date=day,
                title=g("title"), authors=split_authors_arxiv(g("authors")), abstract=abstract,
                url=f"https://arxiv.org/abs/{aid}", pdf=f"https://arxiv.org/pdf/{aid}",
                doi=doi, code=code_links(abstract, comments), note=comments[:240] or None,
                cats=cats, status="preprint", published=jref or doi, license=g("license") or None,
                open=True, field=arxiv_field(cats[0]) if cats else None,
            ))
        tok = root.find(".//o:resumptionToken", _NS)
        url = None
        if tok is not None and (tok.text or "").strip():
            url = ("https://oaipmh.arxiv.org/oai?verb=ListRecords&resumptionToken="
                   + urllib.parse.quote(tok.text.strip()))
            time.sleep(2)
    return out


# ---------------------------------------------------------------- bioRxiv / medRxiv

RXIV_FIELD = {
    "animal behavior and cognition": "ecology", "biochemistry": "life", "bioengineering": "life",
    "bioinformatics": "life", "biophysics": "life", "cancer biology": "life", "cell biology": "life",
    "clinical trials": "health", "developmental biology": "life", "ecology": "ecology",
    "epidemiology": "health", "evolutionary biology": "ecology", "genetics": "life",
    "genomics": "life", "immunology": "life", "microbiology": "life", "molecular biology": "life",
    "neuroscience": "neuro", "paleontology": "ecology", "pathology": "health",
    "pharmacology and toxicology": "health", "physiology": "life", "plant biology": "life",
    "scientific communication and education": "society", "synthetic biology": "life",
    "systems biology": "life", "zoology": "ecology",
}


def fetch_rxiv(server, day):
    out, cursor, seen = [], 0, set()
    while True:
        data = json.loads(_get(f"https://api.biorxiv.org/details/{server}/{day}/{day}/{cursor}"))
        coll = data.get("collection") or []
        for x in coll:
            try:
                ver = int(x.get("version") or 0)
            except ValueError:
                ver = 0
            if ver > 1:
                continue
            doi = x.get("doi")
            if not doi or doi in seen:
                continue
            seen.add(doi)
            cat = clean(x.get("category", "")).lower()
            if server == "medrxiv":
                field = "neuro" if cat == "neurology" else "health"
            else:
                field = RXIV_FIELD.get(cat, "life")
            suffix = doi.split("/", 1)[1] if "/" in doi else doi
            abstract = clean(x.get("abstract"))
            pub = x.get("published")
            base = f"https://www.{server}.org/content/{doi}v{max(ver,1)}"
            out.append(_paper(
                id=f"{server}-" + slug(suffix), src=server, venue="bioRxiv" if server == "biorxiv" else "medRxiv",
                date=day, title=clean(x.get("title")), authors=split_authors_rxiv(x.get("authors")),
                abstract=abstract, url=base, pdf=base + ".full.pdf", doi=doi,
                code=code_links(abstract), note=None, cats=[cat] if cat else [],
                status="preprint", published=(pub if pub and pub != "NA" else None),
                license=x.get("license"), open=True, field=field,
            ))
        msg = (data.get("messages") or [{}])[0]
        total = int(msg.get("total") or msg.get("count") or 0)
        cursor += len(coll)
        if not coll or cursor >= total:
            break
        time.sleep(0.5)
    return out


# ---------------------------------------------------------------- journals via OpenAlex

def _load_journals():
    for p in (os.path.join(HERE, "journals.json"), os.path.join(HERE, "..", "..", "shared", "journals.json")):
        if os.path.exists(p):
            return json.load(open(p, encoding="utf-8"))
    return {}


JOURNAL_FIELD = [
    ("Astronomy", "space"), ("Physics", "physics"), ("Physical Review", "physics"), ("Photonics", "physics"),
    ("Chemistry", "chemistry"), ("Chemical Society", "chemistry"), ("Catalysis", "chemistry"),
    ("Materials", "chemistry"), ("Nanotechnology", "chemistry"), ("Energy", "earth"), ("Joule", "chemistry"),
    ("Climate", "earth"), ("Geoscience", "earth"), ("Earth", "earth"), ("Water", "earth"), ("Sustainability", "earth"),
    ("Food", "earth"), ("Cities", "society"),
    ("Neuroscience", "neuro"), ("Neuron", "neuro"), ("Human Behaviour", "neuro"),
    ("Ecology", "ecology"),
    ("Machine Intelligence", "ai"), ("Computational Science", "computing"), ("Electronics", "engineering"),
    ("Robotics", "engineering"),
    ("Medicine", "health"), ("Lancet", "health"), ("JAMA", "health"), ("BMJ", "health"), ("Drug Discovery", "health"),
    ("Aging", "health"), ("Cancer Cell", "health"),
    ("Genetics", "life"), ("Biotechnology", "life"), ("Methods", "life"), ("Microbiology", "life"),
    ("Cell Biology", "life"), ("Immunology", "life"), ("Immunity", "life"), ("Metabolism", "life"),
    ("Molecular", "life"), ("Cell Reports", "health"),
]


def journal_field(name):
    if name in ("Nature", "Science", "Cell", "Proceedings of the National Academy of Sciences",
                "Nature Communications", "Science Advances", "eLife", "PLoS Biology", "Current Biology"):
        return None  # multidisciplinary: let Jev decide the field
    for key, f in JOURNAL_FIELD:
        if key.lower() in name.lower():
            return f
    return None


def _abstract_from_index(inv):
    if not inv:
        return ""
    pos = []
    for word, idxs in inv.items():
        for i in idxs:
            pos.append((i, word))
    pos.sort()
    return clean(" ".join(w for _, w in pos))


def fetch_journals(day):
    journals = _load_journals()
    ids = list(journals.keys())
    out, seen = [], set()
    for i in range(0, len(ids), 25):  # OpenAlex OR-filters are limited in size
        chunk = "|".join(ids[i:i + 25])
        cursor = "*"
        while cursor:
            q = urllib.parse.urlencode({
                "filter": f"from_publication_date:{day},to_publication_date:{day},primary_location.source.id:{chunk},has_abstract:true,type:article|review",
                "per_page": 200, "cursor": cursor, "mailto": MAILTO,
                "select": "id,doi,title,publication_date,primary_location,open_access,authorships,abstract_inverted_index,type,best_oa_location",
            })
            data = json.loads(_get("https://api.openalex.org/works?" + q))
            for w in data.get("results", []):
                doi = (w.get("doi") or "").replace("https://doi.org/", "")
                title = clean(w.get("title"))
                if not doi or not title or doi in seen:
                    continue
                seen.add(doi)
                loc = w.get("primary_location") or {}
                src = (loc.get("source") or {}).get("display_name") or ""
                lic = loc.get("license") or ((w.get("best_oa_location") or {}).get("license"))
                is_open = bool(lic and str(lic).startswith("cc"))
                abstract = _abstract_from_index(w.get("abstract_inverted_index"))
                pdf = (w.get("best_oa_location") or {}).get("pdf_url")
                out.append(_paper(
                    id="doi-" + slug(doi.lower()), src="journal", venue=src.replace("PLoS", "PLOS"), date=day,
                    title=title, authors=[clean((a.get("author") or {}).get("display_name")) for a in (w.get("authorships") or [])][:60],
                    abstract=abstract, url=f"https://doi.org/{doi}", pdf=pdf, doi=doi, code=code_links(abstract),
                    status="journal", published=None, license=lic, open=is_open, field=journal_field(src),
                ))
            cursor = (data.get("meta") or {}).get("next_cursor")
            time.sleep(0.3)
    return out


def fetch_all(day, log=print):
    """Papers for the edition of `day`: what arXiv announced that night (OAI datestamp = day)
    plus what bioRxiv and medRxiv posted the previous day, plus journal articles published two days
    before (OpenAlex needs about a day to index them completely)."""
    ref = datetime.strptime(day, "%Y-%m-%d")
    prev = (ref - timedelta(days=1)).strftime("%Y-%m-%d")
    prev2 = (ref - timedelta(days=2)).strftime("%Y-%m-%d")
    papers = []
    for name, fn in (("arxiv", lambda: fetch_arxiv(day)), ("biorxiv", lambda: fetch_rxiv("biorxiv", prev)),
                     ("medrxiv", lambda: fetch_rxiv("medrxiv", prev)), ("journals", lambda: fetch_journals(prev2))):
        t = time.time()
        try:
            got = fn()
        except Exception as e:  # one broken source must not sink the whole day
            log(f"[{name}] FAILED: {e}")
            got = []
        log(f"[{name}] {len(got)} papers in {time.time()-t:.1f}s")
        for p in got:
            p["date"] = day  # the edition this paper belongs to
        papers.extend(got)
    # de-duplicate by title (a journal article and its preprint on the same day)
    from .text import norm_title
    best = {}
    order = {"journal": 0, "medrxiv": 1, "biorxiv": 2, "arxiv": 3}
    for p in papers:
        k = norm_title(p["title"])
        if not k:
            continue
        if k not in best or order[p["src"]] < order[best[k]["src"]]:
            best[k] = p
    return list(best.values())


def today_utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")
