"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FIELD, fieldName, formatDay, href, t, topicName } from "@/lib/i18n";
import { texPlain } from "@/lib/tex";
import type { Lang } from "@/lib/types";
import { DATA_BASE } from "./DotField";

type Row = [string, string, string, string, string]; // id, title, date, field, topic

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Search({ lang }: { lang: Lang }) {
  const d = t(lang);
  const sp = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(sp.get("q") || "");
  const [rows, setRows] = useState<{ r: Row; n: string }[] | null>(null);

  useEffect(() => {
    fetch(`${DATA_BASE}/v1/search/recent.json`)
      .then((r) => r.json())
      .then((j: { items: Row[] }) => setRows(j.items.map((r) => ({ r, n: norm(texPlain(r[1])) }))))
      .catch(() => setRows([]));
  }, []);

  useEffect(() => {
    setQ(sp.get("q") || "");
  }, [sp]);

  const found = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!rows || !words.length) return [];
    return rows.filter((x) => words.every((w) => x.n.includes(w))).slice(0, 120);
  }, [rows, q]);

  return (
    <div style={{ paddingBottom: 60 }}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.replace(href(lang, `/search?q=${encodeURIComponent(q)}`));
        }}
        style={{ marginBottom: 20 }}
      >
        <label className="sr" htmlFor="sq">{d.search_ph}</label>
        <input id="sq" className="text" type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={d.search_ph} />
      </form>
      {!rows && <p className="empty"><span className="spin" /> {d.loading}</p>}
      {rows && q.trim() && found.length === 0 && <p className="empty">{d.search_none}</p>}
      <ul className="days">
        {found.map(({ r }) => (
          <li key={r[0]}>
            <Link href={href(lang, `/p/${r[0]}`)} style={{ display: "grid", gap: 4 }}>
              <span style={{ fontFamily: "var(--serif)", fontSize: "1.08rem" }}>{texPlain(r[1])}</span>
              <span className="n" style={{ fontSize: "0.85rem", display: "flex", gap: 10, alignItems: "center" }}>
                <span className="sw" style={{ background: FIELD[r[3]]?.color }} />
                {fieldName(r[3], lang)}, {topicName(r[3], r[4], lang)}. {formatDay(r[2], lang, "short")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
