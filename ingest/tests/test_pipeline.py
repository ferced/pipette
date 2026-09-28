"""Offline tests for the parts of the pipeline that do not call any API."""
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pipette import publish, sources  # noqa: E402
from pipette.enrich import TAX, questions_for  # noqa: E402
from pipette.text import code_links, split_authors_arxiv, split_authors_rxiv, split_sentences  # noqa: E402


class SentenceSplitting(unittest.TestCase):
    def test_keeps_abbreviations_and_decimals(self):
        s = split_sentences("We study graphs, e.g. trees and cycles of any length. The error drops to 2.5 percent on average. Fig. 3 shows the full comparison with prior work.")
        self.assertEqual(len(s), 3)
        self.assertTrue(s[0].endswith("any length."))

    def test_keeps_math_intact(self):
        s = split_sentences("We prove that $a. b$ holds for every graph. The bound is tight in general.")
        self.assertEqual(s, ["We prove that $a. b$ holds for every graph.", "The bound is tight in general."])

    def test_short_tail_joins_previous(self):
        self.assertEqual(split_sentences("We show a new bound for the problem. It is tight."), ["We show a new bound for the problem. It is tight."])

    def test_merges_tiny_fragments(self):
        self.assertEqual(len(split_sentences("Results. We show a new bound for the problem.")), 1)


class Parsing(unittest.TestCase):
    def test_arxiv_authors(self):
        self.assertEqual(split_authors_arxiv("Ana Pérez (UBA), Li Wei and Sam Roe"), ["Ana Pérez", "Li Wei", "Sam Roe"])

    def test_rxiv_authors(self):
        self.assertEqual(split_authors_rxiv("Montalvo, G.; Qu, B."), ["G. Montalvo", "B. Qu"])

    def test_code_links(self):
        links = code_links("Code at https://github.com/org/repo. Data: https://huggingface.co/datasets/x/y")
        self.assertEqual(links, ["https://github.com/org/repo", "https://huggingface.co/datasets/x/y"])

    def test_arxiv_fields(self):
        cases = {"cs.LG": "ai", "cs.RO": "engineering", "cs.CR": "computing", "math.AG": "math", "stat.ML": "ai",
                 "astro-ph.GA": "space", "hep-th": "physics", "q-bio.NC": "neuro", "cond-mat.mtrl-sci": "chemistry",
                 "econ.GN": "society", "physics.ao-ph": "earth"}
        for cat, field in cases.items():
            self.assertEqual(sources.arxiv_field(cat), field, cat)

    def test_only_recent_first_versions(self):
        self.assertTrue(sources._recent("Wed, 23 Sep 2026 21:25:32 GMT", "2026-09-25"))
        self.assertFalse(sources._recent("Mon, 06 Nov 2017 18:02:56 GMT", "2026-09-25"))


class Questions(unittest.TestCase):
    def test_topics_follow_the_field(self):
        q = questions_for("ai", 5)
        self.assertIn("llm", q["topic"]["criteria"])
        self.assertIn("none", q["caveat"]["criteria"])
        self.assertEqual(len(q["key"]["criteria"]), 5)

    def test_unknown_field_uses_every_topic(self):
        q = questions_for(None, 3)
        total = sum(len(f["topics"]) for f in TAX["fields"])
        self.assertEqual(len(q["topic"]["criteria"]), total)
        self.assertLessEqual(total, 255)  # Jev's limit for one Choice


def paper(i, field, topic, appeal=2.0, advance=2.0, hype=0.2):
    return {
        "id": f"p{i}", "field": field, "topic": topic, "abstract": "x" * 400, "sentences": ["a.", "b."],
        "j": {"appeal": appeal, "advance": advance, "practical": 0.5, "hype": hype, "level": 1.0, "kind": "finding"},
    }


class Edition(unittest.TestCase):
    def rank_all(self, ps):
        for p in ps:
            p["rank"] = publish.rank(p)
        return ps

    def test_flagged_papers_never_make_the_edition(self):
        ps = self.rank_all([paper(i, "ai", f"t{i}", appeal=3.0, hype=0.9) for i in range(5)] +
                           [paper(10 + i, "ai", f"u{i}", appeal=1.0) for i in range(5)])
        self.assertTrue(all(p["j"]["hype"] < publish.HYPE_FLAG for p in publish.pick_edition(ps)))

    def test_no_field_takes_over(self):
        ps = self.rank_all([paper(i, "ai", f"t{i}", appeal=3.0) for i in range(60)] +
                           [paper(100 + i, "math", f"m{i}", appeal=1.0) for i in range(60)] +
                           [paper(200 + i, "space", f"s{i}", appeal=1.2) for i in range(60)])
        picked = publish.pick_edition(ps)
        per_field = {f: sum(p["field"] == f for p in picked) for f in ("ai", "math", "space")}
        self.assertTrue(all(n <= publish.PER_FIELD for n in per_field.values()), per_field)

    def test_quiet_days_get_a_shorter_edition(self):
        ps = self.rank_all([paper(i, f"f{i % 13}", f"t{i}") for i in range(100)])
        self.assertEqual(len(publish.pick_edition(ps)), 8)


if __name__ == "__main__":
    unittest.main()


class Summaries(unittest.TestCase):
    """The Jev checks decide what survives; the model's draft is never trusted as is."""

    def setUp(self):
        from pipette import summarize
        self.s = summarize
        self._ask = summarize.jev.ask

    def tearDown(self):
        self.s.jev.ask = self._ask

    def fake_jev(self, support, translation):
        def ask(state, questions):
            answers = {}
            for k in questions:
                kind, i = k.rsplit("_", 1)
                answers[k] = {"type": "noul", "noul": (support if kind == "support" else translation)[int(i)]}
            return {"answers": answers}
        self.s.jev.ask = ask

    def test_drops_unsupported_and_mistranslated_sentences(self):
        self.fake_jev(support=[0.9, 0.2, 0.9], translation=[0.9, 0.9, 0.1])
        draft = [{"en": f"E{i}", "es": f"S{i}", "sources": [0]} for i in range(3)]
        kept = self.s.keep(self.s.check(["a.", "b."], draft))
        self.assertEqual([c["en"] for c in kept], ["E0"])

    def test_ignores_sentences_citing_nothing_real(self):
        self.fake_jev(support=[0.9], translation=[0.9])
        draft = [{"en": "ok", "es": "ok", "sources": [1]}, {"en": "bad", "es": "mal", "sources": [7, 9]}]
        checked = self.s.check(["a.", "b."], draft)
        self.assertEqual([c["en"] for c in checked], ["ok"])

    def test_closed_abstracts_get_no_summary(self):
        self.assertIsNone(self.s.summarize_record({"id": "x", "title": "t", "sentences": None}))

    def test_off_without_a_key(self):
        import os
        old = {k: os.environ.pop(k, None) for k in ("ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")}
        try:
            self.assertEqual(self.s.summarize_records([{"id": "x"}], log=lambda *_: None), 0)
        finally:
            for k, v in old.items():
                if v is not None:
                    os.environ[k] = v
