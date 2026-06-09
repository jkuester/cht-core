export const styles = (accent) => `<style>
  :host { --accent:${accent}; --ink:#1f2a24; --muted:#6b756f; --line:#e7e9e5;
    --card:#ffffff; --bg:#f6f7f3; --good:#3FA66B; --warn:#E8A33D; --bad:#E2553B;
    display:block; background:var(--bg); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  * { box-sizing:border-box; }
  .wrap { max-width:760px; margin:0 auto; padding:16px 14px 80px; }
  h1 { font-size:1.9rem; margin:.1rem 0 0; letter-spacing:-.02em; }
  h2 { font-size:.95rem; margin:0 0 .7rem; letter-spacing:.01em; }
  .muted { color:var(--muted); }
  .eyebrow { font-size:.72rem; text-transform:uppercase; letter-spacing:.08em; color:var(--muted); font-weight:600; }
  .flock-head { display:flex; align-items:center; justify-content:space-between; margin:4px 2px 16px; }
  .alive-pill { background:var(--card); border:1px solid var(--line); border-radius:14px;
    padding:8px 14px; font-size:1.5rem; font-weight:700; line-height:1; box-shadow:0 1px 2px rgba(0,0,0,.04); }
  .alive-pill span { font-size:.72rem; font-weight:600; color:var(--muted); margin-left:3px; }
  .alive-pill.good { color:var(--good); } .alive-pill.warn { color:var(--warn); }

  .card { background:var(--card); border:1px solid var(--line); border-radius:16px;
    padding:16px; margin-bottom:14px; box-shadow:0 1px 3px rgba(20,30,25,.05);
    animation:rise .45s cubic-bezier(.2,.7,.3,1) both; }
  .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:560px){ .grid-2 { grid-template-columns:1fr; } }
  .chart-box { position:relative; height:200px; }

  .briefing { background:linear-gradient(180deg,#fffaf0,#ffffff); border-color:#f1e2c4; }
  .briefing-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
  .briefing-head h2 { margin:0; flex:1; }
  .spark { font-size:1.1rem; }
  .badge { font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.06em;
    color:#9a6a12; background:#fdeccb; border-radius:999px; padding:3px 8px; white-space:nowrap; }
  .badge.live { color:#15683f; background:#d7f0e2; }
  .brief-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:10px; }
  .brief-item { display:flex; gap:10px; padding:11px 12px; border-radius:12px; background:#fbfbf9; border-left:3px solid var(--line); }
  .brief-item.sev-3 { border-left-color:var(--bad); background:#fdf2f0; }
  .brief-item.sev-2 { border-left-color:var(--warn); background:#fdf8ef; }
  .brief-item.sev-0 { border-left-color:var(--good); background:#f0f8f3; }
  .brief-icon { font-size:1rem; line-height:1.4; }
  .brief-title { font-weight:700; margin:0 0 2px; font-size:.92rem; }
  .brief-why { margin:0 0 3px; font-size:.82rem; color:var(--muted); }
  .brief-action { margin:0; font-size:.82rem; }
  .brief-action strong { color:var(--ink); }

  .ai-prose { font-size:.9rem; line-height:1.5; margin:0; white-space:pre-wrap; }
  .ai-status { display:flex; align-items:center; gap:10px; font-size:.84rem; color:var(--muted); }
  .ai-bar { flex:1; height:6px; background:#eee7d6; border-radius:99px; overflow:hidden; }
  .ai-bar > i { display:block; height:100%; width:0; background:var(--accent); transition:width .3s; }
  .dots::after { content:'…'; animation:dots 1.4s steps(4,end) infinite; }

  .kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
  @media (max-width:560px){ .kpis { grid-template-columns:repeat(2,1fr); } }
  .kpi { background:var(--card); border:1px solid var(--line); border-radius:14px; padding:12px;
    animation:rise .45s cubic-bezier(.2,.7,.3,1) both; }
  .kpi-label { font-size:.7rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); font-weight:600; }
  .kpi-value { font-size:1.5rem; font-weight:750; letter-spacing:-.02em; margin-top:3px; }
  .kpi-sub { font-size:.74rem; color:var(--muted); margin-top:1px; }
  .kpi.good .kpi-sub { color:var(--good); } .kpi.warn .kpi-sub { color:var(--warn); }
  .kpi.bad .kpi-value { color:var(--bad); }

  .bird-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(26px,1fr)); gap:6px; }
  .bird { aspect-ratio:1; border:none; border-radius:7px; background:var(--c); cursor:pointer;
    padding:0; opacity:.92; transition:transform .12s, box-shadow .12s; }
  .bird:hover { transform:scale(1.12); }
  .bird.sel { box-shadow:0 0 0 2px #fff,0 0 0 4px var(--c); transform:scale(1.12); }
  .bird-detail { font-size:.82rem; color:var(--muted); margin:10px 0 2px; min-height:1.2em; }
  .bird-info { font-size:.82rem; color:var(--muted); }
  .name-edit { font:inherit; font-weight:700; color:var(--ink); background:none; border:none; padding:0;
    cursor:pointer; border-bottom:1px dashed var(--muted); }
  .name-edit:hover, .name-edit:focus-visible { color:var(--accent); border-bottom-color:var(--accent); outline:none; }
  .name-edit-box { display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .name-input { font:inherit; font-size:.82rem; padding:3px 7px; border:1px solid var(--line); border-radius:6px;
    background:#fff; color:var(--ink); min-width:120px; }
  .name-save { font:inherit; font-size:.72rem; padding:3px 9px; border:1px solid var(--accent);
    border-radius:6px; background:var(--accent); color:#fff; cursor:pointer; }
  .name-msg { font-size:.72rem; color:var(--muted); }
  .bird-status-label { display:inline-flex; align-items:center; gap:8px; margin-top:8px; font-size:.8rem; color:var(--muted); }
  .bird-status { font:inherit; font-size:.82rem; padding:4px 8px; border:1px solid var(--line); border-radius:8px;
    background:#fff; color:var(--ink); cursor:pointer; }
  .bird-status:disabled { opacity:.6; cursor:default; }
  .bird-status-msg { font-size:.74rem; color:var(--muted); }
  .legend { display:flex; gap:14px; flex-wrap:wrap; font-size:.74rem; color:var(--muted); margin-top:10px; }
  .legend .sw { display:inline-block; width:11px; height:11px; border-radius:3px; margin-right:5px; vertical-align:-1px; }

  .hist-meta { font-size:.8rem; color:var(--muted); margin-top:8px; }
  .att-list { list-style:none; margin:0; padding:0; }
  .att-item { border-bottom:1px solid var(--line); }
  .att-item:last-child { border-bottom:none; }
  .att-row { display:flex; align-items:center; gap:9px; padding:9px 6px; margin:0 -6px; font-size:.86rem;
    text-decoration:none; color:inherit; cursor:pointer; border-radius:9px; transition:background .12s; }
  .att-row:hover, .att-row:focus-visible { background:#faf7f1; outline:none; }
  .att-dot { width:9px; height:9px; border-radius:50%; flex:none; }
  .att-name { font-weight:650; }
  .att-reasons { flex:1; display:flex; gap:6px; flex-wrap:wrap; }
  .att-reasons em { font-style:normal; font-size:.72rem; background:#f1f2ee; color:var(--muted); padding:2px 7px; border-radius:999px; }
  .att-weight { color:var(--muted); font-variant-numeric:tabular-nums; }
  .att-go { color:var(--muted); font-size:1.1rem; line-height:1; margin-left:2px; }
  .all-clear { color:var(--good); margin:0; font-size:.9rem; }

  .empty, .error { text-align:center; padding:34px 16px; }
  .empty-emoji { font-size:2.4rem; } .empty code { background:#f1f2ee; padding:1px 6px; border-radius:5px; }
  .foot { text-align:center; font-size:.72rem; color:var(--muted); margin-top:6px; }

  .skeleton, .skeleton-hero, .skeleton-block { background:linear-gradient(90deg,#eef0ec,#f6f7f3,#eef0ec);
    background-size:200% 100%; animation:shimmer 1.2s infinite; border:1px solid var(--line); }
  .skeleton-hero { height:150px; } .skeleton-block { height:200px; } .kpi.skeleton { height:78px; }

  @keyframes rise { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  @keyframes shimmer { to { background-position:-200% 0; } }
  @keyframes dots { 0%,20%{ content:''; } 40%{ content:'.'; } 60%{ content:'..'; } 80%,100%{ content:'…'; } }
  @media (prefers-reduced-motion:reduce){ *{ animation:none !important; } }
</style>`;
