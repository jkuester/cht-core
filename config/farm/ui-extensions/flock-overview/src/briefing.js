import { kg, pct } from './util.js';

// ---------------------------------------------------------------------------
// Builds the "Today's briefing" from the computed facts: a prioritised list of
// the most important things to focus on today, each with why it matters and a
// concrete action. Pure and deterministic — no model, no network.
// ---------------------------------------------------------------------------
export function buildBriefing(facts) {
  const items = [];
  const names = (list) => list.slice(0, 3).map((b) => b.name).join(', ')
    + (list.length > 3 ? ` +${list.length - 3} more` : '');

  const sick = facts.attention.filter((b) => b.condition === 'sick');
  if (sick.length) {
    items.push({
      severity: 3,
      title: `${sick.length} bird${sick.length > 1 ? 's' : ''} marked sick (${names(sick)})`,
      why: 'Illness can spread quickly through a flock and is the most time-sensitive welfare risk.',
      action: 'Isolate affected birds, inspect closely, and consider reporting to an animal-health worker.',
    });
  }

  const underweight = facts.attention.filter((b) => b.underweight && b.condition !== 'sick');
  if (underweight.length) {
    items.push({
      severity: 2,
      title: `${underweight.length} bird${underweight.length > 1 ? 's' : ''} well under target weight (${names(underweight)})`,
      why: 'Growth lag this far into the cycle usually points to a feed-access or health problem.',
      action: 'Separate and monitor them; check they can reach feeders and water without competition.',
    });
  }

  if (facts.mortalityPct >= 0.08) {
    items.push({
      severity: 2,
      title: `Cumulative mortality at ${pct(facts.mortalityPct)}`,
      why: 'Mortality above ~5–8% is high for broilers and warrants finding the cause.',
      action: 'Review recent losses for a common cause (heat, disease, feed) and tighten biosecurity.',
    });
  }

  if (facts.uniformityCv > 0.12 && facts.alive > 3) {
    items.push({
      severity: 1,
      title: `Flock weights are uneven (CV ${pct(facts.uniformityCv)})`,
      why: 'High spread means smaller birds may be out-competed at the feeder.',
      action: 'Add or space out feeder access; recheck the lightest birds in a few days.',
    });
  }

  const stale = facts.attention.filter((b) => b.stale);
  if (stale.length && items.length < 3) {
    items.push({
      severity: 1,
      title: `${stale.length} bird${stale.length > 1 ? 's' : ''} not weighed in ${facts.staleWeighInDays}+ days`,
      why: 'Without a recent weight you are flying blind on growth and readiness.',
      action: 'Weigh them today to keep the growth picture current.',
    });
  }

  if (!items.length || (items.length < 3 && facts.adgG > 0)) {
    items.push({
      severity: 0,
      title: facts.pctOfTarget >= 0.95
        ? `On track — about ${facts.daysToMarket} days to market weight`
        : `Tracking ${pct(facts.pctOfTarget)} of target weight`,
      why: `Average bird is ${kg(facts.avgWeightG)} kg at day ${facts.flockDay}, gaining ~${facts.adgG} g/day.`,
      action: facts.pctOfTarget >= 0.95
        ? 'Keep feed and water consistent and plan processing logistics.'
        : 'Maintain feed quality; recheck the growth curve in a couple of days.',
    });
  }

  return items.sort((a, b) => b.severity - a.severity).slice(0, 3);
}
