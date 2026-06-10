#!/usr/bin/env node
/*
 * Generates the demo seed dataset for the `flock-overview` UI Extension.
 *
 *   node config/farm/gen-flock-seed.js            # writes ./json_docs/<_id>.doc.json
 *   node config/farm/gen-flock-seed.js path/to/dir  # writes to a custom directory
 *
 * Output: one doc per file (named <_id>.doc.json, the format `cht upload-docs`
 * expects) — a farm/farmer/flock hierarchy, 20 `chicken` contacts (18 active,
 * 2 deceased) and their weight_check / health_check reports. Deterministic
 * (seeded PRNG) so re-running produces identical files.
 *
 * The batch is hatched on HATCH_DATE; since that date is fixed, the flock
 * "ages" in real time. Bump HATCH_DATE to ~28 days before your demo to keep the
 * numbers tracking the Cornish Cross target curve.
 *
 * Replace FACILITY with the _id of the place your offline user replicates under
 * (or edit it after generation) so the docs sync to the device.
 */
const fs = require('fs');
const path = require('path');

const DAY = 86400000;
const HATCH_DATE = '2026-05-11'; // batch hatch date (UTC midnight) → ~day 28 on 2026-06-08
const FACILITY = 'farm-greenfield'; // ← the place your offline user replicates
const OUT_DIR = process.argv[2] || path.join(__dirname, 'json_docs');

const day0 = Date.parse(HATCH_DATE);
const at = (d) => day0 + d * DAY;

// deterministic PRNG (Park-Miller) so re-running produces an identical file
let seed = 1337;
const rng = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
const jitter = (v, pct) => Math.round(v * (1 + (rng() * 2 - 1) * pct));

const refCurve = { 0: 43, 7: 180, 14: 460, 21: 930, 28: 1500 };
const ACTIVE_WEIGH_DAYS = [0, 7, 14, 21, 28];

// [tag, day-28 weight (g), latest health condition]
const ACTIVE = [
  ['01', 1480, 'healthy'], ['02', 1520, 'healthy'], ['03', 1560, 'healthy'],
  ['04', 1610, 'healthy'], ['05', 1450, 'healthy'], ['06', 1540, 'healthy'],
  ['07', 1500, 'healthy'], ['08', 1620, 'healthy'], ['09', 1470, 'healthy'],
  ['10', 1580, 'healthy'], ['11', 1260, 'healthy'], ['12', 1550, 'healthy'],
  ['13', 1490, 'healthy'], ['14', 1180, 'sick'],    ['15', 1380, 'watch'],
  ['16', 1510, 'healthy'], ['17', 1300, 'watch'],   ['18', 1560, 'healthy'],
];

// [tag, day of death, last weigh-in day, condition before death]
const DECEASED = [
  ['19', 18, 14, 'sick'],
  ['20', 23, 21, 'sick'],
];

const docs = [];

// --- the flock place (chickens hang off this) ------------------------------
docs.push({
  _id: 'farm-greenfield',
  type: 'contact',
  contact_type: 'farm',
  name: 'Greenfield Farm',
  reported_date: at(0),
});
docs.push({
  _id: 'farmer-macdonald',
  type: 'contact',
  contact_type: 'farmer',
  name: 'Kernel Sanders',
  parent: { _id: FACILITY },
  reported_date: at(0),
});

// --- the flock place (chickens hang off this) ------------------------------
docs.push({
  _id: 'flock-broiler',
  type: 'contact',
  contact_type: 'flock',
  name: 'Broiler Flock',
  parent: { _id: FACILITY },
  reported_date: at(0),
});

const chickenParent = { _id: 'flock-broiler', parent: { _id: FACILITY } };
const submitter = { _id: 'farmer-macdonald', parent: { _id: FACILITY } };

const weightReport = (id, uuid, day, grams) => ({
  _id: `r-w-${id}-d${day}`,
  type: 'data_record',
  form: 'weight_check',
  content_type: 'xml',
  reported_date: at(day),
  contact: submitter,
  fields: { patient_id: id, patient_uuid: uuid, weight_g: grams },
});

const healthReport = (id, uuid, day, condition, note) => ({
  _id: `r-h-${id}-d${day}`,
  type: 'data_record',
  form: 'health_check',
  content_type: 'xml',
  reported_date: at(day),
  contact: submitter,
  fields: { patient_id: id, patient_uuid: uuid, condition, ...(note ? { note } : {}) },
});

const NOTES = { sick: 'lethargic, not eating', watch: 'mild sneezing' };

// --- active birds ----------------------------------------------------------
for (const [tag, finalG, condition] of ACTIVE) {
  const id = `chick-${tag}`;
  docs.push({
    _id: id,
    type: 'contact',
    contact_type: 'chicken',
    name: `Band ${tag}`,
    patient_id: id,
    hatch_date: HATCH_DATE,
    status: 'active',
    parent: chickenParent,
    reported_date: at(0),
  });

  const factor = finalG / refCurve[28];
  let prev = 0;
  for (const day of ACTIVE_WEIGH_DAYS) {
    const g = day === 28 ? finalG : Math.max(prev + 8, jitter(refCurve[day] * factor, 0.04));
    prev = g;
    docs.push(weightReport(id, id, day, g));
  }
  docs.push(healthReport(id, id, 28, condition, NOTES[condition]));
}

// --- deceased birds --------------------------------------------------------
for (const [tag, deathDay, lastWeighDay, condition] of DECEASED) {
  const id = `chick-${tag}`;
  docs.push({
    _id: id,
    type: 'contact',
    contact_type: 'chicken',
    name: `Band ${tag}`,
    patient_id: id,
    hatch_date: HATCH_DATE,
    date_of_death: new Date(at(deathDay)).toISOString().slice(0, 10),
    parent: chickenParent,
    reported_date: at(0),
  });

  let prev = 0;
  for (const day of [0, 7, 14, 21].filter((d) => d <= lastWeighDay)) {
    const g = Math.max(prev + 8, jitter(refCurve[day] * 0.82, 0.05));
    prev = g;
    docs.push(weightReport(id, id, day, g));
  }
  docs.push(healthReport(id, id, Math.min(deathDay, lastWeighDay), condition, NOTES[condition]));
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const doc of docs) {
  fs.writeFileSync(path.join(OUT_DIR, `${doc._id}.doc.json`), `${JSON.stringify(doc, null, 2)}\n`);
}
const counts = docs.reduce((m, d) => { const k = d.contact_type || d.form; m[k] = (m[k] || 0) + 1; return m; }, {});
// eslint-disable-next-line no-console
console.log(`Wrote ${docs.length} docs to ${OUT_DIR}:`, counts);
