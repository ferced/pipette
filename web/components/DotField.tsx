"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { fieldName, href } from "@/lib/i18n";
import type { DayIndex, Lang } from "@/lib/types";
import { texPlain } from "@/lib/tex";

export const DATA_BASE = process.env.NEXT_PUBLIC_DATA_BASE || "/data";

type Props = {
  codes: string; // one char per paper: field index as a letter, uppercase when it made the edition
  fields: string[];
  colors: string[];
  date: string;
  lang: Lang;
  label: string;
};

/** Fixed column counts per container width, so the height is known before any JS runs
 * (aspect-ratio = cols / rows) and nothing shifts when the canvas draws. */
export const COLS = { l: 132, m: 90, s: 48 };
const colsFor = (w: number) => (w >= 900 ? COLS.l : w >= 600 ? COLS.m : COLS.s);

function geometry(width: number, n: number) {
  const cols = colsFor(width);
  const pitch = width / cols;
  const s = Math.max(3, pitch * 0.7);
  const rows = Math.ceil(n / cols);
  return { s, pitch, cols, rows, height: rows * pitch };
}

export default function DotField({ codes, fields, colors, date, lang, label }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [titles, setTitles] = useState<{ id: string; t: string }[] | null>(null);
  const loading = useRef(false);
  const router = useRouter();
  const anim = useRef(1);
  const n = codes.length;

  // Measure
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(
    (hi: number | null) => {
      const c = canvas.current;
      if (!c || !width) return;
      const g = geometry(width, n);
      const dpr = window.devicePixelRatio || 1;
      c.width = Math.round(width * dpr);
      c.height = Math.round(g.height * dpr);

      const ctx = c.getContext("2d")!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, g.height);
      const css = getComputedStyle(document.documentElement);
      const pink = css.getPropertyValue("--indicator").trim() || "#c2186b";
      const ink = css.getPropertyValue("--ink").trim() || "#14201c";
      const r = g.s / 2;
      const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
      const base = dark ? 0.9 : 0.62;
      const t = anim.current;
      const ease = 1 - Math.pow(1 - t, 3);
      const picks: number[] = [];
      for (let i = 0; i < n; i++) {
        const ch = codes.charCodeAt(i);
        const pick = ch < 97;
        if (pick) {
          picks.push(i);
          continue;
        }
        const fi = ch - 97;
        const x = (i % g.cols) * g.pitch + g.pitch / 2;
        const y = Math.floor(i / g.cols) * g.pitch + g.pitch / 2;
        ctx.globalAlpha = (hi !== null && hi !== i ? 0.7 : 1) * base;
        ctx.fillStyle = colors[fi] || ink;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const i of picks) {
        const x = (i % g.cols) * g.pitch + g.pitch / 2;
        const y = Math.floor(i / g.cols) * g.pitch + g.pitch / 2 - (1 - ease) * 16;
        ctx.globalAlpha = Math.min(1, ease * 1.4);
        ctx.fillStyle = pink;
        ctx.beginPath();
        ctx.arc(x, y, r + 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (hi !== null) {
        const x = (hi % g.cols) * g.pitch + g.pitch / 2;
        const y = Math.floor(hi / g.cols) * g.pitch + g.pitch / 2;
        ctx.globalAlpha = 1;
        ctx.strokeStyle = ink;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(x, y, r + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    [codes, colors, n, width],
  );

  // The one orchestrated moment: today's picks drop into place once.
  useEffect(() => {
    if (!width) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || document.hidden || sessionStorageSeen(date)) {
      anim.current = 1;
      draw(null);
      return;
    }
    anim.current = 0;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      anim.current = Math.min(1, (now - start - 250) / 900);
      if (anim.current < 0) anim.current = 0;
      draw(null);
      if (anim.current < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    // If frames are throttled (background tab), make sure the picks still show up.
    const done = setTimeout(() => {
      if (anim.current < 1) {
        cancelAnimationFrame(raf);
        anim.current = 1;
        draw(null);
      }
    }, 1500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(done);
      anim.current = 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

  useEffect(() => {
    if (anim.current >= 1) draw(hover ? hover.i : null);
  }, [hover, draw]);

  // Redraw on theme change
  useEffect(() => {
    const redraw = () => draw(null);
    const mo = new MutationObserver(redraw);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", redraw);
    return () => {
      mo.disconnect();
      mq.removeEventListener("change", redraw);
    };
  }, [draw]);

  const loadTitles = () => {
    if (titles || loading.current) return;
    loading.current = true;
    fetch(`${DATA_BASE}/v1/days/${date}/index.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DayIndex | null) => {
        if (!d) return;
        const order = new Map(fields.map((f, i) => [f, i]));
        const sorted = d.papers
          .map((p, i) => ({ p, i }))
          .sort((a, b) => (order.get(a.p.f) ?? 99) - (order.get(b.p.f) ?? 99) || a.i - b.i)
          .map(({ p }) => ({ id: p.id, t: texPlain(p.t) }));
        setTitles(sorted);
      })
      .catch(() => {});
  };

  const indexAt = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const g = geometry(width, n);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const col = Math.floor(x / g.pitch);
    const row = Math.floor(y / g.pitch);
    if (col < 0 || col >= g.cols || row < 0) return null;
    const i = row * g.cols + col;
    return i < n ? { i, x, y } : null;
  };

  const hovered = hover ? codes.charCodeAt(hover.i) : 0;
  const fi = hovered ? (hovered < 97 ? hovered - 65 : hovered - 97) : 0;

  return (
    <div
      className="dots"
      ref={wrap}
      style={
        {
          "--ar-l": `${COLS.l} / ${Math.ceil(n / COLS.l)}`,
          "--ar-m": `${COLS.m} / ${Math.ceil(n / COLS.m)}`,
          "--ar-s": `${COLS.s} / ${Math.ceil(n / COLS.s)}`,
        } as React.CSSProperties
      }
    >
      <canvas
        ref={canvas}
        role="img"
        aria-label={label}
        onPointerMove={(e) => {
          loadTitles();
          const h = indexAt(e);
          setHover(h);
        }}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const h = indexAt(e);
          if (h && titles?.[h.i]) router.push(href(lang, `/p/${titles[h.i].id}`));
        }}
      />
      {hover && (
        <div
          className="dots-tip"
          style={{ left: Math.min(Math.max(0, hover.x - 20), Math.max(0, width - 340)), top: hover.y + 14 }}
        >
          <b>{fieldName(fields[fi], lang)}</b>
          {titles ? titles[hover.i]?.t : "…"}
        </div>
      )}
    </div>
  );
}

function sessionStorageSeen(date: string) {
  try {
    const k = "pipette.dropped." + date;
    if (sessionStorage.getItem(k)) return true;
    sessionStorage.setItem(k, "1");
  } catch {}
  return false;
}
