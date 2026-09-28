export type Lang = "en" | "es";

export type Jev = {
  model?: string;
  topic_c: number;
  kind: string; kind_c: number; kind_p: Record<string, number>;
  evidence: string; evidence_c: number; evidence_p: Record<string, number>;
  appeal: number; appeal_c: number; appeal_p: number[];
  advance: number; advance_c: number; advance_p: number[];
  level: number; level_c: number; level_p: number[];
  hype: number; practical: number;
  key: number | null; key_c: number | null;
  caveat: number | null; caveat_c: number | null;
};

export type SummarySentence = { en: string; es: string; sources: number[]; support: number; translation: number };

/** Plain-language summary written by AI from the abstract, each sentence checked by Jev. */
export type Summary = { model: string; checked_by: string; created: string; sentences: SummarySentence[]; dropped: number };

export type Paper = {
  id: string;
  src: "arxiv" | "biorxiv" | "medrxiv" | "journal";
  venue: string;
  date: string;
  title: string;
  authors: string[];
  n_authors: number;
  url: string;
  pdf: string | null;
  doi: string | null;
  code: string[];
  note: string | null;
  cats: string[];
  status: "preprint" | "journal";
  published: string | null;
  license: string | null;
  field: string;
  topic: string;
  rank: number;
  pick: boolean;
  j: Jev;
  key_text: string | null;
  caveat_text: string | null;
  sentences: string[] | null;
  abstract_withheld?: boolean;
  summary?: Summary | null;
};

/** Compact record used for lists (day index). */
export type Item = {
  id: string; t: string; au: string[]; na: number; src: Paper["src"]; v: string;
  f: string; tp: string; k: string; ev: string; ap: number; ad: number; lv: number;
  hy: number; pr: number; key: string | null; code: 0 | 1; pub: 0 | 1; rk: number; pk: 0 | 1;
};

export type Edition = {
  date: string;
  generated_at: string;
  model: string;
  total: number;
  by_field: Record<string, number>;
  by_source: Record<string, number>;
  topics: Record<string, Record<string, number>>;
  jev_tokens: number;
  picks: Paper[];
};

export type DayIndex = { date: string; papers: Item[] };

export type SiteIndex = {
  latest: string;
  updated_at: string;
  days: { date: string; total: number; by_source: Record<string, number> }[];
};

export type Method = {
  model: string;
  model_version: string;
  questions: Record<string, string>;
  scales: Record<string, string[]>;
  ranking: string;
  summary?: { model: string; rules: string; checks: string[]; min_sentences: number };
};
