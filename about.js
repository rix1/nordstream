import { embeddedArticles, shortDate } from './data.js'

// Stats and the table are prerendered by build.mjs; this script draws the
// timeline and the chart, which need viewport measurement and hover.
const arr = embeddedArticles()

// Google Translate proxy link: Google fetches the page itself, so this only
// works once the site is publicly hosted.
document.getElementById('translate').href =
  `https://translate.google.com/translate?sl=no&tl=en&u=${encodeURIComponent(location.href)}`

const byYear = new Map()
for (const a of arr) {
  const y = new Date(a.ts).getFullYear()
  byYear.set(y, (byYear.get(y) || 0) + 1)
}
const firstYear = new Date(arr[0].ts).getFullYear()
const lastYear = new Date(arr[arr.length - 1].ts).getFullYear()

// ---------------------------------------------------------------------------
// Horizontal timeline: time-proportional axis, a rug of all articles, red
// dots for key events with labels pushed apart so they never overlap.
// ---------------------------------------------------------------------------

function buildHline(root) {
  const t0 = new Date(firstYear, 0, 1).getTime()
  const t1 = new Date(lastYear + 1, 0, 1).getTime()
  const fx = t => ((t - t0) / (t1 - t0)) * 100

  root.innerHTML = `
    <div class="hline-axis">
      <div class="hline-rug"></div>
      <div class="hline-years"></div>
      <div class="hline-dots"></div>
    </div>
    <div class="hline-body">
      <svg class="hline-links" aria-hidden="true"></svg>
      <div class="hline-labels"></div>
    </div>
  `
  const rug = root.querySelector('.hline-rug')
  const years = root.querySelector('.hline-years')
  const dots = root.querySelector('.hline-dots')
  const links = root.querySelector('.hline-links')
  const labels = root.querySelector('.hline-labels')

  for (const a of arr) {
    const i = document.createElement('i')
    i.style.left = `${fx(a.ts)}%`
    rug.appendChild(i)
  }
  for (let y = firstYear; y <= lastYear; y++) {
    const s = document.createElement('span')
    s.textContent = y
    s.style.left = `${fx(new Date(y, 0, 1).getTime())}%`
    years.appendChild(s)
  }

  const events = arr.filter(a => a.event)
  const labelEls = events.map(a => {
    const d = document.createElement('a')
    d.className = 'hline-dot'
    d.href = `./index.html#p-${arr.indexOf(a)}`
    d.style.left = `${fx(a.ts)}%`
    d.setAttribute('aria-label', a.headline)
    dots.appendChild(d)

    const l = document.createElement('a')
    l.className = 'hline-label'
    l.href = d.href
    l.innerHTML = `<span class="hline-label-date"></span><span class="hline-label-text"></span>`
    l.firstElementChild.textContent = shortDate.format(new Date(a.ts))
    l.lastElementChild.textContent = a.event
    l.title = a.headline
    labels.appendChild(l)
    return l
  })

  const GAP = 12
  const LINK_H = 36   // px of connector space above the labels
  const ROW_H = 40    // px per label row

  // Desired x = the dot's x. Push right on collision, then pull the tail
  // back left if it overflowed the container.
  function packRow(idx, want, widths, W) {
    const x = {}
    let prev = -Infinity
    for (const i of idx) {
      x[i] = Math.max(want[i], prev + GAP)
      prev = x[i] + widths[i]
    }
    let limit = W
    for (const i of [...idx].reverse()) {
      x[i] = Math.min(x[i], limit - widths[i])
      limit = x[i] - GAP
    }
    return x
  }

  function layout() {
    const W = labels.clientWidth
    const want = events.map(a => (fx(a.ts) / 100) * W)
    const widths = labelEls.map(l => l.offsetWidth)

    // One row if everything fits, otherwise alternate labels over two rows.
    const total = widths.reduce((s, w) => s + w, 0) + GAP * (widths.length - 1)
    const rows = total <= W ? 1 : 2
    const rowOf = i => i % rows
    const x = {}
    for (let r = 0; r < rows; r++) {
      Object.assign(x, packRow(events.map((_, i) => i).filter(i => rowOf(i) === r), want, widths, W))
    }

    labels.style.height = `${rows * ROW_H}px`
    const H = LINK_H + rows * ROW_H
    links.setAttribute('viewBox', `0 0 ${W} ${H}`)
    links.innerHTML = ''
    labelEls.forEach((l, i) => {
      const r = rowOf(i)
      l.style.left = `${Math.max(0, x[i])}px`
      l.style.top = `${r * ROW_H}px`
      // Elbow: down from the dot, across at a per-row height, down to the
      // label. Second-row connectors pass behind first-row labels.
      const mid = LINK_H * (0.4 + 0.35 * r)
      const bottom = LINK_H + r * ROW_H
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'polyline')
      p.setAttribute('points', `${want[i]},0 ${want[i]},${mid} ${x[i] + 1},${mid} ${x[i] + 1},${bottom}`)
      links.appendChild(p)
    })
  }
  layout()
  window.addEventListener('resize', layout)
  document.fonts?.ready.then(layout)
}

// ---------------------------------------------------------------------------
// Articles per year: single-series column chart.
// ---------------------------------------------------------------------------

function buildChart(root) {
  const rows = []
  for (let y = firstYear; y <= lastYear; y++) rows.push({ year: y, count: byYear.get(y) || 0 })
  const max = Math.max(...rows.map(r => r.count))

  // Clean y ticks: step of 50 up to the next multiple above max.
  const step = max > 100 ? 50 : max > 40 ? 20 : 10
  const top = Math.ceil(max / step) * step
  const yTicks = []
  for (let v = 0; v <= top; v += step) yTicks.push(v)

  const W = 640, H = 220
  const padL = 36, padR = 8, padT = 16, padB = 28
  const plotW = W - padL - padR, plotH = H - padT - padB
  const band = plotW / rows.length
  const barW = Math.min(24, band * 0.6)
  const sy = v => padT + plotH - (v / top) * plotH

  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', 'Artikler per år')
  const el = (tag, attrs, parent = svg) => {
    const e = document.createElementNS(ns, tag)
    for (const k in attrs) e.setAttribute(k, attrs[k])
    parent.appendChild(e)
    return e
  }

  for (const v of yTicks) {
    const y = sy(v)
    el('line', { class: 'grid', x1: padL, x2: W - padR, y1: y, y2: y })
    el('text', { class: 'axis', x: padL - 8, y: y + 3, 'text-anchor': 'end' }).textContent = v
  }

  const peak = rows.reduce((a, b) => (b.count > a.count ? b : a))
  rows.forEach((r, i) => {
    const cx = padL + band * (i + 0.5)
    const x = cx - barW / 2
    const y0 = sy(0), y1 = sy(r.count)
    const h = y0 - y1
    const rad = Math.min(4, h)
    // Rounded cap, square at the baseline.
    const d = `M${x},${y0} V${y1 + rad} Q${x},${y1} ${x + rad},${y1} H${x + barW - rad} Q${x + barW},${y1} ${x + barW},${y1 + rad} V${y0} Z`
    const g = el('g', { class: 'bar', tabindex: 0 })
    g.dataset.year = r.year
    g.dataset.count = r.count
    // Hit target: the whole band.
    el('rect', { class: 'hit', x: padL + band * i, y: padT, width: band, height: plotH }, g)
    el('path', { class: 'mark', d }, g)
    el('text', { class: 'axis', x: cx, y: H - 8, 'text-anchor': 'middle' }).textContent = r.year
    if (r === peak) {
      el('text', { class: 'value', x: cx, y: y1 - 6, 'text-anchor': 'middle' }).textContent = r.count
    }
  })
  el('line', { class: 'baseline', x1: padL, x2: W - padR, y1: sy(0), y2: sy(0) })

  root.appendChild(svg)

  const tip = document.createElement('div')
  tip.className = 'chart-tip'
  root.appendChild(tip)
  const show = g => {
    tip.textContent = `${g.dataset.year}: ${g.dataset.count} ${g.dataset.count === '1' ? 'artikkel' : 'artikler'}`
    const r = g.querySelector('.mark').getBoundingClientRect()
    const rr = root.getBoundingClientRect()
    tip.style.left = `${r.left + r.width / 2 - rr.left}px`
    tip.style.top = `${r.top - rr.top}px`
    root.classList.add('has-tip')
    g.classList.add('is-hover')
  }
  const hide = g => { root.classList.remove('has-tip'); g.classList.remove('is-hover') }
  svg.querySelectorAll('.bar').forEach(g => {
    g.addEventListener('pointerenter', () => show(g))
    g.addEventListener('pointerleave', () => hide(g))
    g.addEventListener('focus', () => show(g))
    g.addEventListener('blur', () => hide(g))
  })

}

buildHline(document.getElementById('hline'))
buildChart(document.getElementById('chart'))
