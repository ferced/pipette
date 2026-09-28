import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getEdition, getMethod, getSiteIndex } from "@/lib/data";
import { EVIDENCE, KINDS, href, isLang, num, t } from "@/lib/i18n";
import type { Lang } from "@/lib/types";
import { pageMeta } from "@/lib/seo";

export const revalidate = 3600;

export async function generateMetadata({ params }: PageProps<"/[lang]/about">): Promise<Metadata> {
  const { lang } = await params;
  const l = isLang(lang) ? lang : "en";
  return pageMeta({
    lang: l, path: "/about", title: l === "es" ? "Por qué existe Pipette y cómo elige los papers" : "Why Pipette exists and how it picks papers",
    description: l === "es" ? "Pipette lee cada paper nuevo y elige los mejores sin reescribir la ciencia: sin publicidad, sin rastreo y con el método público. Hecho por Ferced." : "Pipette reads every new paper and picks the best without rewriting science: no ads, no tracking, and a public method. Made by Ferced.",
  });
}

const copy = {
  en: {
    lead: "Thousands of new research papers appear every day, and AI is about to multiply that number. Pipette reads all of them each morning and hands you the few worth knowing about, in the words of the people who did the work.",
    problemH: "The problem",
    problem: [
      "Science now arrives faster than anyone can read it. arXiv alone posts around two thousand new papers on a weekday, and bioRxiv, medRxiv and the big journals add hundreds more. With AI tools helping people write, that flood is only getting bigger.",
      "The tools we have were built for a different job. Search engines work when you already know what to look for. Social feeds reward whatever is loudest. AI summaries are quick, but they put words in scientists' mouths, and a confident summary of a paper is not the paper.",
      "Pipette is for the other moment: opening one page in the morning to see what science found yesterday, across every field, without being sold anything.",
    ],
    promisesH: "What we promise",
    promises: [
      ["Every word is the authors'.", "Pipette never summarizes or rewrites a paper. The machine picks the sentence that states the main result and labels the paper. What you read was written by the scientists."],
      ["No ads, no tracking, no accounts.", "Nobody can pay to be in the edition. There are no analytics scripts. Your saved papers and interests stay in your browser."],
      ["Honest about what a paper is.", "Preprints are marked as not yet peer-reviewed. Abstracts that claim more than they show are flagged for careful reading and never make the daily edition."],
      ["Every field gets a seat.", "No field may take more than three places in the daily edition, so a busy day in AI cannot push out ecology or mathematics."],
      ["We show our work.", "The exact questions, the answers with their probabilities and the ranking formula are all public, on every paper and on this page."],
      ["Open data.", "Everything Pipette produces is published as JSON that anyone can reuse."],
      ["Respect for authors and publishers.", "When a journal's licence does not allow republishing an abstract, Pipette quotes only the two sentences it selected and links to the publisher."],
    ],
    methodH: "How it works",
    steps: [
      ["Collect.", "Every night Pipette downloads the new papers of the previous day from arXiv, bioRxiv, medRxiv and 58 leading journals through OpenAlex. Revised versions of older papers are skipped."],
      ["Split.", "Each abstract is cut into sentences, with the mathematics kept intact."],
      ["Ask.", "Jev, a decision model built by TypeSafe, answers ten questions about every paper. Jev does not generate text: it can only choose among options we define and say how likely each one is. That is why it cannot invent anything."],
      ["Rank.", "Pipette combines the answers with a fixed formula, then builds the edition with diversity rules."],
      ["Publish.", "The edition, the full list and one page per paper go live, along with the open data."],
    ],
    questionsH: "The questions Jev answers for every paper",
    rankingH: "The ranking rule",
    limitsH: "What Pipette cannot do",
    limits: [
      "Jev reads only the title and the abstract, not the full paper. Its labels describe what a paper claims, not whether the claim is true.",
      "Peer review, replication and time are what establish results. Pipette is a way to notice research, not a verdict on it.",
      "Jev is most accurate in English. It will sometimes get a topic wrong or miss a paper that deserved the edition. The percentages on each paper show how sure it was.",
    ],
    sourcesH: "Sources",
    sourcesNote: "arXiv does not announce new papers on weekends, so Saturday and Sunday editions are smaller.",
    dataH: "Open data",
    dataLead: "All files are JSON. Reuse them freely under the terms of the original sources: arXiv metadata is CC0, bioRxiv and medRxiv abstracts carry the licence their authors chose, and journal metadata comes from OpenAlex (CC0).",
    privacyH: "Privacy",
    privacy: [
      "Pipette has no accounts, no ads and no analytics. The only cookie is lang, set when you choose a language, so the site remembers it.",
      "Saved papers and your For you settings are stored in your browser's local storage and never leave your device, except the one sentence you type in For you, which is sent to Jev to rank the day's papers and is not stored.",
      "The site is hosted on Vercel, which keeps standard server logs for security.",
    ],
    whoH: "Who makes Pipette",
    who: "Pipette is made and paid for by Ferced, a small software studio from Buenos Aires. We build software for companies. We built Pipette because we wanted it to exist, and we keep it free because science belongs to everyone. If you find a bug or have an idea, write to hola@ferced.com.",
    cost: (n: string, c: string) => `Reading yesterday's ${n} papers cost ${c} in model usage.`,
  },
  es: {
    lead: "Todos los días aparecen miles de papers nuevos, y la IA está por multiplicar ese número. Pipette los lee todos cada mañana y te acerca los pocos que vale la pena conocer, con las palabras de quienes hicieron el trabajo.",
    problemH: "El problema",
    problem: [
      "La ciencia llega más rápido de lo que cualquiera puede leer. Solo arXiv publica unos dos mil papers nuevos por día hábil, y bioRxiv, medRxiv y las grandes revistas suman cientos más. Con herramientas de IA ayudando a escribir, esa ola no para de crecer.",
      "Las herramientas que existen se hicieron para otra cosa. Los buscadores sirven cuando ya sabés qué buscar. Las redes premian lo que más grita. Los resúmenes con IA son rápidos, pero ponen palabras en boca de los científicos, y un resumen seguro de sí mismo no es el paper.",
      "Pipette es para el otro momento: abrir una sola página a la mañana y ver qué encontró la ciencia ayer, en todos los campos, sin que nadie te venda nada.",
    ],
    promisesH: "Lo que prometemos",
    promises: [
      ["Cada palabra es de los autores.", "Pipette nunca resume ni reescribe un paper. La máquina elige la oración que dice el resultado principal y clasifica el paper. Lo que leés lo escribieron los científicos."],
      ["Sin publicidad, sin rastreo, sin cuentas.", "Nadie puede pagar para aparecer en la edición. No hay scripts de analítica. Tus guardados y tus intereses quedan en tu navegador."],
      ["Honestos con lo que es cada paper.", "Los preprints se marcan como todavía no revisados por pares. Los resúmenes que afirman más de lo que muestran se señalan para leerlos con cuidado y nunca entran en la edición del día."],
      ["Cada campo tiene su lugar.", "Ningún campo puede ocupar más de tres lugares en la edición del día, así un día agitado en IA no desplaza a la ecología ni a la matemática."],
      ["Mostramos cómo trabajamos.", "Las preguntas exactas, las respuestas con sus probabilidades y la fórmula del ranking son públicas, en cada paper y en esta página."],
      ["Datos abiertos.", "Todo lo que produce Pipette se publica como JSON que cualquiera puede reutilizar."],
      ["Respeto por autores y editoriales.", "Cuando la licencia de una revista no permite republicar el resumen, Pipette cita solo las dos oraciones que eligió y enlaza a la editorial."],
    ],
    methodH: "Cómo funciona",
    steps: [
      ["Recolectar.", "Cada noche Pipette descarga los papers nuevos del día anterior de arXiv, bioRxiv, medRxiv y 58 revistas líderes a través de OpenAlex. Las versiones revisadas de papers viejos se descartan."],
      ["Separar.", "Cada resumen se corta en oraciones, sin romper la matemática."],
      ["Preguntar.", "Jev, un modelo de decisión de TypeSafe, responde diez preguntas sobre cada paper. Jev no genera texto: solo puede elegir entre opciones que definimos y decir qué tan probable es cada una. Por eso no puede inventar nada."],
      ["Ordenar.", "Pipette combina las respuestas con una fórmula fija y arma la edición con reglas de diversidad."],
      ["Publicar.", "Salen la edición, la lista completa y una página por paper, junto con los datos abiertos."],
    ],
    questionsH: "Las preguntas que Jev responde sobre cada paper",
    rankingH: "La regla del ranking",
    limitsH: "Lo que Pipette no puede hacer",
    limits: [
      "Jev lee solo el título y el resumen, no el paper completo. Sus etiquetas describen lo que un paper afirma, no si es verdad.",
      "La revisión por pares, la replicación y el tiempo son los que confirman un resultado. Pipette sirve para enterarse, no para dar un veredicto.",
      "Jev es más preciso en inglés. A veces se va a equivocar de tema o va a dejar afuera un paper que merecía la edición. Los porcentajes de cada paper muestran qué tan seguro estaba.",
    ],
    sourcesH: "Fuentes",
    sourcesNote: "arXiv no anuncia papers nuevos los fines de semana, así que las ediciones de sábado y domingo son más chicas.",
    dataH: "Datos abiertos",
    dataLead: "Todos los archivos son JSON. Reutilizalos libremente respetando los términos de cada fuente: los metadatos de arXiv son CC0, los resúmenes de bioRxiv y medRxiv tienen la licencia que eligieron sus autores, y los metadatos de revistas vienen de OpenAlex (CC0).",
    privacyH: "Privacidad",
    privacy: [
      "Pipette no tiene cuentas, publicidad ni analítica. La única cookie es lang, que se guarda cuando elegís un idioma para recordarlo.",
      "Los guardados y la configuración de Para vos viven en el almacenamiento local de tu navegador y no salen de tu dispositivo, salvo la frase que escribís en Para vos, que se envía a Jev para ordenar los papers del día y no se guarda.",
      "El sitio está alojado en Vercel, que guarda los registros estándar de servidor por seguridad.",
    ],
    whoH: "Quién hace Pipette",
    who: "Pipette lo hace y lo paga Ferced, un estudio de software chico de Buenos Aires. Hacemos software para empresas. Hicimos Pipette porque queríamos que existiera, y lo mantenemos gratis porque la ciencia es de todos. Si encontrás un error o tenés una idea, escribinos a hola@ferced.com.",
    cost: (n: string, c: string) => `Leer los ${n} papers de ayer costó ${c} de uso del modelo.`,
  },
};

const Q_ORDER = ["topic", "kind", "evidence", "key", "caveat", "appeal", "advance", "level", "hype", "practical"];

export default async function AboutPage({ params }: PageProps<"/[lang]/about">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const c = copy[lang as Lang];
  const d = t(lang);
  const [method, idx] = await Promise.all([getMethod(), getSiteIndex()]);
  const ed = idx ? await getEdition(idx.latest) : null;
  const scales = method?.scales ?? {};
  const optionsFor = (k: string): string[] => {
    if (k === "kind") return KINDS.map((x) => x.d);
    if (k === "evidence") return EVIDENCE.map((x) => x.d);
    return scales[k] ?? [];
  };

  return (
    <div className="wrap">
      <div className="page-h">
        <h1>{d.about_title}</h1>
        <p style={{ fontSize: "1.12rem", maxWidth: "40em" }}>{c.lead}</p>
      </div>
      <div className="prose">
        <h2>{c.problemH}</h2>
        {c.problem.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <h2>{c.promisesH}</h2>
        {c.promises.map(([h, b]) => (
          <div className="qa" key={h}>
            <b>{h}</b>
            <div>{b}</div>
          </div>
        ))}

        <h2 id="method">{c.methodH}</h2>
        <ol>
          {c.steps.map(([h, b]) => (
            <li key={h}>
              <b>{h}</b> {b}
            </li>
          ))}
        </ol>
        {ed && <p>{c.cost(num(ed.total, lang), `US$${((ed.jev_tokens * 0.042) / 1e6).toFixed(2)}`)}</p>}

        <h2>{c.questionsH}</h2>
        <p className="fine">
          {lang === "es"
            ? "Las preguntas van en inglés, tal como se las enviamos al modelo."
            : "These are sent to the model exactly as written."}{" "}
          {method?.model_version ? `(${method.model_version})` : ""}
        </p>
        {method &&
          Q_ORDER.filter((k) => method.questions[k]).map((k) => (
            <div className="qa" key={k}>
              <b lang="en">{method.questions[k]}</b>
              {optionsFor(k).length > 0 && (
                <div>
                  <ul style={{ margin: "4px 0 0" }}>
                    {optionsFor(k).map((o) => (
                      <li key={o} lang="en" style={{ fontSize: "0.92rem" }}>
                        {o}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}

        <h2>{c.rankingH}</h2>
        <p>
          <code lang="en">{method?.ranking}</code>
        </p>

        <h2>{c.limitsH}</h2>
        {c.limits.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <h2 id="sources">{c.sourcesH}</h2>
        <ul>
          <li><a href="https://arxiv.org" target="_blank" rel="noopener">arXiv</a></li>
          <li><a href="https://www.biorxiv.org" target="_blank" rel="noopener">bioRxiv</a></li>
          <li><a href="https://www.medrxiv.org" target="_blank" rel="noopener">medRxiv</a></li>
          <li><a href="https://openalex.org" target="_blank" rel="noopener">OpenAlex</a> (Nature, Science, Cell, PNAS, The Lancet, NEJM, JAMA, BMJ, Physical Review Letters, JACS, eLife…)</li>
        </ul>
        <p>{c.sourcesNote}</p>
        <p className="fine">Thank you to arXiv for use of its open access interoperability.</p>

        <h2 id="data">{c.dataH}</h2>
        <p>{c.dataLead}</p>
        <ul>
          <li><a href="/data/v1/index.json"><code>/data/v1/index.json</code></a></li>
          {idx && (
            <>
              <li><a href={`/data/v1/days/${idx.latest}/edition.json`}><code>/data/v1/days/{idx.latest}/edition.json</code></a></li>
              <li><a href={`/data/v1/days/${idx.latest}/index.json`}><code>/data/v1/days/{idx.latest}/index.json</code></a></li>
            </>
          )}
          <li><code>/data/v1/p/&lt;id&gt;.json</code></li>
          <li><a href="/data/v1/method.json"><code>/data/v1/method.json</code></a></li>
          <li><a href="/rss/edition.xml"><code>/rss/edition.xml</code></a>, <code>/rss/&lt;field&gt;.xml</code></li>
        </ul>

        <h2 id="privacy">{c.privacyH}</h2>
        {c.privacy.map((p) => (
          <p key={p}>{p}</p>
        ))}

        <h2 id="ferced">{c.whoH}</h2>
        <p>{c.who}</p>
        <p>
          <a href="https://ferced.com" target="_blank" rel="noopener">ferced.com</a>
          {" · "}
          <Link href={href(lang, "/")}>{d.back_today}</Link>
        </p>
      </div>
    </div>
  );
}
