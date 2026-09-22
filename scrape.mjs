// Re-scrape NRK's "Gassrørledningen Nord Stream" compilation into an HTML
// file with the same structure as the original scrape, so main.js/data.js
// can parse it unchanged.
//
//   node scrape.mjs [out.html]      (default: index.html)
//
// How the NRK page works: the compilation's item list comes from
// /serum/api/content/json/<compilation>, and each item is rendered as an
// HTML fragment by /serum/api/render/<compilation>.<article>.

import { writeFileSync } from 'node:fs'

const COMPILATION = '1.13828304'
const BASE = 'https://www.nrk.no'
const CONCURRENCY = 4
const out = process.argv[2] || 'index.html'

const listRes = await fetch(`${BASE}/serum/api/content/json/${COMPILATION}?v=2&limit=500&context=items`)
if (!listRes.ok) throw new Error(`list: ${listRes.status}`)
const list = await listRes.json()
const relations = list.relations
console.log(`${relations.length} items; newest ${relations[0].created}, oldest ${relations.at(-1).created}`)

const fragments = new Array(relations.length)
let next = 0
async function worker() {
  while (next < relations.length) {
    const i = next++
    const id = relations[i].id
    const url = `${BASE}/serum/api/render/${COMPILATION}.${id}?perspective=BRIEF&size=18`
    let res
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url)
      if (res.ok) break
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
    if (!res.ok) throw new Error(`render ${id}: ${res.status}`)
    // Each fragment ships an inline require() for NRK's realtime updater,
    // which is meaningless (and throws) outside nrk.no.
    fragments[i] = (await res.text()).replace(/<script\b[\s\S]*?<\/script>/g, '')
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${relations.length}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

const items = relations.map((r, i) => `<li class="stream-item relation" id="${r.id}.${r.id}" data-id="${r.id}" data-reference-id="${COMPILATION}.${r.id}" data-perspective="BRIEF">
${fragments[i].trim()}
</li>`).join('\n')

const html = `<!DOCTYPE html>
<html lang="nb">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Nord Stream — tidslinje</title>
    <link rel="stylesheet" href="./style.css">
    <script src="./main.js" type="module"></script>
</head>
<body>
<!-- Scraped ${new Date().toISOString()} from ${BASE}/nyheter/gassrorledningen-nord-stream-${COMPILATION} -->
<div class="container-widget-content compilation-stream">
<ul id="live" class="stream-content relations lp_compilation">
${items}
</ul>
</div>
</body>
</html>
`
writeFileSync(out, html)
console.log(`wrote ${out} (${(html.length / 1024).toFixed(0)} kB)`)
