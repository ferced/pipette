"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FIELDS, formatDay, num, t } from "@/lib/i18n";
import { fromItem } from "@/lib/entry";
import type { DayIndex, Item, Lang } from "@/lib/types";
import { DATA_BASE } from "./DotField";
import { EntryView } from "./EntryView";

const KEY = "pipette.foryou.v1";
type Prefs = { interest: string; fields: string[] };
type Result = Item & { match?: number };

function load(): Prefs {
  try {
    return { interest: "", fields: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { interest: "", fields: [] };
  }
}

export default function ForYou({ day, lang, counts }: { day: string; lang: Lang; counts: Record<string, number> }) {
  const d = t(lang);
  const sp = useSearchParams();
  const [prefs, setPrefs] = useState<Prefs>({ interest: "", fields: [] });
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [results, setResults] = useState<Result[]>([]);
  const [scope, setScope] = useState<number | null>(null);
  const started = useRef(false);

  const run = async (p: Prefs) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {}
    if (!p.interest.trim() && !p.fields.length) {
      setResults([]);
      setStatus("idle");
      return;
    }
    setStatus("running");
    try {
      if (p.interest.trim().length >= 3) {
        const r = await fetch("/api/rank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interest: p.interest, fields: p.fields, day }),
        });
        if (!r.ok) throw new Error();
        const j = await r.json();
        setResults((j.results as Result[]).filter((x) => (x.match ?? 0) >= 0.25).slice(0, 30));
        setScope(j.candidates);
      } else {
        const r = await fetch(`${DATA_BASE}/v1/days/${day}/index.json`);
        const j: DayIndex = await r.json();
        const list = j.papers.filter((x) => p.fields.includes(x.f)).sort((a, b) => b.rk - a.rk).slice(0, 30);
        setResults(list);
        setScope(null);
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = load();
    const q = sp.get("q");
    const p = q ? { ...saved, interest: q } : saved;
    setPrefs(p);
    if (p.interest || p.fields.length) run(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleField = (id: string) =>
    setPrefs((p) => ({ ...p, fields: p.fields.includes(id) ? p.fields.filter((f) => f !== id) : [...p.fields, id] }));

  return (
    <div className="cols" style={{ paddingTop: 0 }}>
      <section>
        <form
          className="panel"
          onSubmit={(e) => {
            e.preventDefault();
            run(prefs);
          }}
          style={{ display: "grid", gap: 16 }}
        >
          <div>
            <label className="flabel" htmlFor="interest">
              {lang === "es" ? "Qué querés seguir" : "What you want to follow"}
            </label>
            <textarea
              id="interest"
              className="text"
              rows={3}
              maxLength={300}
              value={prefs.interest}
              placeholder={d.foryou_ph}
              onChange={(e) => setPrefs({ ...prefs, interest: e.target.value })}
            />
          </div>
          <div>
            <span className="flabel">{d.foryou_fields}</span>
            <div className="chips">
              {FIELDS.map((f) => (
                <button key={f.id} type="button" className="chip" aria-pressed={prefs.fields.includes(f.id)} onClick={() => toggleField(f.id)}>
                  <span className="sw" style={{ background: f.color }} />
                  {f[lang]}
                  {counts[f.id] ? <span className="n">{num(counts[f.id], lang)}</span> : null}
                </button>
              ))}
            </div>
          </div>
          <div>
            <button className="btn primary" type="submit" disabled={status === "running"}>
              {d.foryou_run}
            </button>
          </div>
        </form>

        <div style={{ marginTop: 26 }} aria-live="polite">
          {status === "running" && (
            <p className="empty">
              <span className="spin" /> {d.foryou_running}
            </p>
          )}
          {status === "error" && <p className="empty">{d.foryou_error}</p>}
          {status === "idle" && <p className="empty">{d.foryou_empty}</p>}
          {status === "done" && results.length === 0 && <p className="empty">{d.no_results}</p>}
          {status === "done" && results.length > 0 && (
            <>
              <div className="bar">
                <span>{scope ? d.foryou_scope(num(scope, lang), formatDay(day, lang)) : formatDay(day, lang)}</span>
              </div>
              <ul className="rows">
                {results.map((p) => (
                  <EntryView
                    key={p.id}
                    e={fromItem(p, day)}
                    lang={lang}
                    compact
                    extra={
                      p.match !== undefined ? (
                        <span className="match" style={{ marginLeft: "auto" }}>
                          {Math.round(p.match * 100)}% {d.foryou_match}
                        </span>
                      ) : null
                    }
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
      <aside className="rail">
        <div className="panel">
          <h2>{lang === "es" ? "Cómo funciona" : "How it works"}</h2>
          <p>
            {lang === "es"
              ? "Pipette elige hasta 240 candidatos del día por palabras y por calidad, y le pregunta a Jev, para cada uno, si alguien con tu interés lo querría leer. El porcentaje es la probabilidad que responde Jev."
              : "Pipette picks up to 240 of the day's papers by words and quality, then asks Jev, for each one, whether someone with your interest would want to read it. The percentage is Jev's answer."}
          </p>
          <p>
            {lang === "es"
              ? "Tu frase y tus campos se guardan solo en este navegador. Jev entiende mejor el inglés, pero también responde bien en castellano."
              : "Your sentence and fields are kept only in this browser. Jev understands English best, though other languages work too."}
          </p>
        </div>
      </aside>
    </div>
  );
}
