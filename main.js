function handleEl(el) {
  const ts = el.previousElementSibling;
  const body = el.nextElementSibling;
  return {
    ts: ts ? Number(ts.getAttribute('data-timestamp')) : '',
    tsReadable: ts.innerText,
    headline: el.innerText,
    body: body ? body.innerText : '',
    url: ts.querySelector('a').href
  }
}

const titles = document.querySelectorAll('.bulletin-title')

const arr = [];
titles.forEach(el => arr.push(handleEl(el)))
arr.sort((a, b) => a.ts - b.ts)

const body = document.body

function replaceBody() {
  body.innerHTML = ''
  const main = document.createElement('main')
  main.className = 'posts'
  arr.forEach((el, i) => {
    const div = document.createElement('div')
    div.innerHTML = `
      <article class="post" id="p-${i}" data-i="${i}">
      <p class="date">${el.tsReadable}</p>
      <h2 class="headline">${el.headline}</h2>
      <p class="body">${el.body} <a href=${el.url}>[link]</a></p>
      </article>
      `
    main.appendChild(div.firstElementChild)
  })
  body.appendChild(main)
}

// ---------------------------------------------------------------------------
// Timeline rail: one tick per article, magnified around the cursor.
// ---------------------------------------------------------------------------

const shortDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })

function buildRail() {
  const n = arr.length
  const rail = document.createElement('nav')
  rail.className = 'rail'
  rail.setAttribute('aria-label', 'Tidslinje')

  const ticks = document.createElement('div')
  ticks.className = 'rail-ticks'

  // Ticks are spaced by index, not by time: time-proportional spacing would
  // cram 90 articles from Sept 2022 into a few pixels. Year labels sit where
  // the year changes, so the density still reads off the label spacing.
  const pct = i => (n === 1 ? 50 : (i / (n - 1)) * 100)
  let lastYear = null
  arr.forEach((el, i) => {
    const a = document.createElement('a')
    a.className = 'tick'
    a.href = `#p-${i}`
    a.style.top = `${pct(i)}%`
    a.setAttribute('aria-label', el.headline)
    ticks.appendChild(a)

    const year = new Date(el.ts).getFullYear()
    if (year !== lastYear) {
      const y = document.createElement('span')
      y.className = 'rail-year'
      y.textContent = year
      y.dataset.i = i
      ticks.appendChild(y)
      lastYear = year
    }
  })

  // Sparse years (2016–2019 have one article each) would land 3px apart, so
  // year labels are positioned in px with a minimum gap rather than in %.
  const YEAR_GAP = 13
  const yearEls = Array.from(ticks.querySelectorAll('.rail-year'))
  function layoutYears() {
    const h = ticks.getBoundingClientRect().height
    let prev = -Infinity
    for (const y of yearEls) {
      const want = (pct(Number(y.dataset.i)) / 100) * h
      const top = Math.max(want, prev + YEAR_GAP)
      y.style.top = `${top}px`
      prev = top
    }
  }
  window.addEventListener('resize', layoutYears)
  requestAnimationFrame(layoutYears)

  const label = document.createElement('div')
  label.className = 'rail-label'
  label.innerHTML = `<span class="rail-label-date"></span><span class="rail-label-title"></span>`

  rail.appendChild(ticks)
  rail.appendChild(label)
  body.appendChild(rail)

  attachMagnifier(rail, ticks, label)
  attachViewport(ticks)
}

function attachMagnifier(rail, ticks, label) {
  const tickEls = Array.from(ticks.querySelectorAll('.tick'))
  const n = tickEls.length
  const labelDate = label.querySelector('.rail-label-date')
  const labelTitle = label.querySelector('.rail-label-title')

  const SIGMA = 28      // px: radius of the magnifying lens
  const GROW = 2.6      // max extra scaleX at the cursor
  const SPREAD = 5      // px: how far neighbours are pushed apart
  const EASE = 0.28     // lerp factor per frame

  const LABEL_EASE = 0.35
  const HIDE_GRACE = 120 // ms before the label hides after leaving the rail

  const centers = new Float32Array(n)
  const cur = new Float32Array(n).fill(1)   // current scaleX per tick
  const curY = new Float32Array(n)          // current translateY per tick
  let cursorY = null
  let nearest = -1
  let raf = 0
  let labelY = 0, labelTargetY = 0
  let anchor = null      // last pointer position over the tick column
  let hideTimer = 0

  function measure() {
    const r = ticks.getBoundingClientRect()
    for (let i = 0; i < n; i++) {
      centers[i] = r.top + (n === 1 ? r.height / 2 : (i / (n - 1)) * r.height)
    }
  }

  function frame() {
    let moving = false
    const ly = labelY + (labelTargetY - labelY) * LABEL_EASE
    if (Math.abs(ly - labelY) > 0.05) moving = true
    labelY = ly
    label.style.transform = `translate3d(0, ${ly.toFixed(2)}px, 0) translateY(-50%)`
    for (let i = 0; i < n; i++) {
      let ts = 1, ty = 0
      if (cursorY !== null) {
        const d = centers[i] - cursorY
        const g = Math.exp(-(d * d) / (2 * SIGMA * SIGMA))
        ts = 1 + GROW * g
        ty = Math.sign(d) * SPREAD * g
      }
      const ns = cur[i] + (ts - cur[i]) * EASE
      const ny = curY[i] + (ty - curY[i]) * EASE
      if (Math.abs(ns - cur[i]) > 0.002 || Math.abs(ny - curY[i]) > 0.05) moving = true
      cur[i] = ns
      curY[i] = ny
      const el = tickEls[i]
      el.style.transform = `translateY(${ny.toFixed(2)}px) scaleX(${ns.toFixed(3)})`
      el.style.opacity = (0.35 + 0.65 * ((ns - 1) / GROW)).toFixed(3)
    }
    if (moving) raf = requestAnimationFrame(frame)
    else raf = 0
  }

  function kick() {
    if (!raf) raf = requestAnimationFrame(frame)
  }

  function pickNearest(y) {
    // Ticks are evenly spaced, so the nearest index is a direct computation.
    const r = ticks.getBoundingClientRect()
    const t = (y - r.top) / r.height
    const i = Math.round(Math.min(1, Math.max(0, t)) * (n - 1))
    if (i !== nearest) {
      if (nearest >= 0) tickEls[nearest].classList.remove('is-near')
      nearest = i
      tickEls[i].classList.add('is-near')
      const item = arr[i]
      labelDate.textContent = shortDate.format(new Date(item.ts))
      labelTitle.textContent = item.headline
    }
    labelTargetY = centers[i] - rail.getBoundingClientRect().top
    // First show: snap instead of gliding in from wherever it last was.
    if (!rail.classList.contains('is-hover')) labelY = labelTargetY
  }

  // "Safe triangle": the polygon spanned by the pointer's last position over
  // the tick column and the label's corners. While the pointer is inside it,
  // it's on its way to the label, so the current article stays put.
  function inSafeArea(x, y) {
    if (!anchor) return false
    const r = label.getBoundingClientRect()
    if (x < anchor.x || r.width === 0) return false
    const poly = [anchor, { x: r.left, y: r.top }, { x: r.right, y: r.top },
                  { x: r.right, y: r.bottom }, { x: r.left, y: r.bottom }]
    let inside = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const a = poly[i], b = poly[j]
      if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
    }
    return inside
  }

  rail.addEventListener('pointerenter', () => {
    clearTimeout(hideTimer)
    measure()
  })
  rail.addEventListener('pointermove', e => {
    const x = e.clientX, y = e.clientY
    const overLabel = label.contains(e.target)
    if (overLabel || inSafeArea(x, y)) {
      // Heading for (or on) the label: freeze the lens on the chosen tick.
      cursorY = centers[nearest]
    } else {
      cursorY = y
      pickNearest(y)
      anchor = { x, y }
    }
    rail.classList.add('is-hover')
    kick()
  })
  // Ticks are 1px tall, so clicking anywhere on the rail (including the
  // label) navigates to the article the label is currently showing.
  rail.addEventListener('click', e => {
    if (nearest < 0) return
    e.preventDefault()
    const post = document.getElementById(`p-${nearest}`)
    if (!post) return
    history.replaceState(null, '', `#p-${nearest}`)
    post.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
  rail.addEventListener('pointerleave', () => {
    cursorY = null
    anchor = null
    kick()
    // Short grace so brushing past the edge doesn't flicker the label.
    hideTimer = setTimeout(() => {
      rail.classList.remove('is-hover')
      if (nearest >= 0) tickEls[nearest].classList.remove('is-near')
      nearest = -1
    }, HIDE_GRACE)
  })
  window.addEventListener('resize', measure)
  measure()
}

// Minimap-style viewport window (à la Sublime): a translucent box over the
// ticks spanning whatever is currently on screen, plus the tick at the
// reading line highlighted.
function attachViewport(ticks) {
  const tickEls = Array.from(ticks.querySelectorAll('.tick'))
  const posts = Array.from(document.querySelectorAll('.post'))
  const n = posts.length
  const win = document.createElement('div')
  win.className = 'rail-viewport'
  ticks.appendChild(win)

  const tops = new Float64Array(n + 1) // document y of each post; [n] = end
  let active = -1
  let raf = 0

  function measure() {
    for (let i = 0; i < n; i++) tops[i] = posts[i].offsetTop
    const last = posts[n - 1]
    tops[n] = last.offsetTop + last.offsetHeight
  }

  // Document y → fractional article index (e.g. 12.4 = 40% into article 12).
  function indexAt(y) {
    if (y <= tops[0]) return 0
    if (y >= tops[n]) return n - 1
    let lo = 0, hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (tops[mid] <= y) lo = mid; else hi = mid - 1
    }
    const span = tops[lo + 1] - tops[lo]
    return lo + (span > 0 ? (y - tops[lo]) / span : 0)
  }

  function update() {
    raf = 0
    const h = ticks.getBoundingClientRect().height
    const toPx = idx => (n === 1 ? h / 2 : (idx / (n - 1)) * h)
    const top = toPx(indexAt(scrollY))
    const bottom = toPx(indexAt(scrollY + innerHeight))
    win.style.transform = `translateY(${top.toFixed(2)}px)`
    win.style.height = `${Math.max(2, bottom - top).toFixed(2)}px`

    // Reading line: the article a bit below the top edge of the viewport.
    const i = Math.floor(indexAt(scrollY + innerHeight * 0.2))
    if (i !== active) {
      if (active >= 0) tickEls[active].classList.remove('is-active')
      active = i
      tickEls[i].classList.add('is-active')
    }
  }

  const schedule = () => { if (!raf) raf = requestAnimationFrame(update) }
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', () => { measure(); schedule() })
  // Fonts loading shifts layout; re-measure once they're in.
  document.fonts?.ready.then(() => { measure(); schedule() })
  measure()
  update()
}

replaceBody()
buildRail()
