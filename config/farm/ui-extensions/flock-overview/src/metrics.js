import { has, mean, std, daysBetween, startOfToday, targetWeightAt, pct } from './util.js';

/** Average flock weight bucketed by age (days) — aligns with the target curve. */
function growthSeries(active) {
  const byAge = new Map();
  for (const b of active) {
    for (const w of b.weights) {
      if (!byAge.has(w.ageAt)) { byAge.set(w.ageAt, []); }
      byAge.get(w.ageAt).push(w.g);
    }
  }
  return [...byAge.entries()]
    .map(([day, gs]) => ({ day, g: Math.round(mean(gs)) }))
    .sort((a, b) => a.day - b.day);
}

function averageDailyGain(series) {
  if (series.length < 2) { return 0; }
  const recent = series.slice(-4);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const span = last.day - first.day;
  return span > 0 ? Math.round((last.g - first.g) / span) : 0;
}

function attentionRank(b) {
  return (b.condition === 'sick' ? 100 : 0)
    + (b.condition === 'watch' ? 40 : 0)
    + (b.underweight ? 30 : 0)
    + (b.stale ? 5 : 0);
}

/** Deterministic metrics from the raw flock data. Numbers only — no model. */
export function computeMetrics(birds, cfg) {
  const today = startOfToday();

  const rows = birds.map(({ contact, reports }) => {
    const hatchMs = contact.hatch_date ? new Date(contact.hatch_date).getTime() : today;
    const ageDays = Math.max(0, daysBetween(today, hatchMs));
    // Deceased is driven by the standard CHT date_of_death field; status still
    // distinguishes active vs processed birds.
    const status = has(contact.date_of_death)
      ? 'deceased'
      : (contact.status === 'processed' ? 'processed' : 'active');

    const weights = reports
      .filter((r) => r.form === cfg.weightForm && r.fields && has(r.fields[cfg.weightField]))
      .map((r) => ({
        g: Number(r.fields[cfg.weightField]),
        date: r.reported_date,
        ageAt: Math.max(0, daysBetween(r.reported_date, hatchMs)),
      }))
      .sort((a, b) => a.date - b.date);

    const latestHealth = reports
      .filter((r) => r.form === cfg.healthForm && r.fields)
      .sort((a, b) => b.reported_date - a.reported_date)[0];
    const condition = latestHealth ? latestHealth.fields[cfg.conditionField] : null;

    const latestWeight = weights.length ? weights[weights.length - 1] : null;
    const lastWeighDaysAgo = latestWeight ? daysBetween(today, latestWeight.date) : null;
    const target = targetWeightAt(cfg.targetCurve, ageDays);

    return {
      id: contact._id,
      name: contact.name || contact.patient_id || contact._id.slice(0, 6),
      status,
      ageDays,
      weights,
      latestWeightG: latestWeight ? latestWeight.g : null,
      lastWeighDaysAgo,
      pctOfTarget: latestWeight && target ? latestWeight.g / target : null,
      condition,
      note: latestHealth ? latestHealth.fields[cfg.noteField] : null,
    };
  });

  const active = rows.filter((b) => b.status === 'active');
  const deceased = rows.filter((b) => b.status === 'deceased');
  const processed = rows.filter((b) => b.status === 'processed');
  const flockDay = active.length
    ? Math.max(...active.map((b) => b.ageDays))
    : (rows.length ? Math.max(...rows.map((b) => b.ageDays)) : 0);

  const activeWeights = active.map((b) => b.latestWeightG).filter(has);
  const avgWeightG = Math.round(mean(activeWeights));
  const targetWeightG = targetWeightAt(cfg.targetCurve, flockDay);
  const pctOfTarget = targetWeightG ? avgWeightG / targetWeightG : 0;
  const uniformityCv = avgWeightG ? std(activeWeights) / avgWeightG : 0;

  const growth = growthSeries(active);
  const adgG = averageDailyGain(growth);
  const daysToMarket = adgG > 0
    ? Math.max(0, Math.ceil((cfg.marketWeightG - avgWeightG) / adgG))
    : null;

  const attention = active
    .map((b) => {
      const reasons = [];
      const underweight = has(b.pctOfTarget) && b.pctOfTarget < cfg.underweightThreshold;
      const stale = !has(b.lastWeighDaysAgo) || b.lastWeighDaysAgo >= cfg.staleWeighInDays;
      if (b.condition === 'sick') { reasons.push('Sick'); } else if (b.condition === 'watch') { reasons.push('Watch'); }
      if (underweight) { reasons.push(`${pct(1 - b.pctOfTarget)} under target`); }
      if (stale) { reasons.push(`No weigh-in ${has(b.lastWeighDaysAgo) ? `${b.lastWeighDaysAgo}d` : 'recorded'}`); }
      return { ...b, reasons, underweight, stale };
    })
    .filter((b) => b.reasons.length)
    .sort((a, b) => attentionRank(b) - attentionRank(a));

  const facts = {
    flockDay,
    totalBirds: rows.length,
    alive: active.length,
    deceased: deceased.length,
    processed: processed.length,
    mortalityPct: rows.length ? deceased.length / rows.length : 0,
    avgWeightG,
    targetWeightG,
    pctOfTarget,
    adgG,
    daysToMarket,
    marketWeightG: cfg.marketWeightG,
    uniformityCv,
    staleWeighInDays: cfg.staleWeighInDays,
    attention: attention.map((b) => ({
      name: b.name,
      condition: b.condition,
      underweight: b.underweight,
      stale: b.stale,
      pctOfTarget: b.pctOfTarget,
      weightG: b.latestWeightG,
    })),
  };

  return { rows, active, flockDay, avgWeightG, targetWeightG, pctOfTarget, uniformityCv,
    adgG, daysToMarket, growth, attention, facts };
}
