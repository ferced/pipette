import katex from "katex";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Turn common LaTeX text commands found in arXiv abstracts into plain text. */
export function detex(s: string) {
  return s
    .replace(/\\(?:emph|textit|textbf|textrm|textsf|texttt|mathrm|text|underline)\{([^{}]*)\}/g, "$1")
    .replace(/``|''/g, '"')
    .replace(/\\%/g, "%")
    .replace(/\\&/g, "&")
    .replace(/\\_/g, "_")
    .replace(/\\,/g, " ")
    .replace(/\{\\(?:it|bf|em)\s+([^{}]*)\}/g, "$1");
}

/** Render a string that may contain $...$ math into safe HTML. */
export function texHtml(input: string | null | undefined): string {
  if (!input) return "";
  const s = detex(input);
  const out: string[] = [];
  const re = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    out.push(esc(s.slice(last, m.index)));
    const expr = m[1] ?? m[2];
    try {
      out.push(katex.renderToString(expr, { throwOnError: false, displayMode: false, output: "html", strict: "ignore" }));
    } catch {
      out.push(esc(m[0]));
    }
    last = m.index + m[0].length;
  }
  out.push(esc(s.slice(last)));
  return out.join("");
}

/** Plain text version (for metadata, search and RSS). */
export function texPlain(input: string | null | undefined) {
  if (!input) return "";
  return detex(input).replace(/\$([^$]+)\$/g, (_, e: string) => e.replace(/\\([a-zA-Z]+)/g, "$1").replace(/[{}^_]/g, ""));
}
