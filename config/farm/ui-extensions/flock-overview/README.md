# flock-overview — web component source

Build project for the **Daily Flock Briefing** CHT UI Extension. `npm run build`
bundles everything into `../flock-overview.js`, which `cht upload-ui-extensions`
attaches to the extension doc.

```
flock-overview/
├── build.mjs        # esbuild bundler → ../flock-overview.js
├── package.json     # dep: chart.js; build: esbuild
└── src/
    ├── index.js     # the HTMLElement web component (orchestration + rendering)
    ├── config.js    # default config + status palette
    ├── util.js      # pure helpers
    ├── data.js      # loads flock contacts + reports via this.cht datasource
    ├── metrics.js   # deterministic KPIs (mortality, growth, uniformity, attention)
    ├── briefing.js  # buildBriefing(): prioritised focus list from the facts
    ├── charts.js    # Chart.js growth curve + uniformity histogram
    └── styles.js    # shadow-DOM CSS
```

## Build

```sh
cd config/farm/ui-extensions/flock-overview
npm install
npm run build        # writes ../flock-overview.js (committed; cht-conf uploads it)
```

The output (~0.4 MB) carries an `/* eslint-disable */` banner and is git-ignored
from the repo linter — it's a build artifact; never edit it by hand. The webapp
runs it via `new Function('module', code)`; esbuild emits an IIFE and the footer
maps its default export onto `module.exports` (the `FlockOverview` class).

## How it integrates with CHT

This extension is a demonstration of how a UI Extension plugs into the rest of
the CHT app. The integration points it uses:

- **`this.cht.v1` datasource** — reads live app data with no custom backend:
  `contact.getUuidsPageByType()` + `contact.getByUuid()` to list the flock, and
  `report.getUuidsPageByFreetext()` + `report.getByUuid()` to pull each bird's
  weigh-ins and health checks (see `src/data.js`).
- **`this.inputs.config`** — the `config` block from the extension doc
  (`flock-overview.properties.json`) drives contact/form/field names, the target
  growth curve, thresholds, and accent colour — no rebuild needed to retune.
- **`this.inputs.userContactSummary`** — available for personalising to the
  logged-in user (not yet used; an easy next step).
- **Header tab placement** — `extension_type: "header_tab"` makes it a
  top-level tab alongside Messages/Tasks/Reports/Contacts.

Everything is computed deterministically from CHT data and rendered in a shadow
DOM with **Chart.js** (growth curve vs. the Cornish Cross target, weight
uniformity histogram) plus a tappable flock-health grid.

## Today's briefing

`src/briefing.js` `buildBriefing(facts)` turns the computed metrics into a
prioritised, human-readable list of the 1–3 most important things to focus on
today — each with why it matters and a concrete action — ranked by severity
(sick birds > underweight/mortality > uniformity/stale weigh-ins > on-track
summary). Pure function, no network, no model.
