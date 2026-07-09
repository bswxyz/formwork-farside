# Outdoor gear template — terrain-reactive weather hero

**Live demo → https://bswxyz.github.io/formwork-farside/** · [How it was built](https://bswxyz.github.io/formwork-farside/guide/)

> A rugged expedition-gear landing whose hero is a single canvas storm that re-tunes itself — snow, dust
> or driven rain — the instant you change terrain, redrawing a line-art tent and its spec sheet with it.

A free, MIT-licensed website template. Good for: **outdoor gear, expedition brands, rugged hardware, field equipment**.
The demo brand ("FARSIDE") is fictional — every word, price and colour is meant to be replaced with yours.

## The signature technique

- One canvas particle field that **interpolates** between three weather regimes (Alpine / Desert / Coastal)
  instead of switching — bound to a real segmented control
- An inline SVG tent-configuration diagram that **redraws itself** with `stroke-dashoffset` on every switch
- Scramble-in eyebrows and readouts, a keyboard-driven numbered pitch walkthrough, flat tier cards
- Delta-timed, DPR-capped motion tuned for a rugged, field-manual feel

## Use this as your own site

This repo is a **template** — everything is plain HTML/CSS/JS with **relative paths**, so it
works under *any* repo name with zero configuration.

1. Click **Use this template → Create a new repository** (top of this page).
   **Name it whatever you like** — `my-site`, `gear-co`, anything.
2. In your new repo: **Settings → Pages → Build and deployment → Deploy from a branch**,
   then pick `main` / `/ (root)` and save. (CLI: see below.)
3. Wait ~1 minute. Your site is live at `https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/`.

<details>
<summary>Prefer the command line?</summary>

```bash
gh repo create my-site --template bswxyz/formwork-farside --public --clone
cd my-site
gh api --method POST /repos/YOUR-USERNAME/my-site/pages \
  -f 'source[branch]=main' -f 'source[path]=/'
```
</details>

No build step, no dependencies to install — edit the files, push, done.
The only external requests are Google Fonts. Drop your photography into `assets/` (see the filenames in `index.html`).

## Customize it

- The weather: regime presets (colour, speed, wind angle, streak, turbulence) live at the top of `main.js`
- Terrain specs: the pole / anchor / tension / vent strings are the `DATA` object in `main.js`
- Pitch steps: text and elapsed-time notes are editable markup in `index.html`
- Accent: one signal orange in `:root` — swap for your brand

The `/guide/` page documents the signature technique in depth (with code) — keep it, rewrite it,
or delete the folder entirely.

## Files

```
index.html        the page
styles.css        all styling (design tokens in :root at the top)
main.js           the weather engine + terrain control + pitch stepper
guide/index.html  how-it-works write-up (optional — yours to keep or delete)
```

## Built-in quality

- Works with JS disabled or a font failure (the first terrain config and all six pitch steps render from HTML/CSS)
- Respects `prefers-reduced-motion`; keyboard focus styles, skip link, tablist + stepper arrow keys throughout
- Canvas feature-detected with a static fallback frame; devicePixelRatio capped at 2; motion paused off screen
- Responsive at phone / tablet / desktop widths; semantic landmarks, one `h1`, real image `alt` text

## Design system

Cold, green-undertoned near-black with a single signal-orange accent — expedition manual meets safety gear.

| Token | Hex | Role |
| --- | --- | --- |
| `--bg` | `#0A0D0C` | Cold near-black background (green undertone) |
| `--panel` | `#121715` | Raised panels / cards |
| `--panel-2` | `#182019` | Segmented-control track, inset wells |
| `--ink` | `#EAF0E8` | Cold-bone primary text |
| `--dim` | `#93A096` | Secondary text |
| `--faint` | `#5C6862` | Coordinates, hairlines, done states |
| `--accent` | `#FF5A1F` | Signal orange — the one accent |
| `--flare` | `#FF8A50` | Hover / highlight lift on the accent |
| `--ember` | `#B33A0E` | Deep accent shadow |
| `--line` | `rgba(234,240,232,.10)` | Hairline dividers & borders |

**Type pairing** — **Anton** for display (compressed uppercase caps that read like stencilled gear labels),
**Chivo** for body (a grotesque with enough weight to stay legible over photography), and **Space Mono** for
eyebrows, GPS coordinates and spec callouts (the instrument-readout voice). The contrast of a heavy condensed
display against a plain mono is what sells the "field manual" feel.

**Signature motion — the weather engine.** A single canvas particle pool interpolates between three regime
presets over ~800 ms rather than switching: Alpine snow streaks with turbulent drift, Desert dust motes with
warm heat-shimmer bands, Coastal driven rain with periodic gust bursts. The pointer nudges the wind vector.
Eyebrows and stat values scramble from random glyphs to final text (a weather-radio static feel), and section
edges carry a 1.2° cut-tarp `clip-path`. All of it honours `prefers-reduced-motion`: one static scatter frame,
final text, instant toggles.

## Demo vs. real

Everything here is a front-end demo. What's **mocked**:

- Fictional products, model numbers and prices (FS-1 / FS-2 / FS-4)
- CTAs are anchor links, not a real cart or checkout
- "Radio the field desk" is a `mailto:` to a placeholder address
- Environment and product stills are AI-generated placeholders, not shot photography or film
- No backend — no inventory, reviews, accounts or dealer network

What a **real build** would add:

- Commerce + fulfillment (cart, checkout, payments, shipping, inventory)
- A CMS for products, specs and the pitch walkthrough content
- Real expedition photography and a hero film loop
- A warranty / repair portal and parts catalog behind auth
- A weather-data API if the route-weather briefings are more than marketing copy

## License & credit

[MIT](LICENSE) — free for personal and commercial use, no attribution required
(a link back is always appreciated). Part of **FORMWORK** — a collection of
27 free website templates: **[the full gallery →](https://bswxyz.github.io/formwork/)**
