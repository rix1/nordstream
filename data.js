// Shared parsing of the raw NRK scrape (index.html). Used by the main
// page (on its own DOM) and by the about page (on a fetched copy).

const text = el => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '')

// The <time> element's position in the bulletin has moved between NRK's
// markup versions, so look it up within the article rather than by sibling.
function handleEl(el) {
  const article = el.closest('article') || el.parentElement
  const ts = article.querySelector('time.bulletin-time')
  const body = article.querySelector('.bulletin-text-body')
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

// Key events, marked red on the timeline, keyed by NRK article id (the
// number at the end of the article URL). Ids rather than headline text so
// in-browser translation can't break the matching.
export const EVENTS = [
  { id: '1.15644861', label: 'NS2 ferdig' },     // Nord Stream 2-rørledningen ferdig
  { id: '1.15864723', label: 'NS2 stoppet' },    // Tyskland stoppar Nord Stream 2
  { id: '1.16086107', label: 'NS1 stengt' },     // Gazprom har stoppa gassforsyninga
  { id: '1.16117551', label: 'Eksplosjonene' },  // Gasslekkasje nær Nord Stream 2
  { id: '1.16326249', label: 'Båtsporet' },      // Tyskland har identifisert båt
  { id: '1.17001773', label: 'Etterlysning' },   // Mannen ... har flykta til Ukraina
  { id: '1.17862554', label: 'Erkjennelsen' },   // Ukrainere erkjenner at de sto bak sabotasjeaksjon
]

function tagEvents(arr) {
  for (const ev of EVENTS) {
    // Pathname only: a translation proxy rewrites the host and adds params.
    const item = arr.find(a => new URL(a.url).pathname.endsWith('/' + ev.id))
    if (item) item.event = ev.label
    else console.warn('Event not found:', ev.id)
  }
}

export const shortDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
