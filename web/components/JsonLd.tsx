import { ld } from "@/lib/seo";

/** Structured data for search engines, rendered on the server. */
export function JsonLd({ nodes }: { nodes: object[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld(...nodes) }} />;
}
