import { texHtml } from "@/lib/tex";

export function Tex({ text, as: As = "span", className, lang }: { text: string | null | undefined; as?: "span" | "p" | "blockquote" | "div"; className?: string; lang?: string }) {
  return <As className={className} lang={lang} dangerouslySetInnerHTML={{ __html: texHtml(text) }} />;
}
