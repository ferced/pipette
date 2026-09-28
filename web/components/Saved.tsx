"use client";

import { bibtex } from "@/lib/entry";
import { t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { EntryView } from "./EntryView";
import { savedApi, useMounted, useSaved } from "./client";

export default function Saved({ lang }: { lang: Lang }) {
  const d = t(lang);
  const list = useSaved();
  const mounted = useMounted();
  if (!mounted) return <p className="empty"><span className="spin" /> {d.loading}</p>;
  if (!list.length) return <p className="empty">{d.saved_empty}</p>;

  const exportBib = () => {
    const blob = new Blob([list.map(bibtex).join("\n\n") + "\n"], { type: "application/x-bibtex" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "pipette-saved.bib";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div style={{ paddingBottom: 60, maxWidth: 860 }}>
      <div className="bar">
        <span>
          {list.length} {d.papers}
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className="btn primary" onClick={exportBib}>
            {d.export_bib}
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (confirm(lang === "es" ? "¿Borrar todos los guardados?" : "Remove every saved paper?")) savedApi.clear();
            }}
          >
            {d.clear_all}
          </button>
        </span>
      </div>
      <ul className="rows">
        {list.map((e) => (
          <EntryView key={e.id} e={e} lang={lang} compact />
        ))}
      </ul>
    </div>
  );
}
