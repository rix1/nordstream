# Nord Stream, in one place

**Live: [nordstream.rix1.dev](https://nordstream.rix1.dev)**

Every bulletin NRK has published in its *Gassrørledningen Nord Stream* feed —
263 of them, from August 2016 to today — on one scrollable page, with a
timeline in the margin that shows the shape of the story.

## Why

Hybrid warfare is designed to be hard to follow. A pipeline is finished, then
halted; gas is cut off; something explodes on the seabed; leaks reach the
press; suspects are named, then contradicted. Each of these arrives as a small
news item, weeks or years apart, and the thread between them is easy to lose.
That is not an accident — it is the point.

This is an attempt at the opposite: the record, in chronological order,
arranged so the pattern is visible. Nothing here is analysis.

The site is in Norwegian, like the source material. There's a "Translate to
English" link that runs it through Google Translate.

## What's on the page

- **Timeline rail** — one tick per article, stacked in the left margin. Hover
  to magnify (dock-style) and read the headline; click to jump. Year labels
  sit where the year changes, so the density of September 2022 is visible at
  a glance. A minimap-style window tracks what's on screen.
- **Red markers** — a handful of key moments (pipeline completed, halted, gas
  cut off, the explosions, the boat lead, the arrest warrant, the admission).
- **About page** — motivation, a time-proportional axis with every article as
  a tick, and a bar chart of articles per year.

## How it works

```
node scrape.mjs   →  articles.json         (NRK's serum API → structured JSON)
node build.mjs    →  index.html, about.html (prerendered from templates/)
```

`npm run update` runs both. There are no dependencies and no build tooling —
the output is static HTML with two small ES modules for the interactive bits.

- `scrape.mjs` fetches the compilation's item list from
  `/serum/api/content/json/<id>` and each bulletin as an HTML fragment from
  `/serum/api/render/<compilation>.<article>`, then extracts headline, body,
  timestamp and URL.
- `articles.json` is committed, so `git diff` after an update shows exactly
  which articles are new.
- `build.mjs` renders the posts and stats into the templates and embeds a
  compact article list (`id`, `ts`, `headline`, `event`) that the client
  scripts read — the browser never parses or fetches the full data.
- `data.js` holds the list of key events (by NRK article id) and is shared
  between the build and the browser.

To add a red marker, add an `{ id, label }` entry to `EVENTS` in `data.js`
and rebuild.

## Running locally

```sh
npm run serve      # http://127.0.0.1:3000
```

Any static server works; the pages use ES modules, so they won't load over
`file://`.

## Deployment

Cloudflare Pages, connected to this repo. No build command; the repo root is
the output directory, since the built pages are committed.

## Data and copyright

The articles are © NRK and are reproduced here for personal, non-commercial
reference. Every bulletin links back to the original on nrk.no. Source feed:
[Gassrørledningen Nord Stream](https://www.nrk.no/nyheter/gassrorledningen-nord-stream-1.13828304).

The code is MIT licensed.
