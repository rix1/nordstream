// Shared parsing of the raw NRK scrape (nordstream.html). Used by the main
// page (on its own DOM) and by the about page (on a fetched copy).

const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')

function handleEl(el) {
  const ts = el.previousElementSibling
  const body = el.nextElementSibling
  return {
    ts: ts ? Number(ts.getAttribute('data-timestamp')) : '',
    tsReadable: text(ts),
    headline: text(el),
    body: text(body),
    url: ts.querySelector('a').href
  }
}

// `root` is any Document or Element containing the scraped stream.
export function parseArticles(root) {
  const arr = []
  root.querySelectorAll('.bulletin-title').forEach(el => arr.push(handleEl(el)))
  arr.sort((a, b) => a.ts - b.ts)
  tagEvents(arr)
  return arr
}

// Key events, marked red on the timeline. `match` is a headline substring;
// the first article (chronologically) containing it gets the marker.
export const EVENTS = [
  { match: 'Nord Stream 2-rørledningen ferdig', label: 'NS2 ferdig' },
  { match: 'Tyskland stoppar Nord Stream 2', label: 'NS2 stoppet' },
  { match: 'Gazprom har stoppa gassforsyninga', label: 'NS1 stengt' },
  { match: 'Gasslekkasje nær Nord Stream 2', label: 'Eksplosjonene' },
  { match: 'Tyskland har identifisert båt', label: 'Båtsporet' },
  { match: 'har flykta til Ukraina', label: 'Etterlysning' },
]

function tagEvents(arr) {
  for (const ev of EVENTS) {
    const item = arr.find(a => a.headline.includes(ev.match))
    if (item) item.event = ev.label
    else console.warn('Event not found:', ev.match)
  }
}

export const shortDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
