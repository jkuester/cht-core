import { DEFAULT_CONFIG, STATUS } from './config.js';
import { has, kg, pct, esc } from './util.js';
import { loadFlock } from './data.js';
import { computeMetrics } from './metrics.js';
import { buildBriefing } from './briefing.js';
import { growthChart, uniformityChart } from './charts.js';
import { styles } from './styles.js';

const SEV_ICON = { 3: '⚠️', 2: '🔸', 1: '🔹', 0: '✅' };

export default class FlockOverview extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.charts = [];
    this.selectedId = null;
  }

  async connectedCallback() {
    const userCfg = this.inputs?.config || {};
    this.cfg = {
      ...DEFAULT_CONFIG,
      ...userCfg,
      targetCurve: userCfg.targetCurve || DEFAULT_CONFIG.targetCurve,
    };
    this.renderLoading();
    try {
      this.birds = await loadFlock(this.cht, this.cfg);
      this.recompute();
      this.draw();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('flock-overview: failed to load flock', err);
      this.renderError(err);
    }
  }

  disconnectedCallback() {
    this.destroyCharts();
  }

  destroyCharts() {
    this.charts.forEach((c) => c?.destroy());
    this.charts = [];
  }

  recompute() {
    this.metrics = computeMetrics(this.birds, this.cfg);
    this.briefing = buildBriefing(this.metrics.facts);
  }

  /** (Re)render everything and restore the selected bird, if any. */
  draw() {
    this.destroyCharts();
    this.render();
    this.initCharts();
    this.bindHealthGrid();
    if (this.selectedId && this.metrics.rows.some((r) => r.id === this.selectedId)) {
      this.selectBird(this.selectedId);
    }
  }

  briefingItemsHtml() {
    const items = this.briefing.map((it) => `
      <li class="brief-item sev-${it.severity}">
        <span class="brief-icon">${SEV_ICON[it.severity] || '•'}</span>
        <div>
          <p class="brief-title">${esc(it.title)}</p>
          <p class="brief-why">${esc(it.why)}</p>
          <p class="brief-action"><strong>Do:</strong> ${esc(it.action)}</p>
        </div>
      </li>`).join('');
    return `<ol class="brief-list">${items}</ol>`;
  }

  // --- rendering ---------------------------------------------------------
  render() {
    const m = this.metrics;
    if (!m.rows.length) { return this.renderEmpty(); }
    const onTrack = m.pctOfTarget >= 0.95;

    this.shadowRoot.innerHTML = `
      ${styles(this.cfg.accentColor)}
      <div class="wrap">
        <header class="flock-head">
          <div>
            <div class="eyebrow">My broiler flock · Cornish Cross</div>
            <h1>Day ${m.flockDay}</h1>
          </div>
          <div class="alive-pill ${onTrack ? 'good' : 'warn'}">
            ${m.facts.alive}<span>/${m.facts.totalBirds} alive</span>
          </div>
        </header>

        <section class="card briefing">
          <div class="briefing-head">
            <span class="spark">✨</span>
            <h2>Today's briefing</h2>
          </div>
          ${this.briefingItemsHtml()}
        </section>

        ${this.kpiRow()}

        <section class="grid-2">
          <section class="card"><h2>Growth curve</h2><div class="chart-box"><canvas id="c-growth"></canvas></div></section>
          <section class="card"><h2>Flock health</h2>${this.healthGrid()}</section>
        </section>

        <section class="card">
          <h2>Weight uniformity (today)</h2>
          <div class="chart-box"><canvas id="c-uniformity"></canvas></div>
          <div class="hist-meta">${this.uniformityMeta()}</div>
        </section>

        ${this.attentionCard()}
        <footer class="foot">Updated just now · ${m.facts.alive} active birds tracked</footer>
      </div>`;
  }

  initCharts() {
    const g = this.shadowRoot.getElementById('c-growth');
    const u = this.shadowRoot.getElementById('c-uniformity');
    if (g) { this.charts.push(growthChart(g, this.metrics, this.cfg)); }
    if (u && this.metrics.active.filter((b) => has(b.latestWeightG)).length >= 2) {
      this.charts.push(uniformityChart(u, this.metrics));
    }
  }

  kpiRow() {
    const m = this.metrics;
    const trend = m.pctOfTarget >= 1 ? '▲ ahead' : m.pctOfTarget >= 0.95 ? '▲ on track' : '▼ behind';
    const tiles = [
      { label: 'Alive', value: `${m.facts.alive}/${m.facts.totalBirds}`, sub: pct(1 - m.facts.mortalityPct) },
      { label: 'Avg weight', value: `${kg(m.avgWeightG)} kg`, sub: trend, tone: m.pctOfTarget >= 0.95 ? 'good' : 'warn' },
      { label: 'To market', value: has(m.daysToMarket) ? `~${m.daysToMarket}d` : '—', sub: `${kg(m.facts.marketWeightG)} kg` },
      { label: 'Attention', value: `${m.attention.length}`, sub: m.attention.length ? 'needs review' : 'all clear', tone: m.attention.length ? 'bad' : 'good' },
    ];
    return `<section class="kpis">${tiles.map((t) => `
      <div class="kpi ${t.tone || ''}">
        <div class="kpi-label">${t.label}</div>
        <div class="kpi-value">${t.value}</div>
        <div class="kpi-sub">${t.sub}</div>
      </div>`).join('')}</section>`;
  }

  healthGrid() {
    const cells = this.metrics.rows.map((b) => {
      const s = STATUS[b.status === 'active' ? (b.condition || 'healthy') : b.status] || STATUS.healthy;
      const sub = b.latestWeightG ? `${kg(b.latestWeightG)} kg` : 'no weight';
      return `<button class="bird" data-id="${esc(b.id)}" style="--c:${s.color}"
        title="${esc(b.name)} · ${s.label} · ${sub}" aria-label="${esc(b.name)}"></button>`;
    }).join('');
    const legend = Object.values(STATUS).map((s) => `<span><i class="sw" style="background:${s.color}"></i>${s.label}</span>`).join('');
    return `<div class="bird-grid">${cells}</div>
      <div class="bird-detail" id="bird-detail">Tap a bird for details</div>
      <div class="legend">${legend}</div>`;
  }

  uniformityMeta() {
    const cv = this.metrics.uniformityCv;
    if (!cv) { return 'Not enough weigh-ins yet for a distribution.'; }
    const label = cv < 0.08 ? 'excellent' : cv < 0.1 ? 'good' : cv < 0.12 ? 'fair' : 'uneven';
    return `CV <strong>${pct(cv)}</strong> · ${label} uniformity`;
  }

  attentionCard() {
    if (!this.metrics.attention.length) {
      return `<section class="card"><h2>Needs attention</h2><p class="all-clear">✅ No birds need attention right now.</p></section>`;
    }
    const dot = (b) => (b.condition === 'sick' ? '#E2553B' : (b.underweight || b.condition === 'watch') ? '#E8A33D' : '#9AA0A6');
    const rows = this.metrics.attention.map((b) => `
      <li class="att-item">
        <a class="att-row" href="/#/contacts/${esc(b.id)}" title="Open ${esc(b.name)} in Contacts">
          <span class="att-dot" style="background:${dot(b)}"></span>
          <span class="att-name">${esc(b.name)}</span>
          <span class="att-reasons">${b.reasons.map((r) => `<em>${esc(r)}</em>`).join('')}</span>
          <span class="att-weight">${b.latestWeightG ? `${kg(b.latestWeightG)} kg` : '—'}</span>
          <span class="att-go" aria-hidden="true">›</span>
        </a>
      </li>`).join('');
    return `<section class="card"><h2>Needs attention</h2><ul class="att-list">${rows}</ul></section>`;
  }

  bindHealthGrid() {
    this.shadowRoot.querySelectorAll('.bird').forEach((el) => {
      el.addEventListener('click', () => this.selectBird(el.dataset.id));
    });
  }

  selectBird(id) {
    this.selectedId = id;
    this.editingName = false;
    this.shadowRoot.querySelectorAll('.bird').forEach((c) => c.classList.toggle('sel', c.dataset.id === id));
    this.renderDetail();
  }

  renderDetail() {
    const b = this.metrics.rows.find((r) => r.id === this.selectedId);
    const detail = this.shadowRoot.getElementById('bird-detail');
    if (!b || !detail) { return; }
    detail.innerHTML = this.birdDetailHtml(b);

    const select = detail.querySelector('.bird-status');
    if (select) {
      select.addEventListener('change', () => this.updateBirdStatus(b.id, select.value));
    }

    if (this.editingName) {
      const input = detail.querySelector('.name-input');
      const commit = () => this.saveName(b.id, input.value);
      input.focus();
      input.select();
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); }
      });
      detail.querySelector('.name-save').addEventListener('click', commit);
    } else {
      detail.querySelector('.name-edit').addEventListener('click', () => { this.editingName = true; this.renderDetail(); });
    }
  }

  birdDetailHtml(b) {
    const status = STATUS[b.status === 'active' ? (b.condition || 'healthy') : b.status] || STATUS.healthy;
    const tgt = has(b.pctOfTarget) ? ` · ${pct(b.pctOfTarget)} of target` : '';
    const note = b.note ? ` · “${esc(b.note)}”` : '';
    const nameHtml = this.editingName
      ? `<span class="name-edit-box">
           <input class="name-input" type="text" value="${esc(b.name)}" aria-label="Bird name" />
           <button class="name-save" type="button">Save</button>
           <span class="name-msg" aria-live="polite"></span>
         </span>`
      : `<button class="name-edit" type="button" title="Tap to edit name">${esc(b.name)}</button>`;
    const info = `<div class="bird-info">${nameHtml} · day ${b.ageDays} · `
      + `<span style="color:${status.color}">${status.label}</span> · `
      + `${b.latestWeightG ? `${kg(b.latestWeightG)} kg${tgt}` : 'no weight yet'}${note}</div>`;
    if (b.status !== 'active') {
      return info;
    }
    const current = b.condition || 'healthy';
    const opts = [['healthy', 'Healthy'], ['watch', 'Watch'], ['sick', 'Sick']]
      .map(([v, l]) => `<option value="${v}"${v === current ? ' selected' : ''}>${l}</option>`).join('');
    return `${info}
      <label class="bird-status-label">Set status
        <select class="bird-status">${opts}</select>
        <span class="bird-status-msg" aria-live="polite"></span>
      </label>`;
  }

  async saveName(id, rawName) {
    const name = (rawName || '').trim();
    const msg = this.shadowRoot.querySelector('.name-msg');
    if (!name) {
      // Empty name is invalid for person.update — treat as cancel.
      this.editingName = false;
      this.renderDetail();
      return;
    }
    if (msg) { msg.textContent = 'Saving…'; }
    try {
      const contact = await this.cht.v1.person.getByUuid(id);
      if (!contact) { throw new Error(`contact ${id} not found`); }
      contact.name = name;
      await this.cht.v1.person.update(contact);

      const entry = this.birds.find((bd) => bd.contact._id === id);
      if (entry) { entry.contact.name = name; }
      this.editingName = false;
      this.recompute();
      this.draw();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('flock-overview: failed to save bird name', err);
      if (msg) { msg.textContent = 'Save failed'; }
    }
  }

  async updateBirdStatus(id, value) {
    const select = this.shadowRoot.querySelector('.bird-status');
    const msg = this.shadowRoot.querySelector('.bird-status-msg');
    if (select) { select.disabled = true; }
    if (msg) { msg.textContent = 'Saving…'; }
    try {
      const entry = this.birds.find((bd) => bd.contact._id === id);
      const patientId = entry?.contact?.patient_id || id;
      const reportedDate = Date.now();

      // Record the new status as a fresh health_check report (immutable history);
      // the latest report wins, so changes are auditable and reversible.
      await this.cht.v1.report.create({
        form: this.cfg.healthForm,
        contact: id,
        reported_date: reportedDate,
        fields: { patient_id: patientId, patient_uuid: id, [this.cfg.conditionField]: value },
      });

      // Reflect locally so the latest condition updates without a refetch.
      if (entry) {
        entry.reports.push({
          form: this.cfg.healthForm,
          reported_date: reportedDate,
          fields: { [this.cfg.conditionField]: value },
        });
      }
      this.recompute();
      this.draw();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('flock-overview: failed to record health check', err);
      if (select) { select.disabled = false; }
      if (msg) { msg.textContent = 'Save failed'; }
    }
  }

  // --- states ------------------------------------------------------------
  renderLoading() {
    this.shadowRoot.innerHTML = `${styles(this.cfg.accentColor)}
      <div class="wrap"><div class="card skeleton-hero"></div>
      <div class="kpis">${'<div class="kpi skeleton"></div>'.repeat(4)}</div>
      <div class="card skeleton-block"></div></div>`;
  }

  renderEmpty() {
    this.shadowRoot.innerHTML = `${styles(this.cfg.accentColor)}
      <div class="wrap"><section class="card empty">
        <div class="empty-emoji">🐣</div><h2>No chickens yet</h2>
        <p class="muted">Add <code>${esc(this.cfg.chickenContactType)}</code> contacts and record
        weigh-ins to see your flock briefing.</p>
      </section></div>`;
  }

  renderError(err) {
    this.shadowRoot.innerHTML = `${styles(this.cfg.accentColor)}
      <div class="wrap"><section class="card error">
        <h2>⚠️ Couldn't load the flock</h2>
        <p class="muted">${esc(err?.message || 'Unknown error')}</p>
      </section></div>`;
  }
}
