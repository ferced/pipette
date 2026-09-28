import Link from "next/link";
import { FIELD, fieldName, href, topicName, t } from "@/lib/i18n";
import { authorLine, signals, sourceUrl, type Entry } from "@/lib/entry";
import type { Lang } from "@/lib/types";
import { Drop } from "./Logo";
import { Tex } from "./Tex";
import { SaveButton } from "./client";

function External() {
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      <path d="M4 1.5h5.5V7M9.3 1.7L1.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EntryView({ e, lang, compact = false, extra }: { e: Entry; lang: Lang; compact?: boolean; extra?: React.ReactNode }) {
  const d = t(lang);
  const color = FIELD[e.field]?.color ?? "var(--ink-3)";
  const link = href(lang, `/p/${e.id}`);
  const sig = signals(e, lang);
  return (
    <li className={compact ? "row" : "entry"}>
      <div className="where">
        <span className="sw" style={{ background: color }} aria-hidden="true" />
        <Link href={href(lang, `/f/${e.field}`)}>{fieldName(e.field, lang)}</Link>
        <span className="sep" aria-hidden="true">/</span>
        <Link href={href(lang, `/f/${e.field}/${e.topic}`)}>{topicName(e.field, e.topic, lang)}</Link>
        {extra}
      </div>
      <h3 className="title" lang="en">
        <Link href={link}>
          <Tex text={e.title} />
        </Link>
      </h3>
      {e.key && (
        <div className="drop-quote">
          <Drop size={compact ? 12 : 14} />
          <Tex as="blockquote" text={e.key} lang="en" />
        </div>
      )}
      <p className="byline">
        {authorLine(e, lang)}
        {" — "}
        <span className="venue">{e.venue}</span>
      </p>
      <div className="foot">
        <div className="signals">
          {sig.map((s) => (
            <span key={s.label} className={`sig ${s.tone === "on" ? "on" : s.tone === "warn" ? "warn" : s.tone === "pre" ? "status-pre" : ""}`}>
              {s.label}
            </span>
          ))}
        </div>
        <div className="acts">
          <SaveButton entry={e} lang={lang} />
          {!compact && (
            <a className="btn primary" href={sourceUrl(e)} target="_blank" rel="noopener">
              {d.read_paper}
              <External />
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export { External };
