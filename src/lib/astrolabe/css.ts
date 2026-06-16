export const ASTROLABE_CSS = `
  :root{
    --page:#05070C;
    --ground:#080B12;
    --zband:#0E1422;
    --orbit:#1A2340;
    --spoke:rgba(255,255,255,0.06);
    --divider:rgba(255,255,255,0.14);
    --label:#8898BB;
    --label-dim:#3A4A6A;
    --zodiac-active:rgba(255,255,255,0.055);
    --zodiac-arc:rgba(255,255,255,0.40);
    --conjunction:rgba(232,239,255,1);
    --hand:#EDE6CF;
    --sun:#D4A843;
    --mercury:#9A9AAE;
    --venus:#C8B87A;
    --earth:#4A7FC1;
    --mars:#C46A3A;
    --jupiter:#BFA06A;
    --saturn:#C8BE9A;
    --uranus:#6AACB8;
    --neptune:#4A5CAA;
    --moon:#D0D4DC;
    --guilloche:#AEB6C2;
    --case:#C7CBD2;
    --strap-leather:#3A2A1E;
    --serif:'Cormorant Garamond', Georgia, 'Times New Roman', serif;
    --mono:'DM Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
  }
  *{box-sizing:border-box;}
  html,body{margin:0;height:100%;background:var(--page);overflow:hidden;
    -webkit-text-size-adjust:100%;text-size-adjust:100%;
    -webkit-tap-highlight-color:transparent;}
  #stage-wrap{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;}
  #dial{display:block;touch-action:none;position:relative;z-index:1;}
  .ground{fill:var(--ground);}
  .zband-bg{fill:var(--zband);}
  .orbit-ring{fill:none;stroke:var(--orbit);stroke-width:0.6;}
  .spoke{stroke:var(--spoke);stroke-width:1;}
  .hit{fill:transparent;pointer-events:all;cursor:pointer;}
  .planet,.saturn-ring,.moon-mark{pointer-events:none;}
  .saturn-ring{fill:none;stroke:var(--saturn);stroke-width:0.8;opacity:0.5;}
  .earth-ring{fill:none;stroke:rgba(255,255,255,0.40);stroke-width:1.2;pointer-events:none;}
  .date-month{font-family:var(--mono);font-size:8.5px;letter-spacing:.08em;fill:#DCE6FF;
    text-anchor:middle;dominant-baseline:central;pointer-events:none;}
  .date-day{font-family:var(--mono);font-size:16px;fill:#FFFFFF;
    text-anchor:middle;dominant-baseline:central;pointer-events:none;}
  .orbit-ring,.spoke,.planet,.saturn-ring,.moon-mark{pointer-events:none;}
  .zwedge{opacity:0;pointer-events:none;transition:opacity .55s ease;}
  .zwedge.active{opacity:0.40;}
  .zdiv{stroke:var(--divider);stroke-width:0.6;pointer-events:none;}
  .zarc{fill:none;stroke-width:1.4;opacity:0;transition:opacity .55s ease;pointer-events:none;}
  .zarc.active{opacity:0.9;}
  .zlabel{fill:var(--label-dim);font-family:var(--serif);font-weight:300;font-size:23px;
    letter-spacing:1.5px;text-anchor:middle;dominant-baseline:central;pointer-events:none;
    transition:fill .55s ease;}
  .zlabel.active{fill:var(--label);}
  .zglyph path{fill:none;stroke:var(--label-dim);stroke-width:2;stroke-linecap:round;
    stroke-linejoin:round;transition:stroke .55s ease;}
  .zglyph.active path{stroke:var(--label);}
  #twilightCone{pointer-events:none;}
  .hide-twilight #twilightCone{display:none;}
  .conj-line{stroke:var(--conjunction);fill:none;pointer-events:none;}
  .guilloche-line{stroke:var(--guilloche);stroke-opacity:0.16;stroke-width:1;fill:none;pointer-events:none;}
  #guilloche{pointer-events:none;}
  .hide-guilloche #guilloche{display:none;}
  #texture,#sparkles{display:none;pointer-events:none;}
  .bg-textured #texture,.bg-sparkle #texture{display:block;}
  .bg-sparkle #sparkles{display:block;}
  .tline{stroke:#FFFFFF;}
  .sparkle{opacity:0.55;animation:twinkle var(--d,4s) ease-in-out infinite;animation-delay:var(--dl,0s);}
  @keyframes twinkle{0%,100%{opacity:var(--o0,0.15);}50%{opacity:var(--o1,0.85);}}
  .zoccupant{font-family:var(--mono);font-size:16px;letter-spacing:.02em;text-anchor:middle;
    dominant-baseline:central;opacity:0;transition:opacity .45s ease;pointer-events:none;}
  .zoccupant.active{opacity:1;}
  .zhit{fill:transparent;pointer-events:all;cursor:pointer;}
  .bezel-ring{fill:none;}
  .bezel-edge{fill:none;stroke-width:1;}
  .sun-core{fill:var(--sun);}
  .hand-min,.hand-hour{fill:var(--hand);stroke:rgba(0,0,0,0.40);stroke-width:0.5;}
  .hub{fill:var(--hand);}
  .hub-dot{fill:#15161A;}
  .hand-min,.hand-hour,.hub,.hub-dot{pointer-events:none;}
  .hide-orbits .orbit-ring{display:none;}
  .hide-spokes .spoke{display:none;}
  .ptolemaic .disc-earth .orbit-ring,.ptolemaic .disc-earth .spoke{display:none;}
  .hide-zlabels .zglyph{display:none;}
  .hide-dividers .zdiv{display:none;}
  .hide-conj .conj-line{display:none;}
  .hide-conj-curved .conj-line{display:none;}
  .hide-hands .hand-min,.hide-hands .hand-hour,.hide-hands .hub,.hide-hands .hub-dot{display:none;}
  .hide-moon .disc-moon{display:none;}
  #gear{position:fixed;top:max(10px,env(safe-area-inset-top));left:12px;right:auto;z-index:60;
    font-family:var(--mono);font-size:18px;line-height:1;color:var(--label);
    background:rgba(14,20,34,0.85);border:1px solid rgba(255,255,255,0.12);
    border-radius:8px;padding:7px 11px;cursor:pointer;
    -webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);}
  #gear:active{transform:scale(0.97);}
  #gear.open{color:#E7ECF7;border-color:rgba(255,255,255,0.30);}
  #controls{position:fixed;top:0;left:0;right:auto;z-index:50;width:300px;
    max-height:100dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;
    background:rgba(8,11,18,0.94);border-right:1px solid rgba(255,255,255,0.10);
    -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);
    transform:translateX(-101%);transition:transform .26s ease;
    padding:58px 18px 22px;font-family:var(--mono);color:var(--label);font-size:12px;}
  #controls.open{transform:translateX(0);}
  /* Wide viewports open by default for first paint; once controls.ts adds
     .ready, the .open class alone governs so the toggle closes at any width. */
  @media (min-width:768px){
    #controls:not(.ready){transform:translateX(0);}
  }
  #controls .motion{padding-bottom:6px;}
  #controls details{border-top:1px solid rgba(255,255,255,0.07);padding:8px 0;}
  #controls summary{cursor:pointer;color:#AEBDDE;letter-spacing:.1em;text-transform:uppercase;
    font-size:11px;list-style:none;padding:6px 0;user-select:none;}
  #controls summary::-webkit-details-marker{display:none;}
  #controls summary::after{content:'+';float:right;color:var(--label-dim);}
  #controls details[open] summary::after{content:'\\2013';}
  #controls .clock{font-size:15px;line-height:1.45;letter-spacing:.02em;
    padding-bottom:10px;margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.07);}
  .clock-row{display:flex;gap:8px;align-items:baseline;}
  .clock-k{color:var(--label-dim);min-width:42px;}
  .clock-v{color:#E7ECF7;white-space:nowrap;}
  .field{padding:7px 0 2px;}
  .field-k{display:block;color:var(--label-dim);text-transform:uppercase;letter-spacing:.1em;
    font-size:10px;margin-bottom:5px;}
  .btn-group{display:flex;flex-wrap:wrap;gap:5px;}
  .btn-group .seg{flex:1 1 auto;font-family:var(--mono);font-size:11px;letter-spacing:.02em;
    color:var(--label);background:rgba(255,255,255,0.04);
    border:1px solid rgba(255,255,255,0.12);border-radius:7px;padding:7px 8px;cursor:pointer;
    white-space:nowrap;}
  .btn-group .seg:active{transform:scale(0.98);}
  .btn-group .seg.active{border-color:rgba(255,255,255,0.55);color:#E7ECF7;
    background:rgba(255,255,255,0.10);}
  .row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:7px 2px;}
  .row label{flex:1;color:var(--label);cursor:pointer;}
  .row .val{color:#AEBDDE;min-width:48px;text-align:right;}
  input[type=range]{flex:1.4;accent-color:var(--sun);height:22px;}
  input[type=checkbox]{accent-color:var(--sun);width:17px;height:17px;}
  .materials{display:flex;gap:8px;padding:8px 0 4px;}
  .material-swatch{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;
    font-family:var(--mono);font-size:10px;letter-spacing:.04em;color:var(--label);
    background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.12);
    border-radius:8px;padding:9px 4px 7px;cursor:pointer;}
  .material-swatch:active{transform:scale(0.98);}
  .material-swatch.active{border-color:rgba(255,255,255,0.55);color:#E7ECF7;
    background:rgba(255,255,255,0.08);}
  .material-swatch .chip{width:26px;height:26px;border-radius:50%;
    border:1px solid rgba(0,0,0,0.35);
    background:radial-gradient(circle at 32% 28%, #fff6 0%, transparent 42%),var(--chip,#888);}
  #strap{position:absolute;left:50%;top:50%;width:var(--dial-px,520px);height:var(--dial-px,520px);
    transform:translate(-50%,-50%);pointer-events:none;z-index:0;}
  .strap-band{position:absolute;left:50%;transform:translateX(-50%);width:46%;height:64%;
    background:var(--strap-leather);
    background-image:linear-gradient(90deg,rgba(0,0,0,0.35),rgba(255,255,255,0.06) 50%,rgba(0,0,0,0.35));
    border-radius:12px;}
  .strap-top{bottom:58%;border-bottom:7px solid var(--case);}
  .strap-bottom{top:58%;border-top:7px solid var(--case);}
  .strap-band::before{content:'';position:absolute;inset:9px 10px;border-radius:7px;
    border:1.4px dashed rgba(255,255,255,0.28);}
  .full-screen #strap{display:none;}
  .swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(112px,1fr));gap:8px;padding:6px 0;}
  .sw{display:flex;align-items:center;gap:8px;}
  .sw span{flex:1;color:var(--label);font-size:11px;text-align:right;}
  input[type=color]{width:30px;height:24px;padding:0;border:1px solid rgba(255,255,255,0.15);
    border-radius:5px;background:none;cursor:pointer;}
  input[type=color]::-webkit-color-swatch-wrapper{padding:2px;}
  input[type=color]::-webkit-color-swatch{border:none;border-radius:3px;}
  select{font-family:var(--mono);font-size:12px;color:#AEBDDE;background:rgba(255,255,255,0.05);
    border:1px solid rgba(255,255,255,0.15);border-radius:6px;padding:6px 8px;cursor:pointer;}
  .btnrow{display:flex;gap:10px;padding-top:12px;}
  .btn{flex:1;font-family:var(--mono);font-size:12px;letter-spacing:.05em;color:#AEBDDE;
    background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);
    border-radius:7px;padding:10px;cursor:pointer;}
  .btn:active{transform:scale(0.98);}
  #motionBtn{display:none;}
  .note{color:var(--label-dim);font-size:10.5px;line-height:1.5;padding:4px 2px 0;}
  #tip{position:fixed;z-index:40;pointer-events:none;
    font-family:var(--mono);font-size:11px;letter-spacing:.04em;color:#E7ECF7;
    background:rgba(10,14,24,0.92);border:1px solid rgba(255,255,255,0.14);
    border-radius:6px;padding:5px 9px;white-space:nowrap;
    transform:translate(-50%,-150%);opacity:0;transition:opacity .12s ease;}
  #tip.show{opacity:1;}
  #signcard{position:fixed;z-index:42;pointer-events:none;text-align:center;color:#E7ECF7;
    background:rgba(10,14,24,0.95);border:1px solid rgba(255,255,255,0.14);border-radius:11px;
    padding:11px 16px 9px;min-width:104px;transform:translate(-50%,-118%);
    opacity:0;transition:opacity .13s ease;font-family:var(--mono);}
  #signcard.show{opacity:1;}
  #signcard .sc-glyph{display:block;margin:0 auto 5px;color:#EAF0FF;}
  #signcard .sc-name{font-family:var(--serif);font-size:16px;letter-spacing:.04em;}
  #signcard .sc-pl{font-size:10.5px;color:#9FB0D8;margin-top:4px;letter-spacing:.03em;line-height:1.35;}
  @media (prefers-reduced-motion: reduce){
    *{transition:none !important;animation:none !important;}
  }
`;
