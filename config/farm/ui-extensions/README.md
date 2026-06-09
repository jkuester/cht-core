# Flock Overview — UI Extension (demo)

A `header_tab` UI Extension that gives a meat-chicken keeper an at-a-glance
**Daily Flock Briefing**: the most important things to focus on today, why they
matter, and what to do — synthesized from the structured data already recorded
for each bird. It runs **offline on Android** inside the CHT webapp.

## Files

| Path | What it is |
| ---- | ---------- |
| `flock-overview.properties.json` | The extension doc properties (type, title, icon, accent, `config`). |
| `flock-overview.js` | **Generated build artifact** — the bundled web component that cht-conf attaches. Do not edit by hand. |
| `flock-overview/` | The web-component **source project** (Chart.js + on-device LLM); its `npm run build` emits `flock-overview.js`. See [`flock-overview/README.md`](./flock-overview/README.md). |

To rebuild after editing the source:

```sh
cd flock-overview && npm install && npm run build   # writes ../flock-overview.js
```

## Data model

Every bird is a **contact**; every observation is a **report** about that bird.
All birds are assumed **Cornish Cross** (no breed field — the target growth
curve is fixed in `config.targetCurve`). The authoritative field-by-field spec
lives in [`../README.md`](../README.md); in brief:

- **chicken contact** — `name`, `patient_id`, `hatch_date`, `status`
  (`active` \| `processed`), and `date_of_death` (present ⇒ deceased); queried by
  `contact_type: chicken`.
- **`weight_check` report** — `fields.weight_g` (+ `reported_date`).
- **`health_check` report** — `fields.condition` (`healthy` \| `watch` \|
  `sick`) and optional `fields.note`.

All field/form names are configurable in `flock-overview.properties.json`.

## What is computed vs. generated

Everything numeric is computed **deterministically in JS** (exact — no model):
birds alive/total, mortality %, average weight, weight vs. the Cornish Cross
target for the flock's age, average daily gain, projected days-to-market, flock
uniformity (CV%), and the "needs attention" set. These render instantly and are
visualized with **Chart.js** (growth curve + uniformity histogram) plus a
shadow-DOM health grid.

The **"Today's briefing"** turns those computed metrics into a prioritised,
human-readable list of the 1–3 most important things to focus on today — each
with why it matters and a concrete action. It's a pure deterministic function
(`buildBriefing` in `flock-overview/src/briefing.js`); no model, no network.

The point of this extension is to demonstrate **how a UI Extension integrates
with the rest of the CHT app** — reading live contacts and reports through the
`this.cht.v1` datasource, driven by config from the extension doc, surfaced as a
header tab. See [`flock-overview/README.md`](./flock-overview/README.md) for the
integration points.
