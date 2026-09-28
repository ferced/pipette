"""Renders the model research as a local HTML report: docs/research/resumenes-ia.html"""
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "docs", "research", "resumenes-ia.html")
data = json.load(open(os.path.join(HERE, "bench", "_summary.json"), encoding="utf-8"))
ms = data["metrics"]
runs = data["runs"]
e = html.escape

NAMES = {
    "claude-sonnet-5": "Claude Sonnet 5", "claude-haiku-4.5": "Claude Haiku 4.5", "nova-2-lite": "Amazon Nova 2 Lite",
    "nova-micro": "Amazon Nova Micro", "qwen3-32b": "Qwen3 32B", "qwen3-next-80b": "Qwen3 Next 80B",
    "gpt-oss-120b": "gpt-oss 120B", "gpt-oss-20b": "gpt-oss 20B", "deepseek-v3.2": "DeepSeek V3.2",
    "gemma-3-27b": "Gemma 3 27B", "gemma-3-12b": "Gemma 3 12B", "llama-4-maverick": "Llama 4 Maverick",
    "mistral-large-3": "Mistral Large 3", "ministral-3-14b": "Ministral 3 14B", "glm-4.7": "GLM-4.7",
    "glm-4.7-flash": "GLM-4.7 Flash", "kimi-k2.5": "Kimi K2.5", "nemotron-nano-3-30b": "Nemotron Nano 3 30B",
}
FAV = {"kimi-k2.5": "recomendado", "llama-4-maverick": "alternativa", "claude-sonnet-5": "tu elección anterior"}


def pct(x):
    return f"{x * 100:.0f}%"


rows = []
for m in ms:
    tag = FAV.get(m["key"])
    rows.append(f"""<tr class="{'fav' if tag else ''}">
<td><b>{e(NAMES.get(m['key'], m['key']))}</b>{f'<span class="tag">{tag}</span>' if tag else ''}<div class="sub">{e(m['provider'])}</div></td>
<td>{e(m['where'])}{' *' if m['runner'] == 'cli' else ''}</td>
<td class="n">{m['publishable']}/{m['papers']}</td>
<td class="n">{pct(m['keep_rate'])}<div class="bar"><i style="width:{m['keep_rate'] * 100:.0f}%"></i></div></td>
<td class="n">{m['flesch']}</td>
<td class="n">{m['acronyms']}</td>
<td class="n">{m['words']}</td>
<td class="n">{m['latency']} s</td>
<td class="n"><b>US$ {m['cost_month']:.2f}</b></td>
</tr>""")

# side-by-side example
EX_MODELS = ["kimi-k2.5", "llama-4-maverick", "claude-sonnet-5", "gemma-3-12b", "glm-4.7"]
ex_idx = next(i for i, r in enumerate(runs["kimi-k2.5"]["rows"]) if "admissions" in r["title"].lower())
ex_title = runs["kimi-k2.5"]["rows"][ex_idx]["title"]
cards = []
for k in EX_MODELS:
    r = runs[k]["rows"][ex_idx]
    sent = "".join(
        f"<span class='{'' if (c['support'] >= .65 and c['translation'] >= .6 and c.get('numbers_ok', True)) else 'drop'}'>{e(c['es'])}</span> "
        for c in r.get("checked", [])
    )
    cards.append(f"<div class='ex'><h4>{e(NAMES[k])}</h4><p>{sent}</p></div>")

page = f"""<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Qué IA usar para los resúmenes de Pipette</title>
<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;700&family=STIX+Two+Text:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root{{--bench:#eef2f0;--glass:#f8faf9;--ink:#14201c;--ink2:#4a5a54;--ink3:#75857f;--line:#d3dcd8;--pink:#c2186b;--soft:#f8e0eb}}
*{{box-sizing:border-box}} body{{margin:0;background:var(--bench);color:var(--ink);font-family:'Atkinson Hyperlegible Next',system-ui,sans-serif;line-height:1.55}}
.wrap{{max-width:1180px;margin:0 auto;padding:40px 20px 80px}}
h1{{font-size:2.2rem;letter-spacing:-.02em;margin:0 0 8px;line-height:1.15}} h2{{font-size:1.35rem;margin:46px 0 12px;letter-spacing:-.01em}} h3{{margin:24px 0 8px;font-size:1.05rem}}
p,li{{max-width:48em}} .lead{{font-size:1.12rem;color:var(--ink2)}} .fine{{font-size:.88rem;color:var(--ink2)}}
.verdict{{background:var(--glass);border:1px solid var(--line);border-left:4px solid var(--pink);border-radius:12px;padding:18px 22px;margin:26px 0}}
.verdict h2{{margin-top:0}}
table{{width:100%;border-collapse:collapse;background:var(--glass);border:1px solid var(--line);border-radius:12px;overflow:hidden;font-size:.92rem}}
th,td{{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}} th{{font-size:.8rem;color:var(--ink2);font-weight:700;background:#e6ecea}}
td.n{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}} tr.fav td{{background:#fff}} .sub{{font-size:.78rem;color:var(--ink3)}}
.tag{{display:inline-block;margin-left:8px;font-size:.72rem;padding:1px 8px;border-radius:999px;background:var(--soft);color:#9d0f53;font-weight:700}}
.bar{{height:5px;background:var(--line);border-radius:3px;margin-top:4px}} .bar i{{display:block;height:100%;background:var(--pink);border-radius:3px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}} .ex{{background:var(--glass);border:1px solid var(--line);border-radius:12px;padding:14px 16px}}
.ex h4{{margin:0 0 6px}} .ex p{{font-size:.93rem;margin:0}} .drop{{text-decoration:line-through;color:var(--ink3)}}
.tbl-wrap{{overflow-x:auto}} code{{font-size:.88em;background:var(--glass);border:1px solid var(--line);padding:1px 5px;border-radius:4px}}
</style></head><body><div class="wrap">
<p class="fine">Pipette · investigación interna · 28 de septiembre de 2026</p>
<h1>Qué IA usar para los resúmenes</h1>
<p class="lead">Probamos 18 modelos con las mismas instrucciones de producción sobre 20 papers reales de 13 campos. Jev verificó cada oración contra el abstract, sumamos un control de números y medimos legibilidad y costo con los precios oficiales.</p>

<div class="verdict">
<h2>Recomendación: Kimi K2.5 por Amazon Bedrock</h2>
<ul>
<li><b>Calidad:</b> 20 de 20 papers con resumen publicable y 87% de oraciones verificadas, en el grupo de punta junto a Llama 4 Maverick y Claude Sonnet 5.</li>
<li><b>Claridad:</b> explica sin perder datos concretos y es de los que menos siglas deja sin explicar. El castellano es natural.</li>
<li><b>Costo:</b> alrededor de US$ 1 por mes con los precios oficiales de AWS.</li>
<li><b>Operación:</b> corre dentro de la misma cuenta de AWS que ya usa Pipette. No hay cuentas ni keys nuevas: la Lambda se autentica con su rol. Los datos no salen de AWS hacia el proveedor del modelo.</li>
<li><b>Respaldo:</b> si Kimi falla un día, Llama 4 Maverick (95% de oraciones verificadas, US$ 0,25 por mes) toma el lugar automáticamente.</li>
</ul>
<p class="fine">Claude Sonnet 5 escribe muy bien, pero no salió mejor en las métricas, cuesta unas cinco veces más y requiere una cuenta y una key de Anthropic, porque Bedrock no lo tiene habilitado para esta cuenta.</p>
</div>

<h2>Resultados</h2>
<div class="tbl-wrap"><table>
<thead><tr><th>Modelo</th><th>Dónde corre</th><th>Publicables</th><th>Oraciones verificadas</th><th>Legibilidad</th><th>Siglas por oración</th><th>Palabras por oración</th><th>Latencia</th><th>Costo por mes</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<ul class="fine">
<li><b>Publicables:</b> papers con al menos dos oraciones que pasaron todos los controles.</li>
<li><b>Oraciones verificadas:</b> porcentaje que pasa los tres controles: respaldo en el abstract según Jev, fidelidad de la traducción según Jev, y números presentes en el abstract.</li>
<li><b>Legibilidad:</b> índice Flesch en inglés, más alto es más fácil. Los abstracts originales promedian 6.</li>
<li><b>Costo:</b> 20 resúmenes por día con los tokens medidos y los precios oficiales on-demand de us-east-1. Claude, con precios de la API de Anthropic.</li>
<li><b>*</b> Claude Sonnet 5 y Haiku 4.5 corrieron a través de Claude Code, que suma su propio prompt de sistema. Eso los pone en desventaja, sobre todo a Haiku, y su latencia no es comparable.</li>
</ul>

<h2>Lo que muestran los ejemplos</h2>
<p>El porcentaje de verificación premia a los modelos que copian el vocabulario del abstract. Por eso leímos los resúmenes:</p>
<ul>
<li><b>Kimi K2.5, Claude Sonnet 5 y Gemma 3 12B</b> explican sin perder datos: dicen qué es un "tipping event" en vez de dejar la sigla.</li>
<li><b>Llama 4 Maverick</b> es el más fiel, pero simplifica menos y escribe menos oraciones (3,8 por paper).</li>
<li><b>Nemotron, Qwen3 Next y gpt-oss</b> dejan siglas técnicas sin explicar (AMOC, ARF, GCMs). Qwen3 Next además escribió "política pública pública".</li>
<li><b>GLM-4.7 y DeepSeek</b> son los más simples, pero pierden precisión.</li>
</ul>
<h3>Un mismo paper, en castellano: “{e(ex_title)}”</h3>
<p class="fine">Tachado: oraciones que no pasaron los controles y no se publicarían.</p>
<div class="grid">{''.join(cards)}</div>

<h2>Opciones que no pudimos probar</h2>
<p>Estas se usan con cuenta y key propias de cada proveedor. Precios oficiales por millón de tokens y costo estimado para nuestro volumen:</p>
<div class="tbl-wrap"><table>
<thead><tr><th>Modelo</th><th>Entrada</th><th>Salida</th><th>Por mes</th><th>Notas</th></tr></thead><tbody>
<tr><td><b>OpenAI gpt-6-luna</b></td><td class="n">0,10</td><td class="n">0,50</td><td class="n">US$ 0,35</td><td>El más barato del mercado. Sin medición pública de alucinación todavía.</td></tr>
<tr><td><b>OpenAI gpt-5.4-nano</b></td><td class="n">0,20</td><td class="n">1,25</td><td class="n">US$ 0,83</td><td>3,1% de alucinación en el ranking de Vectara, el segundo mejor.</td></tr>
<tr><td><b>Google Gemini 3.1 Flash-Lite</b></td><td class="n">0,25</td><td class="n">1,50</td><td class="n">US$ 1,00</td><td>8,2% en Vectara. El plan gratuito usa los datos para entrenar.</td></tr>
<tr><td><b>Mistral Small 4</b></td><td class="n">0,15</td><td class="n">0,60</td><td class="n">US$ 0,45</td><td>Europeo. Sin medición de alucinación.</td></tr>
<tr><td><b>Claude Haiku 4.5</b></td><td class="n">1,00</td><td class="n">5,00</td><td class="n">US$ 3,50</td><td>9,8% en Vectara. AWS anuncia su retiro para octubre de 2026.</td></tr>
<tr><td><b>Claude Sonnet 5</b></td><td class="n">2,00</td><td class="n">10,00</td><td class="n">US$ 5–9</td><td>Su tokenizador cuenta ~30% más tokens.</td></tr>
<tr><td><b>DeepSeek (API directa)</b></td><td class="n">0,15–0,30</td><td class="n">0,60–1,20</td><td class="n">US$ 0,45–0,90</td><td>Descartado: entrena con los datos y los guarda en China. Por Bedrock no aplica.</td></tr>
</tbody></table></div>
<p class="fine">Fuentes: páginas oficiales de precios de cada proveedor y el ranking de alucinación de Vectara (actualizado el 22-09-2026). El ranking mide resúmenes en inglés sin citas, así que no predice directamente nuestro caso.</p>

<h2>Correr un modelo propio</h2>
<p>No conviene con este volumen. Estas son las opciones realistas:</p>
<div class="tbl-wrap"><table>
<thead><tr><th>Opción</th><th>Por mes</th><th>Armado</th><th>Problema principal</th></tr></thead><tbody>
<tr><td>Tu PC (RTX 2060, Qwen3 8B)</td><td class="n">~US$ 0,30 de luz</td><td>2–4 h</td><td>La PC tiene que estar prendida a la hora del lote y compite con tu trabajo.</td></tr>
<tr><td>GPU en AWS solo durante el lote (g4dn, spot)</td><td class="n">~US$ 6–10</td><td>1–2 días</td><td>Cuotas, interrupciones del spot y mantenimiento de la imagen.</td></tr>
<tr><td>GPU serverless (Modal, crédito gratis)</td><td class="n">US$ 0–5</td><td>4–8 h</td><td>Depende de que siga el plan gratuito.</td></tr>
<tr><td>VPS barato con CPU (Hetzner)</td><td class="n">~€2–21</td><td>1 día</td><td>Lento: alrededor de una hora por lote.</td></tr>
<tr><td>Raspberry Pi</td><td class="n">—</td><td>—</td><td>No es viable: solo entran modelos chicos que alucinan más. Además ya tiene problemas de alimentación.</td></tr>
</tbody></table></div>
<p>Los modelos que entran en hardware modesto, como Qwen3 8B o Gemma 3 12B, alucinan algo más que los pagos baratos. Por Bedrock ya estamos usando esos mismos modelos abiertos, pero alojados por AWS, por centavos y sin mantener nada.</p>

<h2>Advertencias</h2>
<ul>
<li>Veinte papers es una muestra chica. Sirve para descartar y elegir, no para afirmar diferencias de uno o dos puntos.</li>
<li>La lectura cualitativa la hizo Claude, que puede tener sesgo a favor de Claude. Por eso la recomendación se apoya en las métricas y los ejemplos están a la vista.</li>
<li>Los controles de producción siguen activos con cualquier modelo: lo que no pasa no se publica.</li>
</ul>

<h2>Cómo se hizo</h2>
<p class="fine">Scripts en <code>qa/summary_bench.py</code> y <code>qa/bench_report.py</code> del repo. Los resultados crudos de cada modelo, con cada oración y sus puntajes, están en <code>qa/bench/</code>. Costo total de la prueba: menos de US$ 1 en Bedrock y centavos en Jev.</p>
</div></body></html>"""
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w", encoding="utf-8").write(page)
print("wrote", os.path.abspath(OUT))
