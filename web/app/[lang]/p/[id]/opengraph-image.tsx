import { ImageResponse } from "next/og";
import { getPaper } from "@/lib/data";
import { FIELD, fieldName, isLang, topicName } from "@/lib/i18n";
import { C, OgMark, clip, ogFonts } from "@/lib/og";
import { texPlain } from "@/lib/tex";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "A paper on Pipette";

export default async function Image({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const l = isLang(lang) ? lang : "en";
  const p = await getPaper(id);
  const fonts = await ogFonts();
  if (!p) {
    return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", background: C.bench }} />, { ...size, fonts });
  }
  const title = clip(texPlain(p.title), 140);
  const key = clip(texPlain(p.key_text || ""), 210);
  const status = p.src === "journal" ? (l === "es" ? "Revista con revisión por pares" : "Peer-reviewed journal") : l === "es" ? "Preprint" : "Preprint";
  const tsize = title.length > 95 ? 46 : title.length > 60 ? 54 : 62;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.bench, padding: "56px 72px", fontFamily: "Atkinson", color: C.ink }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: C.ink2 }}>
          <div style={{ width: 18, height: 18, borderRadius: 9, background: FIELD[p.field]?.color ?? C.ink2 }} />
          <span>{fieldName(p.field, l)}</span>
          <span style={{ color: "#9aa8a2" }}>/</span>
          <span>{topicName(p.field, p.topic, l)}</span>
        </div>
        <div style={{ fontFamily: "STIX", fontWeight: 600, fontSize: tsize, lineHeight: 1.12, marginTop: 26, letterSpacing: -0.5 }}>{title}</div>
        {key && (
          <div style={{ display: "flex", gap: 18, marginTop: 28, alignItems: "flex-start" }}>
            <svg width="22" height="30" viewBox="0 0 10 14" style={{ marginTop: 8 }}>
              <path d="M5 0.6C5 0.6 0.9 5.2 0.9 8.7a4.1 4.1 0 0 0 8.2 0C9.1 5.2 5 0.6 5 0.6z" fill={C.pink} />
            </svg>
            <div style={{ fontFamily: "STIX", fontStyle: "italic", fontSize: 30, lineHeight: 1.35, color: C.ink2, flex: 1 }}>{key}</div>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <OgMark size={46} />
            <span style={{ fontWeight: 700, fontSize: 36, letterSpacing: -1 }}>pipette</span>
          </div>
          <span style={{ color: C.ink2 }}>
            {p.venue}. {status}
          </span>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
