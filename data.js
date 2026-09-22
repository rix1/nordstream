// Shared between build.mjs (Node) and the browser scripts. No DOM here.

// Key events, marked red on the timeline, keyed by NRK article id (the
// number at the end of the article URL).
export const EVENTS = [
  { id: '1.15644861', label: 'NS2 ferdig' },     // Nord Stream 2-rørledningen ferdig
  { id: '1.15864723', label: 'NS2 stoppet' },    // Tyskland stoppar Nord Stream 2
  { id: '1.16086107', label: 'NS1 stengt' },     // Gazprom har stoppa gassforsyninga
  { id: '1.16117551', label: 'Eksplosjonene' },  // Gasslekkasje nær Nord Stream 2
  { id: '1.16326249', label: 'Båtsporet' },      // Tyskland har identifisert båt
  { id: '1.17001773', label: 'Etterlysning' },   // Mannen ... har flykta til Ukraina
  { id: '1.17862554', label: 'Erkjennelsen' },   // Ukrainere erkjenner at de sto bak sabotasjeaksjon
]

// Sets `event` on matching articles. Warns about ids that no longer exist.
export function tagEvents(articles) {
  for (const ev of EVENTS) {
    const item = articles.find(a => a.id === ev.id)
    if (item) item.event = ev.label
    else console.warn('Event not found:', ev.id)
  }
  return articles
}

export const shortDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Europe/Oslo' })
export const longDate = new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo' })

// Reads the article list a built page embeds in <script id="articles">.
export function embeddedArticles() {
  return JSON.parse(document.getElementById('articles').textContent)
}
