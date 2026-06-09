# Farm config — data model

This configuration project demonstrates a CHT **UI Extension** for meat-chicken
keepers: the [`flock-overview`](./ui-extensions/) `header_tab` extension renders
a "Daily Flock Briefing" from the structured data recorded for each bird.

This document is the authoritative spec of the data the extension reads.
Everything marked *configurable* can be renamed in
[`ui-extensions/flock-overview.properties.json`](./ui-extensions/flock-overview.properties.json)
under `config`; the values shown are the defaults.

## Chicken contact

Each bird is one contact, found by querying `contact_type: "chicken"`
(configurable via `config.chickenContactType`). All birds are assumed to be
**Cornish Cross** broilers, so there is no breed field — the target growth curve
is fixed in `config.targetCurve`. Fields read off each contact doc:

| Field        | Type                                     | Required?       | Default if missing                         | How it's used                                                                 |
| ------------ | ---------------------------------------- | --------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| `_id`        | string                                   | always present  | —                                          | Identity; fallback for name and for the report lookup key                     |
| `name`       | string                                   | recommended     | falls back to `patient_id`, then `_id`     | Display label on the health grid, attention list, bird detail                 |
| `patient_id` | string                                   | recommended     | falls back to `_id`                        | **Freetext key used to find this bird's reports** (see note below)            |
| `hatch_date` | ISO date string (`"2026-05-11"`)         | recommended     | today (→ age 0)                            | Age in days → drives target-weight-for-age, growth curve, flock "Day N"       |
| `date_of_death` | ISO date string (`"2026-05-29"`)      | when deceased   | absent (→ alive)                           | **Presence ⇒ the bird is deceased** (standard CHT field). Drives mortality %; deceased birds are excluded from weight/attention metrics |
| `status`     | `"active"` \| `"processed"`              | optional        | `"active"`                                 | Distinguishes active vs processed (sent to slaughter); health-grid color. *Deceased is determined by `date_of_death`, not this field.* |

> `contact_type` itself isn't *read* from the doc — it's the query filter. The
> contacts can be modeled as person-type custom contacts under a flock/farm
> place.

## Reports

The extension fetches **all reports linked to each bird** (via
`report.getUuidsPageByFreetext(patient_id)`), then filters them by `form`. It
reads two form types. On **every** report it reads `form` and `reported_date`;
the per-form fields are below.

### `weight_check`  *(configurable: `config.weightForm`)*

| Field             | Type                       | Required? | Used for                                                                   |
| ----------------- | -------------------------- | --------- | -------------------------------------------------------------------------- |
| `reported_date`   | timestamp (CHT-standard)   | yes       | When the bird was weighed → its age at weighing → growth-curve buckets      |
| `fields.weight_g` | number (grams)             | yes       | Latest weight per bird, flock average, vs-target %, ADG, uniformity, histogram |

`weight_g` is configurable via `config.weightField`. Reports missing this field
are ignored. Multiple per bird over time build the growth curve.

### `health_check`  *(configurable: `config.healthForm`)*

| Field              | Type                                       | Required? | Used for                                                            |
| ------------------ | ------------------------------------------ | --------- | ------------------------------------------------------------------- |
| `reported_date`    | timestamp                                  | yes       | Sorted to find the **latest** health check per bird                 |
| `fields.condition` | `"healthy"` \| `"watch"` \| `"sick"`       | yes       | Health-grid color; "needs attention" severity; briefing priority    |
| `fields.note`      | string                                     | optional  | Shown in the bird-detail line when you tap a bird                   |

`condition` and `note` are configurable via `config.conditionField` /
`config.noteField`. Only the most recent `health_check` per bird matters; older
ones are ignored. A death/cull is recorded by setting the contact's
`date_of_death`.

## How reports are linked to a bird

The lookup is `report.getUuidsPageByFreetext(chicken.patient_id || chicken._id)`
— it relies on the bird's **shortcode being freetext-indexed on the report**,
which is the standard CHT contact↔report linkage. So when you seed data, each
`weight_check` / `health_check` report should be submitted **about the chicken**
(so the report carries that `patient_id`). If your reports link differently,
that one line in `loadFlock()` is the single place to adjust.

## Minimal example docs

```json
// contact
{ "_id": "chick-07", "type": "contact", "contact_type": "chicken",
  "name": "Band 07", "patient_id": "chick-07",
  "hatch_date": "2026-05-11", "status": "active", "parent": { "_id": "<flock-place-id>" } }

// weight_check report (about chick-07)
{ "type": "data_record", "form": "weight_check", "reported_date": 1717804800000,
  "patient_id": "chick-07", "fields": { "weight_g": 1420 } }

// health_check report (about chick-07)
{ "type": "data_record", "form": "health_check", "reported_date": 1717804800000,
  "patient_id": "chick-07", "fields": { "condition": "watch", "note": "mild sneezing" } }
```

That's the complete surface — five contact fields, two form types, three report
fields.

> Forms to capture these reports are **not** included yet — seed the contacts
> and reports directly, or add XLSForms later.
