"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { usePublicPath } from "./client";
import { useEffect, useMemo, useState } from "react";
import { EVIDENCE, FIELD, FIELDS, KINDS, fieldName, num, t } from "@/lib/i18n";
import { fromItem } from "@/lib/entry";
import { texPlain } from "@/lib/tex";
import type { DayIndex, Item, Lang } from "@/lib/types";
import { DATA_BASE } from "./DotField";
import { EntryView } from "./EntryView";

const PAGE = 40;

type Filters = {
  f: string; tp: string; k: string; ev: string; lv: string; q: string;
  hype: boolean; code: boolean; pub: boolean; sort: string;
};

const DEFAULTS: Filters = { f: "", tp: "", k: "", ev: "", lv: "", q: "", hype: false, code: false, pub: false, sort: "rank" };

function fromParams(sp: URLSearchParams): Filters {
  return {
    f: sp.get("f") || "", tp: sp.get("tp") || "", k: sp.get("k") || "", ev: sp.get("ev") || "", lv: sp.get("lv") || "",
    q: sp.get("q") || "", hype: sp.get("hype") === "1", code: sp.get("code") === "1", pub: sp.get("pub") === "1",
    sort: sp.get("sort") || "rank",
  };
}

function toParams(f: Filters) {
  const sp = new URLSearchParams();
  (Object.keys(DEFAULTS) as (keyof Filters)[]).forEach((k) => {
    const v = f[k];
    if (v === DEFAULTS[k]) return;
    sp.set(k, typeof v === "boolean" ? "1" : v);
  });
  return sp.toString();
}

export default function Explorer({ date, lang }: { date: string; lang: Lang }) {
  const d = t(lang);
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePublicPath();
  const [data, setData] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [f, setF] = useState<Filters>(() => fromParams(new URLSearchParams(sp.toString())));
  const [limit, setLimit] = useState(PAGE);

  useEffect(() => {
    let alive = true;
    fetch(`${DATA_BASE}/v1/days/${date}/index.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: DayIndex) => alive && setData(j.papers))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [date]);

  const update = (patch: Partial<Filters>) => {
    const next = { ...f, ...patch };
    if (patch.f !== undefined && patch.f !== f.f) next.tp = "";
    setF(next);
    setLimit(PAGE);
    const qs = toParams(next);
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    (data || []).forEach((p) => (c[p.f] = (c[p.f] || 0) + 1));
    return c;
  }, [data]);

  const topicCounts = useMemo(() => {
    const c: Record<string, number> = {};
    (data || []).forEach((p) => {
      if (p.f === f.f) c[p.tp] = (c[p.tp] || 0) + 1;
    });
    return c;
  }, [data, f.f]);

  const list = useMemo(() => {
    if (!data) return [];
    const words = f.q.toLowerCase().split(/\s+/).filter(Boolean);
    const out = data.filter((p) => {
      if (f.f && p.f !== f.f) return false;
      if (f.tp && p.tp !== f.tp) return false;
      if (f.k && p.k !== f.k) return false;
      if (f.ev && p.ev !== f.ev) return false;
      if (f.lv === "easy" && !(p.lv <= 0.7)) return false;
      if (f.lv === "mid" && !(p.lv > 0.7 && p.lv <= 1.4)) return false;
      if (f.lv === "hard" && !(p.lv > 1.4)) return false;
      if (f.hype && p.hy >= 0.6) return false;
      if (f.code && !p.code) return false;
      if (f.pub && !p.pub) return false;
      if (words.length) {
        const hay = (texPlain(p.t) + " " + (p.key || "") + " " + p.au.join(" ")).toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
    const by: Record<string, (a: Item, b: Item) => number> = {
      rank: (a, b) => b.rk - a.rk,
      appeal: (a, b) => b.ap - a.ap || b.rk - a.rk,
      advance: (a, b) => b.ad - a.ad || b.rk - a.rk,
      calm: (a, b) => a.hy - b.hy || b.rk - a.rk,
    };
    return out.sort(by[f.sort] || by.rank);
  }, [data, f]);

  const active = toParams(f) !== "";

  return (
    <div className="explore">
      <div className="filters" role="region" aria-label={lang === "es" ? "Filtros" : "Filters"}>
        <div>
          <label htmlFor="fx-q">{lang === "es" ? "Palabras" : "Words"}</label>
          <input id="fx-q" className="text" type="search" value={f.q} placeholder={d.filter_text} onChange={(e) => update({ q: e.target.value })} />
        </div>
        <div>
          <label htmlFor="fx-f">{d.filter_field}</label>
          <select id="fx-f" className="select" value={f.f} onChange={(e) => update({ f: e.target.value })}>
            <option value="">{d.all_fields} {data ? `(${num(data.length, lang)})` : ""}</option>
            {FIELDS.filter((x) => counts[x.id]).map((x) => (
              <option key={x.id} value={x.id}>
                {x[lang]} ({num(counts[x.id], lang)})
              </option>
            ))}
          </select>
        </div>
        {f.f && FIELD[f.f] && (
          <div>
            <label htmlFor="fx-tp">{d.filter_topic}</label>
            <select id="fx-tp" className="select" value={f.tp} onChange={(e) => update({ tp: e.target.value })}>
              <option value="">{d.any}</option>
              {FIELD[f.f].topics.filter((x) => topicCounts[x.id]).map((x) => (
                <option key={x.id} value={x.id}>
                  {x[lang]} ({topicCounts[x.id]})
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label htmlFor="fx-k">{d.filter_kind}</label>
          <select id="fx-k" className="select" value={f.k} onChange={(e) => update({ k: e.target.value })}>
            <option value="">{d.any}</option>
            {KINDS.map((x) => (
              <option key={x.id} value={x.id}>{x[lang]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fx-ev">{d.filter_evidence}</label>
          <select id="fx-ev" className="select" value={f.ev} onChange={(e) => update({ ev: e.target.value })}>
            <option value="">{d.any}</option>
            {EVIDENCE.map((x) => (
              <option key={x.id} value={x.id}>{x[lang]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="fx-lv">{d.filter_level}</label>
          <select id="fx-lv" className="select" value={f.lv} onChange={(e) => update({ lv: e.target.value })}>
            <option value="">{d.any}</option>
            <option value="easy">{d.level_easy}</option>
            <option value="mid">{d.level_mid}</option>
            <option value="hard">{d.level_hard}</option>
          </select>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          <label className="check"><input type="checkbox" checked={f.hype} onChange={(e) => update({ hype: e.target.checked })} />{d.hide_hype}</label>
          <label className="check"><input type="checkbox" checked={f.pub} onChange={(e) => update({ pub: e.target.checked })} />{d.only_pub}</label>
          <label className="check"><input type="checkbox" checked={f.code} onChange={(e) => update({ code: e.target.checked })} />{d.only_code}</label>
        </div>
        <div>
          <label htmlFor="fx-sort">{d.sort}</label>
          <select id="fx-sort" className="select" value={f.sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="rank">{d.sort_rank}</option>
            <option value="appeal">{d.sort_appeal}</option>
            <option value="advance">{d.sort_advance}</option>
            <option value="calm">{d.sort_calm}</option>
          </select>
        </div>
        {active && (
          <button type="button" className="btn" onClick={() => update({ ...DEFAULTS })}>
            {lang === "es" ? "Quitar filtros" : "Clear filters"}
          </button>
        )}
      </div>

      <div>
        <div className="bar" aria-live="polite">
          <span>{data ? d.explore_count(num(list.length, lang), num(data.length, lang)) : d.loading}</span>
          {f.f && <span>{fieldName(f.f, lang)}</span>}
        </div>
        {error && <p className="empty">{d.day_empty}</p>}
        {!data && !error && (
          <p className="empty">
            <span className="spin" /> {d.loading}
          </p>
        )}
        {data && list.length === 0 && <p className="empty">{d.no_results}</p>}
        <ul className="rows">
          {list.slice(0, limit).map((p) => (
            <EntryView key={p.id} e={fromItem(p, date)} lang={lang} compact />
          ))}
        </ul>
        {list.length > limit && (
          <div className="more">
            <button type="button" className="btn" onClick={() => setLimit(limit + PAGE * 2)}>
              {d.show_more} ({num(list.length - limit, lang)})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
