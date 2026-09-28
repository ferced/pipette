import { getSiteIndex } from "@/lib/data";
import { FIELDS } from "@/lib/i18n";
import { SITE } from "@/lib/entry";

export const revalidate = 3600;

export async function GET() {
  const idx = await getSiteIndex();
  const latest = idx?.latest ?? "";
  const body = `# Pipette

> Pipette (${SITE}) is a free daily digest of new research papers, made by Ferced (https://ferced.com). Every morning it reads every new paper on arXiv, bioRxiv, medRxiv and 58 leading journals, labels each one with the Jev decision model (field, topic, kind of contribution, evidence, interest, claimed advance, reading level, overclaiming) and publishes a short edition of the papers worth knowing about. The authors' words always come first: Pipette quotes the sentence of each abstract that states the main result, exactly as written. Papers in the daily edition also get a short, clearly labelled plain-language summary in English and Spanish, written by Claude from the abstract only; Jev checks every sentence against the abstract sentences it cites and removes anything unsupported. No ads, no tracking, no accounts.

## Main pages

- [Today's edition](${SITE}/): the best new papers of the day, across every field
- [Every field](${SITE}/f): new papers by field and topic
- [Open data](${SITE}/open-data): the full daily dataset as JSON, public domain labels
- [How Pipette works](${SITE}/about#method): the exact questions asked about every paper and the ranking rule
- [Archive](${SITE}/archive): every past edition

## Fields

${FIELDS.map((f) => `- [${f.en}](${SITE}/f/${f.id})`).join("\n")}

## Sources

- [New arXiv papers](${SITE}/source/arxiv)
- [New bioRxiv preprints](${SITE}/source/biorxiv)
- [New medRxiv preprints](${SITE}/source/medrxiv)
- [New papers in leading journals](${SITE}/source/journals)

## Data

- [Site index](${SITE}/data/v1/index.json)
- [Latest edition](${SITE}/data/v1/days/${latest}/edition.json)
- [Every paper of the latest day](${SITE}/data/v1/days/${latest}/index.json)
- [Method](${SITE}/data/v1/method.json)
- One paper: ${SITE}/data/v1/p/<id>.json (the same id as ${SITE}/p/<id>)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=3600" } });
}
