import {
  Chart, LineController, LineElement, PointElement, BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip,
} from 'chart.js';
import { kg } from './util.js';

Chart.register(
  LineController, LineElement, PointElement, BarController, BarElement,
  LinearScale, CategoryScale, Filler, Tooltip
);

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif";
Chart.defaults.font.family = FONT;
Chart.defaults.color = '#6b756f';

const verticalGradient = (ctx, area, from, to) => {
  if (!area) { return from; }
  const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
  g.addColorStop(0, from);
  g.addColorStop(1, to);
  return g;
};

/** Flock average weight vs. the Cornish Cross target, plotted by age in days. */
export function growthChart(canvas, metrics, cfg) {
  const accent = cfg.accentColor;
  return new Chart(canvas, {
    type: 'line',
    data: {
      datasets: [
        {
          label: 'Target',
          data: cfg.targetCurve.map((p) => ({ x: p.day, y: p.g })),
          borderColor: accent,
          borderDash: [6, 5],
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
        },
        {
          label: 'Your flock',
          data: metrics.growth.map((p) => ({ x: p.day, y: p.g })),
          borderColor: '#3FA66B',
          borderWidth: 3,
          pointRadius: 3,
          pointBackgroundColor: '#3FA66B',
          tension: 0.35,
          fill: true,
          backgroundColor: (c) => verticalGradient(
            c.chart.ctx, c.chart.chartArea, 'rgba(63,166,107,0.22)', 'rgba(63,166,107,0)'
          ),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 900 },
      interaction: { mode: 'nearest', intersect: false },
      plugins: {
        legend: { display: true, position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } },
        tooltip: {
          callbacks: {
            title: (items) => `Day ${items[0].parsed.x}`,
            label: (item) => `${item.dataset.label}: ${kg(item.parsed.y)} kg`,
          },
        },
      },
      scales: {
        x: { type: 'linear', title: { display: true, text: 'Age (days)' }, grid: { display: false } },
        y: {
          title: { display: true, text: 'Weight (kg)' },
          ticks: { callback: (v) => kg(v) },
          grid: { color: 'rgba(0,0,0,0.05)' },
        },
      },
    },
  });
}

/** Distribution of current weights across the active flock. */
export function uniformityChart(canvas, metrics) {
  const weights = metrics.active.map((b) => b.latestWeightG).filter((g) => g !== null && g !== undefined);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const BUCKETS = 9;
  const span = (max - min) || 1;
  const counts = new Array(BUCKETS).fill(0);
  weights.forEach((g) => {
    counts[Math.min(BUCKETS - 1, Math.floor(((g - min) / span) * BUCKETS))]++;
  });
  const labels = counts.map((_, i) => kg(min + (i + 0.5) * (span / BUCKETS)));

  return new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: counts,
        borderRadius: 5,
        backgroundColor: (c) => verticalGradient(
          c.chart.ctx, c.chart.chartArea, '#E8A33D', '#f1c889'
        ),
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700 },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (i) => `~${i[0].label} kg`, label: (i) => `${i.parsed.y} birds` } },
      },
      scales: {
        x: { title: { display: true, text: 'Weight (kg)' }, grid: { display: false } },
        y: { title: { display: true, text: 'Birds' }, ticks: { precision: 0 }, grid: { color: 'rgba(0,0,0,0.05)' } },
      },
    },
  });
}
