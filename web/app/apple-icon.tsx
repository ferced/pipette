import { ImageResponse } from "next/og";
import { C, OgMark } from "@/lib/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: C.ink }}>
        <OgMark size={130} color={C.bench} />
      </div>
    ),
    size,
  );
}
