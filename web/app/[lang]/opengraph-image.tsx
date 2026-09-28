import { ImageResponse } from "next/og";
import { C, OgMark, ogFonts } from "@/lib/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Pipette — today's science, one drop at a time";

export default async function Image({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const es = lang === "es";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: C.bench, padding: "72px 80px", fontFamily: "Atkinson" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <OgMark size={92} />
          <div style={{ fontSize: 84, fontWeight: 700, color: C.ink, letterSpacing: -3 }}>pipette</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 62, fontWeight: 700, color: C.ink, lineHeight: 1.08, letterSpacing: -1.5, maxWidth: 980 }}>
            {es ? "La ciencia de hoy, gota a gota." : "Today's science, one drop at a time."}
          </div>
          <div style={{ fontFamily: "STIX", fontStyle: "italic", fontSize: 34, color: C.ink2, maxWidth: 980, lineHeight: 1.3 }}>
            {es
              ? "Leemos cada paper nuevo, todos los días. Te traemos los que valen la pena, en palabras de sus autores."
              : "We read every new paper, every day, and bring you the ones worth knowing, in their authors' own words."}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: C.ink2 }}>
          <span style={{ color: C.pink, fontWeight: 700 }}>pipette.day</span>
          <span>{es ? "Hecho por Ferced. Sin publicidad." : "Made by Ferced. No ads."}</span>
        </div>
      </div>
    ),
    { ...size, fonts: await ogFonts() },
  );
}
