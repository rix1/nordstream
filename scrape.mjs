// Scrape NRK's "Gassrørledningen Nord Stream" compilation into articles.json.
//
//   node scrape.mjs            → writes articles.json (oldest first)
//   node build.mjs             → renders index.html and about.html from it
//
// How the NRK page works: the compilation's item list comes from
// /serum/api/content/json/<compilation>, and each item is rendered as an
// HTML fragment by /serum/api/render/<compilation>.<article>.

import { writeFileSync } from 'node:fs'

const COMPILATION = '1.13828304'
const BASE = 'https://www.nrk.no'
const CONCURRENCY = 4
const OUT = 'articles.json'

const listRes = await fetch(`${BASE}/serum/api/content/json/${COMPILATION}?v=2&limit=500&context=items`)
if (!listRes.ok) throw new Error(`list: ${listRes.status}`)
const { relations } = await listRes.json()
console.log(`${relations.length} items; newest ${relations[0].created}, oldest ${relations.at(-1).created}`)

const fragments = new Array(relations.length)
let next = 0
async function worker() {
  while (next < relations.length) {
    const i = next++
    const url = `${BASE}/serum/api/render/${COMPILATION}.${relations[i].id}?perspective=BRIEF&size=18`
    let res
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url)
      if (res.ok) break
      await new Promise(r => setTimeout(r, 500 * (attempt + 1)))
    }
    if (!res.ok) throw new Error(`render ${relations[i].id}: ${res.status}`)
    fragments[i] = await res.text()
    if ((i + 1) % 25 === 0) console.log(`  ${i + 1}/${relations.length}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker))

// --- extraction ------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = s => s
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(parseInt(e[1] === 'x' ? e.slice(2) : e.slice(1), e[1] === 'x' ? 16 : 10))
    return e in ENTITIES ? ENTITIES[e] : m
  })
const plain = html => decode(html.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

// Inner HTML of the first element matching `open`, respecting nested divs.
function innerOf(html, open) {
  const start = html.indexOf(open)
  if (start < 0) return ''
  let i = html.indexOf('>', start) + 1
  let depth = 1
  const re = /<\/?div\b/g
  re.lastIndex = i
  let m
  while ((m = re.exec(html))) {
    depth += m[0] === '<div' ? 1 : -1
    if (depth === 0) return html.slice(i, m.index).trim()
  }
  return ''
}

const articles = relations.map((r, i) => {
  const f = fragments[i]
  const ts = Number(f.match(/data-timestamp="(\d+)"/)?.[1])
  const url = f.match(/<time[^>]*>\s*<a href="([^"]+)"/)?.[1] || `${BASE}/nyheter/${r.id}`
  const headline = plain(f.match(/<h2 class="bulletin-title">([\s\S]*?)<\/h2>/)?.[1] || '')
  const body = innerOf(f, '<div class="bulletin-text-body"')
    .replace(/<script\b[\s\S]*?<\/script>/g, '')
    .replace(/\n\s*\n/g, '\n')
  if (!ts || !headline) console.warn('incomplete item', r.id)
  return { id: r.id, ts, iso: new Date(ts).toISOString(), url, headline, body }
}).sort((a, b) => a.ts - b.ts)

writeFileSync(OUT, JSON.stringify(articles, null, 1) + '\n')
console.log(`wrote ${OUT}: ${articles.length} articles, ${articles[0].iso.slice(0, 10)} → ${articles.at(-1).iso.slice(0, 10)}`)
