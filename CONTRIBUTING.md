# Contributing to Pipette

Thanks for helping make new science easier to find. Issues and pull requests are welcome, in English or Spanish.

## Good first contributions

- **A paper was labeled wrong.** Open an issue with the paper link, what Pipette said and what you expected. These reports are the best way to improve the questions in `ingest/pipette/enrich.py`.
- **A source is missing.** Suggest a journal or preprint server, ideally with its OpenAlex source ID.
- **Taxonomy.** Better topic names or descriptions in `shared/taxonomy.json` (English and Spanish).
- **Accessibility, performance and translations** of the site in `web/`.

## Ground rules

Pipette makes a few promises that every change has to keep:

1. Never show machine-written text as if it described a paper. Jev picks and labels; the authors speak.
2. No ads, analytics, trackers or accounts. The only cookie is `lang`.
3. Respect licences: closed-licence abstracts are not republished.
4. The questions and ranking rule shown on `/about` must come from the same code that runs.

## Development

See [Run it locally](README.md#run-it-locally). Before opening a pull request:

```bash
cd ingest && python -m unittest discover -s tests          # pipeline tests, no network
cd web && npx next typegen && npx tsc --noEmit && npm run build
```

If you change `shared/taxonomy.json`, copy it to `web/lib/taxonomy.json` too.

Keep pull requests focused, describe what changed and why, and include a screenshot for visual changes.
