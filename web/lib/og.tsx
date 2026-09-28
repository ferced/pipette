import { readFile } from "node:fs/promises";
import { join } from "node:path";

const dir = join(process.cwd(), "assets", "fonts");
export const ogFonts = async () => [
  { name: "STIX", data: await readFile(join(dir, "stix-600.ttf")), weight: 600 as const, style: "normal" as const },
  { name: "STIX", data: await readFile(join(dir, "stix-italic.ttf")), weight: 400 as const, style: "italic" as const },
  { name: "Atkinson", data: await readFile(join(dir, "atk-700.ttf")), weight: 700 as const, style: "normal" as const },
  { name: "Atkinson", data: await readFile(join(dir, "atk-400.ttf")), weight: 400 as const, style: "normal" as const },
];

export const C = { bench: "#eef2f0", ink: "#14201c", ink2: "#4a5a54", pink: "#c2186b", line: "#d3dcd8" };

export function OgMark({ size = 64, color = C.ink }: { size?: number; color?: string }) {
  return (
    <svg width={(size * 30) / 32} height={size} viewBox="0 0 30 32">
      <g transform="translate(1 -2) rotate(28 12 24)">
        <rect x="7.5" y="0.8" width="9" height="9.6" rx="4.5" fill={color} />
        <rect x="9.6" y="9.2" width="4.8" height="1.8" rx="0.6" fill={color} opacity="0.55" />
        <path d="M10 11.4h4v8.2l-1.35 4.4h-1.3L10 19.6z" fill={color} />
      </g>
      <path d="M13 24.6c0 0-2.55 2.75-2.55 4.35a2.55 2.55 0 0 0 5.1 0c0-1.6-2.55-4.35-2.55-4.35z" fill={C.pink} />
    </svg>
  );
}

export const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s);
