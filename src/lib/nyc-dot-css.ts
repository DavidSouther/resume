export const NYC_DOT_CSS = `
:root{
  --nd-bg:#fbfaf7;
  --nd-fg:#1a1a1a;
  --nd-muted:#5a5a5a;
  --nd-border:#d8d5cd;
  --nd-card:#ffffff;
  --nd-accent:#0d5c46;
  --nd-warn-bg:#fff4e5;
  --nd-warn-fg:#7a4a00;
  --nd-badge-permit:#0d5c46;
  --nd-badge-api:#0d6c9c;
  --nd-badge-testimony:#8a6d00;
  --nd-badge-tracker:#8a4b00;
  --nd-badge-unavailable:#6b6b6b;
  --nd-serif:'Libre Baskerville', Georgia, 'Times New Roman', serif;
  --nd-sans:'Poppins', system-ui, sans-serif;
  --nd-mono:ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark){
  :root{
    --nd-bg:#14181a;
    --nd-fg:#e7e5df;
    --nd-muted:#a3a39a;
    --nd-border:#33383a;
    --nd-card:#1c2124;
    --nd-accent:#4fd6ac;
    --nd-warn-bg:#3a2c10;
    --nd-warn-fg:#f0c26a;
    --nd-badge-permit:#4fd6ac;
    --nd-badge-api:#6cc3f0;
    --nd-badge-testimony:#f0c26a;
    --nd-badge-tracker:#f0a56a;
    --nd-badge-unavailable:#9a9a92;
  }
}
#nd-page{
  max-width:960px;
  margin:0 auto;
  padding:2rem 1.25rem 4rem;
  background:var(--nd-bg);
  color:var(--nd-fg);
  font-family:var(--nd-sans);
  line-height:1.55;
}
#nd-page h1{
  font-family:var(--nd-serif);
  font-size:1.9rem;
  margin-bottom:0.25rem;
}
#nd-page h2{
  font-family:var(--nd-serif);
  font-size:1.3rem;
  margin-top:2.5rem;
  border-bottom:1px solid var(--nd-border);
  padding-bottom:0.35rem;
}
#nd-page .nd-sub{
  color:var(--nd-muted);
  margin-top:0;
}
#nd-page .nd-banner{
  background:var(--nd-warn-bg);
  color:var(--nd-warn-fg);
  border:1px solid var(--nd-warn-fg);
  border-radius:6px;
  padding:0.85rem 1rem;
  margin:1.25rem 0;
  font-size:0.95rem;
}
#nd-page .nd-windows{
  display:flex;
  gap:1rem;
  flex-wrap:wrap;
  margin:1rem 0;
}
#nd-page .nd-window-card{
  flex:1 1 220px;
  background:var(--nd-card);
  border:1px solid var(--nd-border);
  border-radius:8px;
  padding:0.9rem 1rem;
}
#nd-page .nd-window-card h3{
  margin:0 0 0.25rem;
  font-size:1rem;
}
#nd-page .nd-window-card .nd-range{
  color:var(--nd-muted);
  font-size:0.9rem;
}
#nd-page table.nd-table{
  width:100%;
  border-collapse:collapse;
  margin:1rem 0;
  font-size:0.92rem;
}
#nd-page table.nd-table caption{
  text-align:left;
  color:var(--nd-muted);
  font-size:0.85rem;
  margin-bottom:0.5rem;
}
#nd-page table.nd-table th,
#nd-page table.nd-table td{
  border:1px solid var(--nd-border);
  padding:0.55rem 0.65rem;
  text-align:left;
  vertical-align:top;
}
#nd-page table.nd-table thead th{
  background:var(--nd-card);
  font-weight:600;
}
#nd-page table.nd-table td.nd-num{
  text-align:right;
  font-variant-numeric:tabular-nums;
  white-space:nowrap;
}
#nd-page .nd-badge{
  display:inline-block;
  padding:0.1rem 0.5rem;
  border-radius:999px;
  font-size:0.78rem;
  font-weight:600;
  border:1px solid currentColor;
  white-space:nowrap;
}
#nd-page .nd-badge.permit-verified{ color:var(--nd-badge-permit); }
#nd-page .nd-badge.api-verified{ color:var(--nd-badge-api); }
#nd-page .nd-badge.testimony-only{ color:var(--nd-badge-testimony); }
#nd-page .nd-badge.tracker-only{ color:var(--nd-badge-tracker); }
#nd-page .nd-badge.unavailable{ color:var(--nd-badge-unavailable); }
#nd-page .nd-legend{
  display:flex;
  flex-wrap:wrap;
  gap:0.75rem 1.5rem;
  font-size:0.85rem;
  color:var(--nd-muted);
  margin:0.75rem 0 1.5rem;
}
#nd-page .nd-legend li{
  list-style:none;
  display:flex;
  align-items:center;
  gap:0.4rem;
}
#nd-page ul.nd-legend{ padding:0; margin-left:0; }
#nd-page .nd-sources{
  padding-left:1.1rem;
}
#nd-page .nd-sources li{
  margin-bottom:0.9rem;
}
#nd-page .nd-sources .nd-role{
  color:var(--nd-muted);
  font-size:0.88rem;
}
#nd-page .nd-sources code{
  font-family:var(--nd-mono);
  font-size:0.85em;
  background:var(--nd-card);
  border:1px solid var(--nd-border);
  border-radius:4px;
  padding:0.05rem 0.3rem;
}
#nd-page .nd-unverified{
  color:var(--nd-warn-fg);
  font-weight:600;
}
#nd-page a{ color:var(--nd-accent); }
#nd-page .nd-repro{
  background:var(--nd-card);
  border:1px solid var(--nd-border);
  border-radius:8px;
  padding:1rem 1.1rem;
}
#nd-page .nd-repro pre{
  background:transparent;
  margin:0.5rem 0 0;
  overflow-x:auto;
  font-family:var(--nd-mono);
  font-size:0.85rem;
}
`;
