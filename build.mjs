// Render index.html and about.html from articles.json + templates/, and
// assemble the deployable site in dist/.
//
//   deno task build   (or: node build.mjs — Cloudflare Pages runs this)
//
// Posts are prerendered as HTML. Each page also embeds a compact article
// list (id, ts, headline, event) for the timeline rail and the about-page
// visuals, so the browser never parses or fetches the full data.

import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync } from 'node:fs'
import { tagEvents, shortDate, longDate } from './data.js'

const SITE_FILES = ['index.html', 'about.html', 'style.css', 'main.js', 'about.js', 'data.js']

const articles = tagEvents(JSON.parse(readFileSync('articles.json', 'utf8')))
const built = new Date()

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fill = (tpl, vars) => tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m))
const template = name => readFileSync(`templates/${name}`, 'utf8')

// Embedded JSON: `</script` inside a string would end the block early.
const compact = articles.map(({ id, ts, headline, event }) => ({ id, ts, headline, ...(event && { event }) }))
const ARTICLES = JSON.stringify(compact).replace(/<\//g, '<\\/')

const common = {
  ARTICLES,
  built: shortDate.format(built),
}

// --- index.html ------------------------------------------------------------

const POSTS = articles.map((a, i) => `<article class="post" id="p-${i}" data-i="${i}">
<p class="date">${esc(longDate.format(new Date(a.ts)))}</p>
<h2 class="headline"><a href="${esc(a.url)}">${esc(a.headline)}</a></h2>
<div class="body">${a.body} <a class="permalink" href="${esc(a.url)}">[link]</a></div>
</article>`).join('\n\n')

writeFileSync('index.html', fill(template('index.html'), { ...common, POSTS }))

// --- about.html ------------------------------------------------------------

const byYear = new Map()
const byMonth = new Map()
for (const a of articles) {
  const d = new Date(a.ts)
  byYear.set(d.getFullYear(), (byYear.get(d.getFullYear()) || 0) + 1)
  const m = `${d.getFullYear()}-${d.getMonth()}`
  byMonth.set(m, (byMonth.get(m) || 0) + 1)
}
const firstYear = new Date(articles[0].ts).getFullYear()
const lastYear = new Date(articles.at(-1).ts).getFullYear()
const [peakKey, peakCount] = [...byMonth.entries()].sort((a, b) => b[1] - a[1])[0]
const [py, pm] = peakKey.split('-').map(Number)
const monthName = new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric' })

const rows = []
for (let y = firstYear; y <= lastYear; y++) rows.push([y, byYear.get(y) || 0])
const table = `<thead><tr><th>År</th><th>Artikler</th></tr></thead><tbody>${
  rows.map(([y, n]) => `<tr><td>${y}</td><td>${n}</td></tr>`).join('')
}</tbody>`

writeFileSync('about.html', fill(template('about.html'), {
  ...common,
  count: articles.length,
  first: shortDate.format(new Date(articles[0].ts)),
  last: shortDate.format(new Date(articles.at(-1).ts)),
  years: `${firstYear}–${lastYear}`,
  peak: peakCount,
  peakMonth: monthName.format(new Date(py, pm, 1)),
  table,
}))

// --- dist/ -------------------------------------------------------------------

rmSync('dist', { recursive: true, force: true })
mkdirSync('dist')
for (const f of SITE_FILES) copyFileSync(f, `dist/${f}`)

console.log(`built index.html (${articles.length} posts) and about.html → dist/`)
