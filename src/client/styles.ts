export const WORKBENCH_CSS = String.raw`
.omv-launcher {
  appearance: none; width: 100%; min-height: 36px; padding: 0 10px; border: 0; border-radius: 8px;
  background: transparent; color: var(--dsw-alias-label-secondary, #5f6269); display: flex; align-items: center;
  justify-content: flex-start; gap: 10px; cursor: pointer; font: inherit;
}
.omv-launcher:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .05)); color: var(--dsw-alias-label-primary, #1f2024);
}
.omv-launcher-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; }
.omv-launcher-badge {
  margin-left: auto; min-width: 18px; height: 18px; padding: 0 5px; display: grid; place-items: center;
  border-radius: 9px; background: var(--dsw-alias-state-error-secondary, #fdecec);
  color: var(--dsw-alias-state-error-primary, #c94b4b); font-size: 10px;
}

/* Fallback palette flips with the system scheme; host tokens always win when defined. */
.omv-native-view, .omv-settings {
  --omv-fb-bg: #f5f6fa; --omv-fb-surface: #fff; --omv-fb-line: #e2e4ec;
  --omv-fb-text: #14151d; --omv-fb-muted: #5c5f6d; --omv-fb-faint: #8a8d9c;
  --omv-fb-hover: rgba(23, 25, 44, .045);
  --omv-fb-blue: #4d6bfe; --omv-fb-green: #1f9d63; --omv-fb-orange: #b7791f;
  --omv-fb-red: #d6433f;
  /* Signal accents: not bridged to host tokens, so these stay fully under our control regardless of theme. */
  --omv-fb-teal: #0d8f9e; --omv-fb-violet: #6a3df5;
}
@media (prefers-color-scheme: dark) {
  .omv-native-view, .omv-settings {
    --omv-fb-bg: #0b0c13; --omv-fb-surface: #14151f; --omv-fb-line: #262838;
    --omv-fb-text: #eceef5; --omv-fb-muted: #a3a6b8; --omv-fb-faint: #74778a;
    --omv-fb-hover: rgba(255, 255, 255, .06);
    --omv-fb-blue: #7c93ff; --omv-fb-green: #35d491; --omv-fb-orange: #e6ab4d;
    --omv-fb-red: #ff6b66;
    --omv-fb-teal: #29d6e6; --omv-fb-violet: #9b7dff;
  }
}
.omv-native-view, .omv-settings {
  --omv-bg: var(--dsw-alias-bg-layer-1, var(--omv-fb-bg));
  --omv-surface: var(--dsw-alias-bg-layer-2, var(--omv-fb-surface));
  --omv-line: var(--dsw-alias-border-l2, var(--omv-fb-line));
  --omv-text: var(--dsw-alias-label-primary, var(--omv-fb-text));
  --omv-muted: var(--dsw-alias-label-secondary, var(--omv-fb-muted));
  --omv-faint: color-mix(in srgb, var(--dsw-alias-label-tertiary, var(--omv-fb-faint)) 86%, var(--dsw-alias-label-primary, var(--omv-fb-text)));
  --omv-hover: var(--dsw-alias-interactive-bg-hover, var(--omv-fb-hover));
  --omv-blue: var(--dsw-alias-state-business-primary, var(--omv-fb-blue));
  --omv-green: var(--dsw-alias-state-success-primary, var(--omv-fb-green));
  --omv-orange: var(--dsw-alias-state-warn-primary, var(--omv-fb-orange));
  --omv-red: var(--dsw-alias-state-error-primary, var(--omv-fb-red));
  --omv-teal: var(--omv-fb-teal);
  --omv-purple: var(--omv-fb-violet);
  --omv-violet: var(--omv-fb-violet);
  --omv-signal: linear-gradient(135deg, var(--omv-violet), var(--omv-teal));
  --omv-shadow-tint: rgba(15, 23, 42, .05);
  --omv-shadow-xs: 0 1px 2px var(--omv-shadow-tint);
  --omv-shadow-sm: 0 2px 6px -2px var(--omv-shadow-tint), 0 8px 20px -8px var(--omv-shadow-tint);
  --omv-shadow-md: 0 4px 10px -3px var(--omv-shadow-tint), 0 16px 36px -14px var(--omv-shadow-tint);
  --omv-shadow-lg: 0 8px 16px -4px var(--omv-shadow-tint), 0 28px 60px -20px var(--omv-shadow-tint);
  --omv-radius-sm: 10px;
  --omv-radius-md: 14px;
  --omv-radius-lg: 18px;
  color: var(--omv-text);
  font: var(--dsw-font-xs-13, 13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
}
@media (prefers-color-scheme: dark) {
  .omv-native-view, .omv-settings { --omv-shadow-tint: rgba(0, 0, 0, .5); }
}
.omv-native-view h2, .omv-native-view h3, .omv-settings h2, .omv-settings h3 { font-feature-settings: "tnum"; }
.omv-tabular { font-variant-numeric: tabular-nums; }
/* Signature decorative devices: dot-grid backdrop + viewfinder corner marks, used on hero/command surfaces app-wide. */
.omv-dotgrid {
  background-image: radial-gradient(circle, color-mix(in srgb, var(--omv-text) 14%, transparent) 1px, transparent 1px);
  background-size: 14px 14px;
}
.omv-corner-marks { position: relative; }
.omv-corner-marks::before, .omv-corner-marks::after {
  content: ''; position: absolute; width: 14px; height: 14px; pointer-events: none; opacity: .55;
  border-color: var(--omv-violet); border-style: solid; border-width: 0;
}
.omv-corner-marks::before { top: 10px; left: 10px; border-top-width: 2px; border-left-width: 2px; border-radius: 4px 0 0 0; }
.omv-corner-marks::after { bottom: 10px; right: 10px; border-bottom-width: 2px; border-right-width: 2px; border-radius: 0 0 4px 0; }
.omv-signal-text {
  background: var(--omv-signal); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.omv-native-view {
  position: relative; display: flex; width: 100%; height: 100%; min-width: 0; min-height: 0;
  flex-direction: column; overflow: hidden; box-sizing: border-box; background: var(--omv-bg);
}
.omv-native-view *, .omv-settings * { box-sizing: border-box; }
.omv-native-view button, .omv-native-view input, .omv-native-view select, .omv-native-view textarea,
.omv-settings button { font: inherit; }

.omv-native-view ::selection, .omv-settings ::selection { background: color-mix(in srgb, var(--omv-blue) 16%, transparent); }
.omv-native-view button, .omv-native-view input, .omv-native-view select, .omv-native-view textarea,
.omv-native-view [tabindex], .omv-native-view [role='button'] {
  transition: background-color .12s ease, border-color .12s ease, color .12s ease, box-shadow .12s ease, opacity .12s ease, filter .12s ease, transform .12s ease;
}
.omv-native-view button:focus-visible, .omv-native-view [tabindex]:focus-visible, .omv-native-view [role='button']:focus-visible,
.omv-settings button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--omv-blue) 60%, transparent); outline-offset: 1px;
}

.omv-native-toolbar {
  min-height: 40px; height: auto; flex: none; padding: 0 10px; border-bottom: 1px solid var(--omv-line);
  background: var(--omv-bg); display: flex; align-items: center; gap: 10px;
}
.omv-nav { align-self: stretch; display: flex; align-items: stretch; gap: 4px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.omv-nav::-webkit-scrollbar { display: none; }
.omv-nav-button {
  position: relative; appearance: none; min-width: 54px; padding: 0 10px; border: 0; background: transparent;
  color: var(--omv-muted); display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer;
  font-size: 13px; border-radius: 6px;
}
.omv-nav-button:hover { color: var(--omv-text); background: var(--omv-hover); }
.omv-nav-button[data-active='true'] { color: var(--omv-text); font-weight: 600; }
.omv-nav-button[data-active='true']::after {
  content: ''; position: absolute; right: 10px; bottom: 0; left: 10px; height: 2px; border-radius: 2px 2px 0 0;
  background: var(--omv-blue);
}
.omv-nav-count {
  min-width: 18px; height: 18px; padding: 0 5px; border-radius: 9px; background: var(--omv-hover);
  color: var(--omv-faint); display: grid; place-items: center; font-size: 10.5px; font-weight: 600;
}
.omv-workspace-path {
  margin-left: auto; max-width: min(34vw, 360px); overflow: hidden; color: var(--omv-faint);
  font: 11.5px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap;
}
.omv-live { flex: none; display: inline-flex; align-items: center; gap: 5px; color: var(--omv-faint); font-size: 11px; }
.omv-live > i { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-live[data-state='live'] > i { background: var(--dsw-alias-state-success-primary, #329568); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary, #329568) 12%, transparent); }
.omv-jobs-badge { flex: none; display: inline-flex; align-items: center; gap: 5px; color: var(--omv-blue); font-size: 11px; }
.omv-sync-meta { flex: none; max-width: 120px; overflow: hidden; color: var(--omv-faint); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.omv-sync-meta:has(+ .omv-icon-button) { color: var(--omv-faint); }

.omv-icon-button, .omv-primary, .omv-secondary, .omv-danger {
  appearance: none; border: 1px solid var(--omv-line); border-radius: 7px; cursor: pointer;
}
.omv-icon-button {
  width: 32px; height: 32px; padding: 0; flex: none; display: grid; place-items: center;
  background: transparent; color: var(--omv-muted);
}
.omv-icon-button:hover { background: var(--omv-hover); color: var(--omv-text); }
.omv-icon-button:active { background: color-mix(in srgb, var(--omv-hover) 75%, var(--omv-surface)); }
.omv-icon-button:disabled { opacity: .45; cursor: wait; }
/* Design-spec alignment: buttons carry a leading icon at a single consistent size (14px)
   regardless of the size= prop each call site historically passed; icon-buttons (bare glyph,
   no label) sit one step up at 16px. CSS width/height wins over the SVG's own attributes. */
.omv-primary svg, .omv-secondary svg, .omv-danger svg { width: 14px; height: 14px; flex: none; }
.omv-icon-button svg { width: 16px; height: 16px; }
.omv-palette-button { min-height: 28px; padding: 0 7px; border: 1px solid var(--omv-line); border-radius: 6px; background: var(--omv-surface); color: var(--omv-muted); display: inline-flex; align-items: center; gap: 5px; cursor: pointer; font-size: 10.5px; }
.omv-palette-button:hover { background: var(--omv-hover); color: var(--omv-text); }
.omv-palette-button kbd { padding: 1px 4px; border: 1px solid var(--omv-line); border-radius: 3px; color: var(--omv-faint); font: 9px/1.2 ui-monospace, monospace; }

.omv-header-action {
  appearance: none; height: 26px; min-width: 26px; padding: 0 7px; border: 0; border-radius: 6px;
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; background: transparent;
  color: var(--dsw-alias-label-tertiary, #8b8f98); cursor: pointer; font: var(--dsw-font-xxs-12, 12px/1 sans-serif);
}
.omv-header-action:hover { color: var(--dsw-alias-label-primary, #1f2024); background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.045)); }
.omv-header-action[data-alert='true'] { color: var(--dsw-alias-state-error-primary, #c94b4b); }
.omv-header-action:disabled { opacity: .55; cursor: wait; }
.omv-context-dock {
  min-height: 20px; display: flex; align-items: center; gap: 7px; padding: 0 4px;
  color: var(--dsw-alias-label-caption, #8b8f98); font: var(--dsw-font-xxxs-11, 11.5px/20px sans-serif);
}
.omv-context-dock > i { width: 2px; height: 2px; border-radius: 50%; background: currentColor; }
.omv-context-dock b { color: var(--dsw-alias-state-error-primary, #c94b4b); font-weight: 500; }
.omv-blank-dock {
  width: min(680px, 100%); min-height: 32px; margin: 0 auto 6px; padding: 6px 10px;
  border: 1px solid var(--dsw-alias-border-l2, #e5e6e8); border-radius: 8px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  background: var(--dsw-alias-bg-layer-2, #fff); color: var(--dsw-alias-label-tertiary, #8b8f98);
  font: var(--dsw-font-xxs-12, 12px/1.4 sans-serif);
}
.omv-blank-dock > svg { color: var(--dsw-alias-state-business-primary, #4d6bfe); }
.omv-blank-dock > i { width: 2px; height: 2px; border-radius: 50%; background: currentColor; }
.omv-blank-dock b { color: var(--dsw-alias-label-primary, #1f2024); font-weight: 500; }

.omv-command-row {
  display: flex; align-items: center; min-width: 0; height: 32px; padding: 0 4px; gap: 8px;
  color: var(--dsw-alias-label-secondary, #65686f); font: var(--dsw-font-xs-13, 13px/24px sans-serif);
}
.omv-command-row .omv-command-icon { display: grid; place-items: center; color: var(--dsw-alias-state-business-primary, #4d6bfe); }
.omv-command-row code { flex: none; color: var(--dsw-alias-label-primary, #1f2024); font: var(--dsw-font-code-xs, 12px/1.4 ui-monospace, monospace); }
.omv-command-row > i { flex: none; width: 2px; height: 2px; border-radius: 50%; background: var(--dsw-alias-label-caption, #9a9ca2); }
.omv-command-row > span:last-child { min-width: 0; overflow: hidden; color: var(--dsw-alias-label-tertiary, #8b8f98); text-overflow: ellipsis; white-space: nowrap; }
.omv-command-row[data-state='error'] .omv-command-icon,
.omv-command-row[data-state='error'] > span:last-child { color: var(--dsw-alias-state-error-primary, #c94b4b); }

.omv-content {
  flex: 1; min-height: 0; overflow: auto; padding: 28px 32px calc(var(--dsh-composer-height, 152px) + 28px);
  scrollbar-width: thin; overscroll-behavior: contain;
}
.omv-content-inner { width: min(1120px, 100%); margin: 0 auto; }
.omv-hero { min-height: 62px; margin-bottom: 22px; display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
.omv-eyebrow { margin: 0 0 6px; color: var(--omv-faint); font-size: 11px; font-weight: 500; letter-spacing: .06em; }
.omv-hero h2 { margin: 0; font-size: 23px; line-height: 1.25; font-weight: 650; letter-spacing: -.025em; }
.omv-hero p:not(.omv-eyebrow) { margin: 7px 0 0; color: var(--omv-muted); font-size: 14px; line-height: 1.55; }
.omv-hero-actions, .omv-detail-actions, .omv-form-actions { display: flex; align-items: center; gap: 8px; }
.omv-campaign-notice {
  appearance: none; width: 100%; min-height: 46px; margin: -8px 0 16px; padding: 8px 11px; border: 1px solid var(--omv-line); border-radius: 8px;
  background: var(--omv-surface); color: var(--omv-muted); display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 9px; text-align: left; cursor: pointer;
}
.omv-campaign-notice:hover { background: var(--omv-hover); }
.omv-campaign-notice > svg:first-child { color: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-campaign-notice span { display: grid; gap: 1px; }
.omv-campaign-notice strong { color: var(--omv-text); font-size: 11.5px; font-weight: 500; }
.omv-campaign-notice small { color: var(--omv-faint); font-size: 10.5px; }
.omv-data-notice { min-height: 48px; margin: -8px 0 16px; padding: 8px 11px; border: 1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b7791f) 28%, var(--omv-line)); border-radius: 8px; background: color-mix(in srgb, var(--dsw-alias-state-warn-secondary, #fff7e6) 60%, var(--omv-surface)); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.omv-data-notice > svg { color: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-data-notice > div { min-width: 0; display: grid; gap: 1px; }
.omv-data-notice strong { color: var(--omv-text); font-size: 11.5px; font-weight: 600; }
.omv-data-notice span { overflow: hidden; color: var(--omv-muted); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
.omv-data-notice details { margin-top: 6px; color: var(--omv-faint); font-size: 10.5px; }
.omv-data-notice summary { width: fit-content; cursor: pointer; color: var(--omv-muted); }
.omv-data-notice details ul { display: grid; gap: 3px; margin: 6px 0 0; padding: 0; list-style: none; }
.omv-data-notice details li { min-width: 0; display: flex; gap: 7px; }
.omv-data-notice details li code { flex: none; color: var(--omv-muted); font: 10px/1.4 ui-monospace, monospace; }
.omv-data-notice details li span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.omv-data-notice-actions { flex: none; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; }
.omv-data-notice .omv-secondary { min-height: 29px; padding: 0 10px; font-size: 11px; }
.omv-primary, .omv-secondary, .omv-danger {
  min-height: 34px; padding: 0 14px; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
  font-size: 12.5px; font-weight: 500;
}
.omv-primary { border-color: var(--omv-blue); background: var(--omv-blue); color: var(--dsw-alias-label-primary-inverted, #fff); }
.omv-primary:hover { filter: brightness(.95); box-shadow: 0 0 0 3px color-mix(in srgb, var(--omv-blue) 14%, transparent); }
.omv-primary:active { filter: brightness(.9); }
.omv-secondary { background: var(--omv-surface); color: var(--omv-text); }
.omv-secondary:hover { background: var(--omv-hover); border-color: color-mix(in srgb, var(--omv-line) 40%, var(--omv-muted)); }
.omv-secondary:active { background: color-mix(in srgb, var(--omv-hover) 75%, var(--omv-surface)); }
.omv-danger {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #c94b4b) 28%, transparent);
  background: var(--dsw-alias-state-error-secondary, #fdecec); color: var(--dsw-alias-state-error-primary, #c94b4b);
}
.omv-danger:hover { filter: brightness(.96); }
.omv-primary:disabled, .omv-secondary:disabled, .omv-danger:disabled { opacity: .45; cursor: wait; }

.omv-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
.omv-metric {
  position: relative; min-height: 100px; padding: 18px 20px; overflow: hidden;
  border: 1px solid var(--omv-line); border-radius: var(--omv-radius-md); background: var(--omv-surface);
  box-shadow: var(--omv-shadow-xs); transition: box-shadow .16s ease, transform .16s ease;
}
.omv-metric:hover { box-shadow: var(--omv-shadow-sm); transform: translateY(-1px); }
.omv-metric-head { display: flex; align-items: center; justify-content: space-between; color: var(--omv-muted); font-size: 12px; }
.omv-metric-icon {
  width: 32px; height: 32px; border-radius: var(--omv-radius-sm);
  background: color-mix(in srgb, var(--metric-color, var(--omv-blue)) 12%, transparent);
  color: var(--metric-color, var(--omv-blue)); display: grid; place-items: center;
}
.omv-metric-icon svg { width: 16px; height: 16px; }
.omv-metric strong { display: block; margin-top: 12px; font-size: 30px; line-height: 1; font-weight: 650; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.omv-metric-foot { margin-top: 10px; display: block; color: var(--omv-faint); font-size: 12px; }
.omv-metric-foot b { color: var(--metric-color, var(--omv-muted)); font-weight: 600; }

.omv-readiness-strip {
  position: relative; display: flex; align-items: center; gap: 16px; margin-bottom: 12px; padding: 16px 20px;
  border: 1px solid var(--omv-line); border-radius: var(--omv-radius-md); background: var(--omv-surface); overflow: hidden;
  box-shadow: var(--omv-shadow-xs);
}
.omv-readiness-ring {
  --pct: 0; flex: none; position: relative; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center;
  background: conic-gradient(var(--omv-violet) calc(var(--pct) * 1%), var(--omv-line) 0);
}
.omv-readiness-ring::before { content: ''; position: absolute; inset: 5px; border-radius: 50%; background: var(--omv-surface); }
.omv-readiness-ring b { position: relative; font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
.omv-readiness-copy { min-width: 0; }
.omv-readiness-copy span { display: block; color: var(--omv-faint); font-size: 10.5px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; }
.omv-readiness-copy strong { display: block; margin-top: 2px; font-size: 13px; font-weight: 600; }
.omv-readiness-strip .omv-legend-row { margin-left: auto; }

.omv-grid { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(280px, .7fr); gap: 12px; }
.omv-side-stack { min-width: 0; display: grid; align-content: start; gap: 12px; }
.omv-panel, .omv-list-wrap, .omv-campaign {
  min-width: 0; border: 1px solid var(--omv-line); border-radius: var(--omv-radius-md); background: var(--omv-surface);
  box-shadow: var(--omv-shadow-xs); overflow: hidden;
}
.omv-panel-head { min-height: 54px; padding: 0 18px; border-bottom: 1px solid var(--omv-line); display: flex; align-items: center; gap: 10px; }
.omv-panel-head h3 { margin: 0; font-size: 13px; font-weight: 600; }
.omv-panel-head p { margin: 2px 0 0; color: var(--omv-faint); font-size: 12px; }
.omv-panel-head .omv-secondary { margin-left: auto; min-height: 30px; padding: 0 11px; font-size: 11px; }
.omv-queue { list-style: none; margin: 0; padding: 0; }
.omv-queue-row {
  display: grid; grid-template-columns: minmax(150px, .85fr) minmax(170px, 1.2fr) 92px 20px;
  align-items: center; gap: 12px; min-height: 58px; padding: 8px 15px; border-bottom: 1px solid var(--omv-line); cursor: pointer;
}
.omv-queue-row:last-child { border-bottom: 0; }
.omv-queue-row:hover { background: var(--omv-hover); }
 td[data-stage] { position: relative; }
 td[data-stage]::before {
  content: ''; position: absolute; top: 8px; bottom: 8px; left: 0; width: 3px; border-radius: 0 2px 2px 0;
  background: var(--stage-line, var(--omv-faint));
 }
 td[data-stage='confirmed']::before, td[data-stage='report_ready']::before, td[data-stage='disclosed']::before { --stage-line: var(--omv-green); }
 td[data-stage='candidate']::before, td[data-stage='investigating']::before { --stage-line: var(--omv-violet); }
 td[data-stage='reproducing']::before { --stage-line: var(--omv-teal); }
 td[data-stage='blocked']::before { --stage-line: var(--omv-red); }
 .omv-finding-name { min-width: 0; padding-left: 4px; display: flex; align-items: center; gap: 12px; }
.omv-finding-name > div { min-width: 0; }
.omv-finding-name strong { display: block; overflow: hidden; color: var(--omv-text); font-size: 13px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.omv-finding-name span { display: block; margin-top: 4px; overflow: hidden; color: var(--omv-faint); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.omv-eco-avatar {
  flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 30px; height: 30px; border-radius: 50%;
  background: color-mix(in srgb, var(--eco) 15%, transparent); color: var(--eco);
  font-size: 12.5px; font-weight: 650; text-transform: uppercase; font-variant-numeric: normal;
}
.omv-eco-avatar[data-size='lg'] { width: 40px; height: 40px; font-size: 14px; }
.omv-eco-chip {
  width: fit-content; padding: 3px 9px; border-radius: 999px; background: color-mix(in srgb, var(--eco) 12%, transparent);
  color: var(--eco); font-size: 11px; font-weight: 600; text-transform: capitalize;
}
.omv-list-wrap {
  min-width: 0; border: 1px solid var(--omv-line); border-radius: var(--omv-radius-md); background: var(--omv-surface);
  box-shadow: var(--omv-shadow-xs); overflow: hidden;
}
.omv-list-head, .omv-finding-row {
  display: grid; grid-template-columns: minmax(0, 1.6fr) 104px 96px minmax(0, .9fr) minmax(0, 1fr);
  align-items: center; gap: 16px; padding: 0 20px;
}
.omv-list-head {
  height: 44px; border-bottom: 1px solid var(--omv-line); color: var(--omv-faint);
  font-size: 10.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  background: color-mix(in srgb, var(--omv-bg) 65%, var(--omv-surface));
}
.omv-finding-list { margin: 0; padding: 0; list-style: none; }
.omv-finding-row { min-height: 72px; padding: 12px 20px; border-bottom: 1px solid var(--omv-line); cursor: pointer; position: relative; }
.omv-finding-row:last-child { border-bottom: 0; }
.omv-finding-row:hover { background: color-mix(in srgb, var(--omv-blue) 5%, var(--omv-surface)); }
.omv-finding-row:focus-visible { outline: 2px solid color-mix(in srgb, var(--omv-blue) 60%, transparent); outline-offset: -2px; }
.omv-finding-row::before {
  content: ''; position: absolute; top: 10px; bottom: 10px; left: 0; width: 3px; border-radius: 0 2px 2px 0;
  background: var(--stage-line, transparent);
}
.omv-finding-row[data-stage='confirmed']::before, .omv-finding-row[data-stage='report_ready']::before, .omv-finding-row[data-stage='disclosed']::before { --stage-line: var(--omv-green); }
.omv-finding-row[data-stage='candidate']::before, .omv-finding-row[data-stage='investigating']::before { --stage-line: var(--omv-violet); }
.omv-finding-row[data-stage='reproducing']::before { --stage-line: var(--omv-teal); }
.omv-finding-row[data-stage='blocked']::before { --stage-line: var(--omv-red); }
.omv-finding-row .omv-cell-mono { min-width: 0; overflow: hidden; color: var(--omv-faint); font: 11px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-next { min-width: 0; overflow: hidden; color: var(--omv-muted); font: 11px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-score { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 7px; color: var(--omv-muted); font-size: 11px; }
.omv-score b { font-weight: 500; }
.omv-score-track, .omv-posture-track { height: 3px; overflow: hidden; border-radius: 2px; background: var(--omv-line); }
.omv-score-track i, .omv-posture-track i { display: block; height: 100%; border-radius: inherit; background: var(--score-color, var(--omv-blue)); }
.omv-muted-copy { color: var(--omv-faint); font-size: 11px; }
.omv-maturity {
  --maturity: var(--omv-faint); min-width: 0; display: grid; grid-template-columns: 7px minmax(0, auto) auto; align-items: center; justify-content: start; gap: 6px; color: var(--omv-muted); font-size: 11px;
}
.omv-maturity[data-maturity='developing'] { --maturity: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-maturity[data-maturity='supported'] { --maturity: var(--omv-teal); }
.omv-maturity[data-maturity='verified'] { --maturity: var(--dsw-alias-state-success-primary, #329568); }
.omv-maturity[data-maturity='contested'] { --maturity: var(--dsw-alias-state-error-primary, #d44c4c); }
.omv-maturity > i { width: 6px; height: 6px; border-radius: 50%; background: var(--maturity); }
.omv-maturity > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.omv-maturity > b { color: var(--omv-faint); font-size: 10px; font-weight: 500; }
.omv-status {
  width: fit-content; padding: 3px 8px; border-radius: 5px; background: color-mix(in srgb, var(--status) 10%, transparent);
  color: var(--status); display: inline-flex; align-items: center; font-size: 11px; font-weight: 500;
}

.omv-posture { padding: 16px; }
.omv-posture-score strong { display: block; font-size: 26px; font-weight: 650; }
.omv-posture-score span { display: block; margin-top: 3px; color: var(--omv-faint); font-size: 12px; }
.omv-posture-track { height: 5px; margin-top: 11px; }
.omv-posture-track i { background: var(--omv-blue); }
.omv-legend { display: grid; gap: 8px; margin-top: 18px; }
.omv-legend-row { display: grid; grid-template-columns: 7px 1fr auto; align-items: center; gap: 8px; color: var(--omv-muted); font-size: 12px; }
.omv-legend-row i { width: 6px; height: 6px; border-radius: 50%; background: var(--legend); }
.omv-legend-row b { color: var(--omv-text); font-weight: 500; }
.omv-alert { margin-top: 15px; padding-top: 12px; border-top: 1px solid var(--omv-line); color: var(--omv-faint); font-size: 12px; line-height: 1.5; }
.omv-native-jobs,
.omv-native-jobs li { min-height: 44px; padding: 7px 12px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.omv-native-jobs li:last-child { border-bottom: 0; }
.omv-native-jobs li > i { width: 6px; height: 6px; border-radius: 50%; background: var(--omv-faint); }
.omv-native-jobs li > i[data-state='running'] { background: var(--omv-blue); animation: omv-pulse 1.4s ease-in-out infinite; }
.omv-native-jobs li > i[data-state='completed'] { background: var(--dsw-alias-state-success-primary, #329568); }
.omv-native-jobs li > i[data-state='failed'] { background: var(--dsw-alias-state-error-primary, #d44c4c); }
.omv-native-jobs li > div { min-width: 0; display: grid; gap: 2px; }
.omv-native-jobs strong { overflow: hidden; color: var(--omv-muted); font-size: 11px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.omv-native-jobs span, .omv-native-jobs code { color: var(--omv-faint); font: 10px/1.4 ui-monospace, monospace; }
.omv-native-jobs button { min-height: 28px; padding: 0 10px; font-size: 11px; }
@keyframes omv-pulse { 50% { opacity: .35; } }

.omv-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
 .omv-search { position: relative; flex: 1; }
 .omv-search svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--omv-faint); }
.omv-input, .omv-select, .omv-textarea {
  width: 100%; border: 1px solid var(--omv-line); border-radius: 7px; outline: 0;
  background: var(--omv-surface); color: var(--omv-text);
}
.omv-input { height: 36px; padding: 0 11px; font-size: 12.5px; }
.omv-search .omv-input { border-radius: 999px; padding-left: 38px; }
.omv-select { height: 36px; padding: 0 28px 0 11px; font-size: 12.5px; }
.omv-textarea { min-height: 76px; padding: 9px 11px; resize: vertical; font-size: 12.5px; line-height: 1.5; }
.omv-input::placeholder, .omv-textarea::placeholder { color: var(--omv-faint); }
.omv-input:focus, .omv-select:focus, .omv-textarea:focus { border-color: var(--omv-blue); box-shadow: 0 0 0 2px color-mix(in srgb, var(--omv-blue) 14%, transparent); }
.omv-empty { min-height: 160px; padding: 28px; display: grid; place-items: center; color: var(--omv-faint); font-size: 13px; text-align: center; }
.omv-empty > div { display: grid; justify-items: center; gap: 6px; max-width: 420px; }
.omv-empty svg { display: block; margin: 0 auto 4px; color: var(--omv-blue); opacity: .72; }
.omv-empty strong { color: var(--omv-muted); font-size: 13px; font-weight: 500; }
.omv-empty span { color: var(--omv-faint); font-size: 11.5px; line-height: 1.5; }
.omv-empty-action { margin-top: 5px; }

.omv-campaigns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.omv-campaign-issues { margin-bottom: 12px; overflow: hidden; }
.omv-campaign-issues > ul { margin: 0; padding: 3px 0; list-style: none; }
.omv-campaign-issues li { min-height: 58px; padding: 8px 12px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.omv-campaign-issues li:last-child { border-bottom: 0; }
.omv-campaign-issues li > i { width: 6px; height: 6px; border-radius: 50%; background: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-campaign-issues li > div { min-width: 0; display: grid; gap: 2px; }
.omv-campaign-issues strong { color: var(--omv-text); font-size: 11.5px; font-weight: 500; }
.omv-campaign-issues span { overflow: hidden; color: var(--omv-muted); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
.omv-campaign-issues code { overflow: hidden; color: var(--omv-faint); font: 10px/1.35 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-campaign { padding: 15px; }
.omv-campaign:hover { border-color: color-mix(in srgb, var(--omv-line) 40%, var(--omv-muted)); box-shadow: 0 6px 18px rgba(0, 0, 0, .05); transform: translateY(-1px); }
.omv-campaign-top { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.omv-campaign-icon { color: var(--omv-muted); display: grid; place-items: center; }
.omv-campaign h3 { margin: 14px 0 5px; overflow: hidden; color: var(--omv-text); font-size: 13.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.omv-campaign p { margin: 0; color: var(--omv-faint); font-size: 12px; }
.omv-campaign-foot { margin-top: 15px; padding-top: 11px; border-top: 1px solid var(--omv-line); display: flex; justify-content: space-between; color: var(--omv-faint); font-size: 11px; }
.omv-campaign-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-bottom: 14px; }
.omv-campaign-summary > div { min-width: 0; padding: 11px; border: 1px solid var(--omv-line); border-radius: 9px; background: var(--omv-bg); transition: border-color .14s ease; }
.omv-campaign-summary > div:hover { border-color: color-mix(in srgb, var(--omv-blue) 30%, var(--omv-line)); }
.omv-campaign-summary span { display: block; color: var(--omv-faint); font-size: 10px; letter-spacing: .02em; }
.omv-campaign-summary strong { display: block; margin-top: 5px; overflow: hidden; color: var(--omv-text); font-size: 12.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.omv-path-block { padding: 11px 12px; display: grid; gap: 5px; }
.omv-path-block code { overflow: hidden; color: var(--omv-muted); font: 10.5px/1.45 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-path-block span { color: var(--omv-faint); font-size: 11px; }.omv-global-search { margin-bottom: 12px; }
.omv-global-search .omv-input { height: 42px; font-size: 13.5px; }
.omv-search-clear { position: absolute; top: 50%; right: 8px; width: 25px; height: 25px; transform: translateY(-50%); border: 0; border-radius: 5px; background: transparent; color: var(--omv-faint); display: grid; place-items: center; cursor: pointer; }
.omv-search-clear:hover { background: var(--omv-hover); color: var(--omv-text); }
.omv-search-results { overflow: hidden; }
.omv-results-meta { min-height: 34px; padding: 0 13px; border-bottom: 1px solid var(--omv-line); display: flex; align-items: center; color: var(--omv-faint); font-size: 11px; }
.omv-search-results > ul { margin: 0; padding: 3px 0; list-style: none; }
.omv-search-results li { min-height: 52px; padding: 8px 13px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 82px minmax(0, 1fr) auto; align-items: center; gap: 11px; }
.omv-search-results li[data-actionable='true'] { cursor: pointer; }
.omv-search-results li[data-actionable='true']:hover { background: var(--omv-hover); }
.omv-search-results li > div { min-width: 0; display: grid; gap: 3px; }
.omv-search-results strong { overflow: hidden; color: var(--omv-text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
.omv-search-results span { overflow: hidden; color: var(--omv-faint); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.omv-search-results li > b { color: var(--omv-faint); font-size: 10.5px; font-weight: 500; }
.omv-activity { margin: 0; padding: 8px 0; list-style: none; }
.omv-activity-row { position: relative; min-height: 54px; padding: 9px 16px 9px 38px; }
.omv-activity-row::before { content: ''; position: absolute; top: 0; bottom: 0; left: 20px; width: 1px; background: var(--omv-line); }
.omv-activity-row:first-child::before { top: 18px; }
.omv-activity-row:last-child::before { bottom: calc(100% - 18px); }
.omv-activity-dot { position: absolute; z-index: 1; left: 17px; top: 15px; width: 7px; height: 7px; border: 2px solid var(--omv-surface); border-radius: 50%; box-sizing: content-box; }
.omv-activity-row strong { display: block; color: var(--omv-text); font-size: 12.5px; font-weight: 500; }
.omv-activity-row p { margin: 4px 0 0; color: var(--omv-faint); font-size: 12px; }

@keyframes omv-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes omv-pop-in { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .omv-detail-backdrop, .omv-detail { animation: none !important; }
}
.omv-detail-backdrop {
  position: absolute; inset: 0; z-index: 5; overflow: auto;
  background: rgba(10, 12, 20, .5); backdrop-filter: blur(3px);
  display: flex; align-items: center; justify-content: center; padding: 32px;
  animation: omv-fade-in .16s ease both;
}
.omv-detail {
  /* Height is capped against the panel's own box (100%), not vh: vh resolves to the whole
     browser window, which is taller than this panel once the host chat composer/task bar
     below it are accounted for, and would let the card spill past the panel's bottom edge. */
  position: relative; z-index: 6; width: min(860px, 100%); max-height: min(100%, 900px); overflow: auto;
  border: 1px solid var(--omv-line); border-radius: 16px; background: var(--omv-surface); box-shadow: var(--omv-shadow-lg);
  animation: omv-pop-in .2s cubic-bezier(.22, .61, .36, 1) both;
}
.omv-detail-head {
  position: sticky; z-index: 2; top: 0; min-height: 64px; padding: 14px 22px; border-bottom: 1px solid var(--omv-line);
  border-radius: 16px 16px 0 0;
  background: color-mix(in srgb, var(--omv-surface) 92%, transparent); backdrop-filter: blur(6px); display: flex; align-items: center; gap: 12px;
  box-shadow: inset 0 -2px 0 0 color-mix(in srgb, var(--omv-violet) 30%, transparent);
}
.omv-detail-head-copy { min-width: 0; flex: 1; }
.omv-detail-head h2 { margin: 0; overflow: hidden; font-size: 16px; font-weight: 650; letter-spacing: -.01em; text-overflow: ellipsis; white-space: nowrap; }
.omv-detail-head p { margin: 4px 0 0; color: var(--omv-faint); font-size: 11px; }
.omv-detail-body { padding: 22px 24px 26px; }
.omv-detail-summary { display: grid; grid-template-columns: 104px 1fr; gap: 18px; margin-bottom: 16px; }
.omv-maturity-hero {
  --maturity: var(--omv-faint); min-height: 100px; padding: 12px; border: 1px solid var(--omv-line); border-radius: 12px;
  background: linear-gradient(150deg, color-mix(in srgb, var(--maturity) 9%, var(--omv-surface)), var(--omv-surface) 70%);
  box-shadow: var(--omv-shadow-xs); display: grid; place-items: center; align-content: center; gap: 5px; text-align: center;
}
.omv-maturity-hero[data-maturity='developing'] { --maturity: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-maturity-hero[data-maturity='supported'] { --maturity: var(--omv-teal); }
.omv-maturity-hero[data-maturity='verified'] { --maturity: var(--dsw-alias-state-success-primary, #329568); }
.omv-maturity-hero[data-maturity='contested'] { --maturity: var(--dsw-alias-state-error-primary, #d44c4c); }
.omv-maturity-hero > i {
  width: 34px; height: 34px; border-radius: 10px; background: color-mix(in srgb, var(--maturity) 14%, transparent);
  color: var(--maturity); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--maturity) 24%, transparent); display: grid; place-items: center;
}
.omv-maturity-hero strong { color: var(--omv-text); font-size: 12.5px; font-weight: 650; }
.omv-maturity-hero small { color: var(--omv-faint); font-size: 10px; }
.omv-summary-copy { padding-top: 3px; }
.omv-summary-copy h3 { margin: 0 0 6px; font-size: 15px; font-weight: 650; letter-spacing: -.01em; }
.omv-summary-copy p { margin: 0; color: var(--omv-muted); font-size: 12.5px; line-height: 1.55; }
.omv-detail-actions { flex-wrap: wrap; margin-top: 12px; }
.omv-section {
  margin-top: 14px; border: 1px solid var(--omv-line); border-radius: 10px; background: var(--omv-surface);
  box-shadow: var(--omv-shadow-xs); transition: box-shadow .16s ease;
}
.omv-section-title { min-height: 42px; padding: 0 14px; border-bottom: 1px solid var(--omv-line); display: flex; align-items: center; justify-content: space-between; }
.omv-section-title h3 { margin: 0; font-size: 12.5px; font-weight: 650; letter-spacing: -.005em; }
.omv-section-title span { color: var(--omv-faint); font-size: 11px; font-variant-numeric: tabular-nums; }
.omv-chain { display: grid; grid-template-columns: 1fr 18px 1fr 18px 1fr; align-items: stretch; padding: 13px; }
.omv-chain-card {
  --chain: var(--omv-violet); appearance: none; position: relative; min-width: 0; padding: 12px 13px; border: 1px solid var(--omv-line); border-radius: 10px;
  background: var(--omv-bg); color: inherit; display: grid; align-content: start; gap: 5px; text-align: left; overflow: hidden;
  transition: border-color .14s ease, background-color .14s ease, transform .14s ease;
}
.omv-chain-card::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--chain); opacity: .7; }
.omv-chain > .omv-chain-card:nth-of-type(1) { --chain: var(--omv-violet); }
.omv-chain > .omv-chain-card:nth-of-type(2) { --chain: var(--omv-red); }
.omv-chain > .omv-chain-card:nth-of-type(3) { --chain: var(--omv-green); }
button.omv-chain-card { cursor: pointer; }
.omv-chain-card[data-openable='true']:hover { border-color: color-mix(in srgb, var(--chain) 45%, var(--omv-line)); background: color-mix(in srgb, var(--chain) 5%, var(--omv-bg)); transform: translateY(-1px); }
.omv-chain-card span { color: var(--omv-faint); font-size: 10px; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
.omv-chain-card code { display: block; overflow: hidden; color: var(--omv-text); font: 11.5px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.omv-chain-card small { display: -webkit-box; overflow: hidden; color: var(--omv-muted); font-size: 11px; line-height: 1.4; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.omv-chain-card em { margin-top: 2px; color: var(--chain); display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-style: normal; font-weight: 600; }
.omv-chain-arrow { display: grid; place-items: center; color: var(--omv-faint); }
.omv-issues { margin: 0; padding: 4px 0; list-style: none; }
.omv-issue { display: grid; grid-template-columns: 7px 1fr; gap: 9px; padding: 9px 14px; border-bottom: 1px solid var(--omv-line); transition: background-color .12s ease; }
.omv-issue:hover { background: var(--omv-hover); }
.omv-issue:last-child { border-bottom: 0; }
.omv-issue-dot { width: 6px; height: 6px; margin-top: 4px; border-radius: 50%; background: var(--issue, var(--omv-blue)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--issue, var(--omv-blue)) 16%, transparent); }
.omv-issue strong { display: block; color: var(--omv-muted); font-size: 11px; font-weight: 500; line-height: 1.4; }
.omv-issue code { display: block; margin-top: 4px; color: var(--omv-faint); font: 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
.omv-session-link { min-height: 66px; padding: 12px 14px; display: flex; align-items: center; gap: 14px; }
.omv-session-link-icon {
  flex: none; width: 32px; height: 32px; border-radius: var(--omv-radius-sm); display: grid; place-items: center;
  background: color-mix(in srgb, var(--omv-teal) 12%, transparent); color: var(--omv-teal);
}
.omv-session-link-icon svg { width: 16px; height: 16px; }
.omv-session-link[data-linked='true'] .omv-session-link-icon { background: color-mix(in srgb, var(--omv-violet) 12%, transparent); color: var(--omv-violet); }
.omv-session-link > div:first-child { flex: 1 1 auto; min-width: 0; display: grid; gap: 3px; }
.omv-session-link strong { color: var(--omv-text); font-size: 12px; font-weight: 500; }
.omv-session-link code { overflow: hidden; color: var(--omv-faint); font: 10.5px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-session-link span { color: var(--omv-muted); font-size: 11.5px; }
.omv-session-link > div:last-child { flex: none; display: flex; gap: 6px; }
.omv-session-link button { min-height: 30px; padding: 0 11px; font-size: 11px; }
.omv-workflow-actions { padding: 11px 14px; display: flex; flex-wrap: wrap; gap: 7px; }
.omv-workflow-actions button { min-height: 32px; padding: 0 12px; font-size: 11px; }
.omv-diff > div { min-height: 34px; padding: 0 14px; border-bottom: 1px solid var(--omv-line); display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--omv-muted); font-size: 11px; }
.omv-diff > div code { color: var(--omv-faint); font: 10.5px/1.4 ui-monospace, monospace; }
.omv-diff pre { max-height: 240px; margin: 0; padding: 12px 14px; overflow: auto; background: var(--omv-bg); color: var(--omv-muted); font: 10.5px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.omv-history { position: relative; margin: 0; padding: 3px 0; list-style: none; }
.omv-history li { position: relative; min-height: 43px; padding: 7px 14px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 9px; }
.omv-history li::before { content: ''; position: absolute; top: 0; bottom: 0; left: 17px; width: 1px; background: var(--omv-line); }
.omv-history li:first-child::before { top: 50%; }
.omv-history li:last-child::before { bottom: 50%; }
.omv-history li:last-child { border-bottom: 0; }
.omv-history li > i { position: relative; z-index: 1; width: 6px; height: 6px; border-radius: 50%; box-shadow: 0 0 0 3px var(--omv-surface); }
.omv-history li > div { min-width: 0; display: grid; gap: 2px; }
.omv-history strong { color: var(--omv-muted); font-size: 11px; font-weight: 500; }
.omv-history span { overflow: hidden; color: var(--omv-faint); font: 10.5px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-history b { color: var(--omv-faint); font-size: 10.5px; font-weight: 500; }
.omv-run-head { min-height: 52px; padding: 9px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.omv-run-head > div:first-child { min-width: 0; display: grid; gap: 3px; }
.omv-run-head strong { color: var(--omv-text); font: 11px/1.4 ui-monospace, monospace; }
.omv-run-head span { color: var(--omv-faint); font-size: 10.5px; }
.omv-run-head > div:last-child { display: flex; gap: 6px; }
.omv-run-progress { position: relative; height: 5px; margin: 0 14px 2px; overflow: hidden; border-radius: 999px; background: var(--omv-line); }
.omv-run-progress i { position: absolute; top: 0; bottom: 0; display: block; transition: width .2s ease, left .2s ease; }
.omv-run-progress i[data-kind='completed'] { background: var(--dsw-alias-state-success-primary, #329568); }
.omv-run-progress i[data-kind='attention'] { background: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-run-progress i[data-kind='pending'] { background: color-mix(in srgb, var(--omv-blue) 34%, var(--omv-line)); }
.omv-gate-checks, .omv-repro-runs { margin: 0; padding: 3px 0; list-style: none; }
.omv-gate-summary { padding: 10px 14px; border-bottom: 1px solid var(--omv-line); background: var(--omv-bg); color: var(--omv-muted); font-size: 11px; line-height: 1.5; }
.omv-gate-checks li { min-height: 46px; padding: 7px 14px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 22px minmax(0, 1fr) auto; align-items: center; gap: 8px; }
.omv-gate-checks li:last-child, .omv-repro-runs li:last-child { border-bottom: 0; }
.omv-gate-checks li > i { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; background: var(--omv-bg); color: var(--omv-faint); }
.omv-gate-checks li[data-state='supported'] > i, .omv-gate-checks li[data-state='verified'] > i, .omv-gate-checks li[data-state='not_applicable'] > i { background: var(--dsw-alias-state-success-secondary, #e9f7f0); color: var(--dsw-alias-state-success-primary, #329568); }
.omv-gate-checks li[data-state='partial'] > i { background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b7791f) 10%, transparent); color: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-gate-checks li[data-blocking='true'][data-state='missing'] > i { background: var(--dsw-alias-state-error-secondary, #fdecec); color: var(--dsw-alias-state-error-primary, #d44c4c); }
.omv-gate-checks li > div { min-width: 0; display: grid; gap: 2px; }
.omv-gate-checks strong { color: var(--omv-muted); font-size: 11px; font-weight: 500; }
.omv-gate-checks span, .omv-gate-checks small { color: var(--omv-faint); font-size: 10.5px; }
.omv-assessment-dimensions { margin: 0; padding: 3px 0; list-style: none; }
.omv-assessment-dimensions li { --dimension: var(--omv-faint); min-height: 52px; padding: 8px 14px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 10px; transition: background-color .12s ease; }
.omv-assessment-dimensions li:hover { background: var(--omv-hover); }
.omv-assessment-dimensions li:last-child { border-bottom: 0; }
.omv-assessment-dimensions li[data-state='partial'] { --dimension: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-assessment-dimensions li[data-state='supported'] { --dimension: var(--omv-teal); }
.omv-assessment-dimensions li[data-state='verified'] { --dimension: var(--dsw-alias-state-success-primary, #329568); }
.omv-assessment-dimensions li > i { width: 6px; height: 20px; border-radius: 3px; background: var(--dimension); }
.omv-assessment-dimensions li > div { min-width: 0; display: grid; gap: 2px; }
.omv-assessment-dimensions strong { color: var(--omv-muted); font-size: 11px; font-weight: 500; }
.omv-assessment-dimensions span { color: var(--omv-faint); font-size: 10.5px; line-height: 1.4; }
.omv-assessment-dimensions code { color: var(--omv-blue); font: 10px/1.4 ui-monospace, monospace; }
.omv-graph-flow { padding: 11px; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.omv-graph-flow article { position: relative; min-width: 0; min-height: 84px; padding: 10px; border: 1px solid var(--omv-line); border-radius: 8px; background: var(--omv-bg); display: grid; align-content: start; gap: 4px; transition: border-color .14s ease, background-color .14s ease, transform .14s ease; }
.omv-graph-flow article[data-state='verified'] { border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #329568) 35%, var(--omv-line)); }
.omv-graph-flow article[data-state='unknown'] { opacity: .62; }
.omv-graph-flow article[data-openable='true'] { cursor: pointer; }
.omv-graph-flow article[data-openable='true']:hover { border-color: color-mix(in srgb, var(--omv-blue) 42%, var(--omv-line)); background: color-mix(in srgb, var(--omv-blue) 4%, var(--omv-bg)); transform: translateY(-1px); }
.omv-graph-flow span { color: var(--omv-blue); font-size: 9px; text-transform: uppercase; letter-spacing: .04em; }
.omv-graph-flow strong { color: var(--omv-muted); font-size: 11px; font-weight: 500; }
.omv-graph-flow code { display: -webkit-box; overflow: hidden; color: var(--omv-faint); font: 10px/1.4 ui-monospace, monospace; overflow-wrap: anywhere; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.omv-graph-flow small { color: var(--omv-faint); font-size: 10px; }
.omv-repro-runs li { min-height: 48px; padding: 7px 14px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 9px; transition: background-color .12s ease; }
.omv-repro-runs li:hover { background: var(--omv-hover); }
.omv-repro-runs li > div { min-width: 0; display: grid; gap: 2px; }
.omv-repro-runs strong { overflow: hidden; color: var(--omv-muted); font: 11px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-repro-runs span { color: var(--omv-faint); font-size: 10.5px; }

/* 1.0 workbench surfaces: quiet DSH-native cards with clear action density. */
.omv-panel-meta { margin-left: auto; color: var(--omv-faint); font-size: 10.5px; }
.omv-hero-status { min-height: 32px; padding: 0 10px; border: 1px solid var(--omv-line); border-radius: 7px; background: var(--omv-surface); color: var(--omv-muted); display: inline-flex; align-items: center; gap: 7px; font-size: 11px; }
.omv-hero-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--omv-faint); }
.omv-hero-status i[data-state='live'] { background: var(--dsw-alias-state-success-primary, #329568); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary, #329568) 12%, transparent); }
.omv-hero-status i[data-state='warn'] { background: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-quality-hero { min-height: 128px; margin-bottom: 12px; padding: 18px; border: 1px solid var(--omv-line); border-radius: 9px; background: linear-gradient(115deg, color-mix(in srgb, var(--omv-blue) 8%, var(--omv-surface)), var(--omv-surface) 58%); display: grid; grid-template-columns: 190px 1fr minmax(180px, .8fr); align-items: center; gap: 24px; }
.omv-quality-score { display: grid; gap: 3px; }
.omv-quality-score > span { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--omv-muted); font-size: 11px; }
.omv-quality-score > span b { color: var(--omv-faint); font-size: 10px; font-weight: 560; }
.omv-quality-score strong { color: var(--omv-text); font-size: 30px; line-height: 1; font-weight: 650; letter-spacing: -.05em; }
.omv-quality-score[data-state='blocker'] strong { color: var(--dsw-alias-state-error-primary, #d44c4c); }
.omv-quality-score[data-state='warning'] strong { color: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-quality-score[data-state='info'] strong { color: var(--omv-blue); }
.omv-quality-score[data-state='clear'] strong { color: var(--dsw-alias-state-success-primary, #329568); }
.omv-quality-score small { color: var(--omv-faint); font-size: 10px; line-height: 1.4; }
.omv-quality-signal-track { height: 4px; overflow: hidden; border-radius: 3px; background: var(--omv-line); }
.omv-quality-signal-track i { display: block; height: 100%; border-radius: inherit; background: currentColor; color: var(--omv-blue); transition: width .35s ease; }
.omv-quality-score[data-state='blocker'] .omv-quality-signal-track i { color: var(--dsw-alias-state-error-primary, #d44c4c); }
.omv-quality-score[data-state='warning'] .omv-quality-signal-track i { color: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-quality-score[data-state='clear'] .omv-quality-signal-track i { color: var(--dsw-alias-state-success-primary, #329568); }
.omv-quality-counts { display: flex; align-items: stretch; gap: 1px; }
.omv-quality-counts div { min-width: 74px; padding: 9px 13px; border-left: 1px solid var(--omv-line); display: grid; gap: 2px; }
.omv-quality-counts b { color: var(--omv-text); font-size: 20px; font-weight: 600; }
.omv-quality-counts span { color: var(--omv-faint); font-size: 10.5px; }
.omv-quality-summary { padding-left: 16px; border-left: 1px solid var(--omv-line); color: var(--omv-muted); font-size: 12px; line-height: 1.55; }
 .omv-quality-queues { margin-bottom: 12px; overflow: hidden; border: 1px solid var(--omv-line); border-radius: var(--omv-radius-md); background: var(--omv-surface); }
.omv-quality-queue-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 1px; background: var(--omv-line); }
.omv-quality-queue { position: relative; min-height: 104px; padding: 13px 30px 12px 13px; border: 0; background: var(--omv-surface); color: var(--omv-text); display: grid; align-content: start; gap: 3px; text-align: left; cursor: pointer; }
.omv-quality-queue:hover { background: var(--omv-hover); }
.omv-quality-queue > span { color: var(--omv-muted); font-size: 11px; }
.omv-quality-queue > strong { font-size: 24px; font-weight: 650; line-height: 1.05; }
.omv-quality-queue > small { color: var(--omv-faint); font-size: 10px; line-height: 1.4; }
.omv-quality-queue > svg { position: absolute; right: 11px; top: 16px; color: var(--omv-faint); }
.omv-quality-issues { overflow: hidden; }
.omv-quality-issues > ul,
.omv-repro-board > ul{ margin: 0; padding: 3px 0; list-style: none; }
.omv-quality-issue { min-height: 66px; padding: 9px 13px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 7px minmax(0, 1fr) auto; align-items: center; gap: 10px; }
.omv-quality-issue:last-child,
.omv-repro-card:last-child{ border-bottom: 0; }
.omv-quality-issue[role='button'] { cursor: pointer; }
.omv-quality-issue[role='button']:hover { background: var(--omv-hover); }
.omv-quality-issue > i { width: 6px; height: 6px; border-radius: 50%; background: var(--omv-blue); }
.omv-quality-issue[data-severity='blocker'] > i { background: var(--dsw-alias-state-error-primary, #d44c4c); }
.omv-quality-issue[data-severity='warning'] > i { background: var(--dsw-alias-state-warn-primary, #b7791f); }
.omv-quality-issue > div { min-width: 0; display: grid; gap: 2px; }
.omv-quality-issue strong { color: var(--omv-text); font-size: 12px; font-weight: 500; }
.omv-quality-issue span { color: var(--omv-muted); font-size: 11px; line-height: 1.4; }
.omv-quality-issue code { overflow: hidden; color: var(--omv-faint); font: 10px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-quality-issue small { color: var(--omv-blue); font-size: 10px; }
.omv-repro-metrics { margin-bottom: 12px; }
.omv-repro-board{ overflow: hidden; }
.omv-repro-card { padding: 12px 13px; border-bottom: 1px solid var(--omv-line); display: grid; gap: 7px; }
.omv-repro-card-head{ min-width: 0; display: flex; align-items: center; gap: 8px; }
.omv-repro-card-head code { margin-left: auto; color: var(--omv-faint); font: 10px/1.4 ui-monospace, monospace; }
.omv-repro-card > strong { color: var(--omv-text); font: 11.5px/1.45 ui-monospace, monospace; overflow-wrap: anywhere; }
.omv-repro-card > p { margin: 0; color: var(--omv-faint); font-size: 10.5px; }
.omv-repro-card pre { max-height: 120px; margin: 0; padding: 8px 9px; overflow: auto; border-radius: 6px; background: var(--omv-bg); color: var(--omv-muted); font: 10px/1.5 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.omv-repro-card-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--omv-faint); font-size: 10.5px; }
.omv-repro-card-foot .omv-secondary { min-height: 28px; padding: 0 10px; font-size: 10.5px; }
.omv-link-button { min-width: 0; padding: 0; border: 0; background: transparent; color: var(--omv-blue); display: inline-flex; align-items: center; gap: 4px; cursor: pointer; font: 11.5px/1.4 ui-monospace, monospace; }
.omv-link-button:hover { color: color-mix(in srgb, var(--omv-blue) 78%, var(--omv-text)); text-decoration: underline; }.omv-inline-empty { padding-bottom: 8px; display: grid; justify-items: center; gap: 0; }
.omv-inline-empty .omv-secondary { margin-top: -3px; min-height: 30px; font-size: 11px; }
.omv-section-footer { padding: 8px 12px; border-top: 1px solid var(--omv-line); }
.omv-section-footer .omv-secondary { min-height: 30px; font-size: 11px; }
.omv-surface-issue { margin: 0; padding: 10px 14px; color: var(--dsw-alias-state-warn-primary, #b7791f); font-size: 11.5px; line-height: 1.45; }
.omv-surface-cards { margin: 0; padding: 0; list-style: none; }
.omv-surface-card { position: relative; padding: 14px 16px 13px; border-bottom: 1px solid var(--omv-line); display: grid; gap: 8px; transition: background-color .12s ease; }
.omv-surface-card:hover { background: var(--omv-hover); }
.omv-surface-card:last-child { border-bottom: 0; }
.omv-surface-card::before { content: ''; position: absolute; top: 14px; bottom: 13px; left: 0; width: 3px; border-radius: 0 3px 3px 0; background: var(--omv-line); }
.omv-surface-card[data-status='selected']::before { background: var(--omv-green); }
.omv-surface-card[data-status='proposed']::before { background: var(--omv-blue); }
.omv-surface-card[data-status='skipped'] { color: var(--omv-faint); }
.omv-surface-card[data-status='skipped']::before { background: var(--omv-faint); }
.omv-surface-card-head { min-width: 0; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.omv-surface-card-head > div { min-width: 0; display: grid; gap: 3px; }
.omv-surface-kicker { color: var(--omv-faint); font-size: 10px; letter-spacing: .03em; }
.omv-surface-card-head strong { overflow: hidden; color: var(--omv-text); font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.omv-surface-card > p { margin: 0; color: var(--omv-muted); font-size: 12px; line-height: 1.5; }
.omv-surface-lists { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; padding: 10px 11px; border: 1px solid var(--omv-line); border-radius: 9px; background: var(--omv-bg); }
.omv-surface-lists div { min-width: 0; display: grid; gap: 3px; }
.omv-surface-lists span { color: var(--omv-faint); font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
.omv-surface-lists small { color: var(--omv-muted); font-size: 11px; line-height: 1.45; }
.omv-surface-fp { color: var(--omv-faint); font-size: 11px; line-height: 1.45; }
.omv-surface-actions { display: flex; align-items: center; gap: 6px; }
.omv-surface-actions code { margin-right: auto; overflow: hidden; color: var(--omv-faint); font: 10.5px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-surface-actions .omv-secondary { min-height: 28px; padding: 0 10px; font-size: 11px; }
.omv-dedup-head{ min-height: 58px; padding: 11px 14px; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.omv-dedup-head > div{ min-width: 0; display: grid; gap: 3px; }
.omv-dedup-head strong{ color: var(--omv-muted); font-size: 11px; font-weight: 500; }
.omv-dedup-head span{ color: var(--omv-faint); font-size: 10.5px; }
.omv-dedup-head .omv-secondary{ min-height: 30px; padding: 0 10px; font-size: 10.5px; }
.omv-dedup-list{ margin: 0; padding: 3px 0; list-style: none; border-top: 1px solid var(--omv-line); }
.omv-dedup-list li { min-height: 58px; padding: 8px 14px; border-bottom: 1px solid var(--omv-line); display: flex; align-items: center; justify-content: space-between; gap: 10px; transition: background-color .12s ease; }
.omv-dedup-list li:hover { background: var(--omv-hover); }
.omv-dedup-list li:last-child{ border-bottom: 0; }
.omv-dedup-list li > div:first-child { min-width: 0; display: grid; gap: 2px; }
.omv-dedup-list strong { color: var(--omv-muted); font-size: 11px; font-weight: 500; }
.omv-dedup-list span { color: var(--omv-faint); font-size: 10px; }
.omv-dedup-list code { color: var(--omv-faint); font: 9.5px/1.4 ui-monospace, monospace; }
.omv-dedup-actions { flex: none; display: flex; align-items: center; gap: 5px; }
.omv-dedup-actions .omv-secondary { min-height: 28px; padding: 0 8px; font-size: 10px; }
.omv-dedup-sources { margin: 4px 14px 10px; padding: 10px 11px; border: 1px solid var(--omv-line); border-radius: 9px; background: color-mix(in srgb, var(--omv-surface) 92%, var(--omv-blue) 8%); }
.omv-dedup-sources[data-complete] { background: color-mix(in srgb, var(--omv-surface) 92%, var(--omv-green) 8%); }
.omv-dedup-sources-head { display: grid; gap: 2px; margin-bottom: 7px; }
.omv-dedup-sources-head span { color: var(--omv-muted); font-size: 11px; font-weight: 600; }
.omv-dedup-sources-head b { color: var(--omv-muted); font-size: 10.5px; font-weight: 600; }
.omv-dedup-sources[data-complete] .omv-dedup-sources-head b { color: var(--omv-green); }
.omv-dedup-sources-head small { color: var(--omv-faint); font-size: 10px; }
.omv-dedup-sources ul { margin: 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.omv-dedup-sources li { min-height: 26px; padding: 3px 7px; border: 1px solid var(--omv-line); border-radius: 6px; background: var(--omv-surface); display: flex; align-items: center; gap: 5px; }
.omv-dedup-sources li i { flex: none; width: 14px; height: 14px; border-radius: 4px; display: grid; place-items: center; color: #fff; background: var(--omv-faint); font-size: 9px; font-style: normal; }
.omv-dedup-sources li[data-searched] i { background: var(--omv-green); }
.omv-dedup-sources li[data-group='discussion']:not([data-searched]) { border-color: color-mix(in srgb, var(--omv-orange) 45%, var(--omv-line)); }
.omv-dedup-sources li span { overflow: hidden; color: var(--omv-muted); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
.omv-dedup-sources li em { margin-left: auto; color: var(--omv-faint); font-size: 9px; font-style: normal; }
.omv-dedup-sources li[data-searched] em { color: var(--omv-green); }
.omv-dedup-cve { margin-top: 7px; color: var(--omv-faint); font-size: 10px; display: flex; align-items: center; gap: 5px; }
.omv-dedup-cve code { color: var(--omv-muted); font: 10px/1.4 ui-monospace, monospace; }
.omv-dedup-cve b { color: var(--omv-red); font-size: 10px; }
.omv-next-chip { margin-top: 8px; padding: 7px 10px; border: 1px solid color-mix(in srgb, var(--omv-blue) 35%, var(--omv-line)); border-radius: 8px; background: color-mix(in srgb, var(--omv-blue) 7%, var(--omv-surface)); box-shadow: var(--omv-shadow-xs); display: flex; align-items: baseline; gap: 7px; }
.omv-next-chip span { flex: none; color: var(--omv-blue); font-size: 10px; font-weight: 600; }
.omv-next-chip code { color: var(--omv-muted); font: 10.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.omv-field-error { margin-top: 3px; color: var(--omv-red); font-size: 10.5px; }
.omv-flow { display: grid; gap: 0; border: 1px solid var(--omv-line); border-radius: 10px; overflow: hidden; background: color-mix(in srgb, var(--omv-bg) 55%, var(--omv-surface)); }
.omv-flow-toolbar { min-height: 34px; padding: 0 8px 0 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--omv-line); background: var(--omv-surface); }
.omv-flow-legend { display: flex; align-items: center; gap: 10px; color: var(--omv-faint); font-size: 10px; }
.omv-flow-legend span { display: flex; align-items: center; gap: 4px; }
.omv-flow-legend i { width: 8px; height: 8px; border-radius: 3px; }
.omv-flow-legend .omv-flow-legend-dash { width: 18px; height: 0; border-top: 2px dashed var(--omv-faint); border-radius: 0; }
.omv-flow-zoom { display: flex; gap: 4px; }
.omv-flow-zoom button { min-width: 26px; height: 22px; padding: 0 6px; border: 1px solid var(--omv-line); border-radius: 5px; background: var(--omv-surface); color: var(--omv-muted); font-size: 11px; cursor: pointer; }
.omv-flow-zoom button:hover { background: var(--omv-hover); }
.omv-flow-canvas { position: relative; height: 320px; overflow: hidden; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.omv-flow-canvas:active { cursor: grabbing; }
.omv-flow-canvas svg { display: block; }
.omv-flow-edge { opacity: .8; }
.omv-flow-node { cursor: pointer; }
.omv-flow-node rect:first-of-type { fill: var(--omv-surface); stroke: var(--omv-line); stroke-width: 1; }
.omv-flow-node:hover rect:first-of-type { stroke: color-mix(in srgb, var(--omv-blue) 55%, var(--omv-line)); }
.omv-flow-node.selected rect:first-of-type { stroke: var(--omv-blue); stroke-width: 1.6; filter: drop-shadow(0 1px 4px color-mix(in srgb, var(--omv-blue) 26%, transparent)); }
.omv-flow-node[data-state='unknown'] rect:first-of-type { stroke-dasharray: 5 4; fill: color-mix(in srgb, var(--omv-surface) 88%, var(--omv-bg)); }
.omv-flow-node[data-state='verified'] rect:first-of-type { stroke: color-mix(in srgb, var(--omv-green) 45%, var(--omv-line)); }
.omv-flow-node[data-kind='finding'] rect:first-of-type { stroke-width: 1.6; }
.omv-flow-node-kind { fill: var(--omv-muted); font-size: 9.5px; font-weight: 600; letter-spacing: .02em; }
.omv-flow-node-value { fill: var(--omv-text); font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.omv-flow-verified-dot { fill: var(--omv-green); }
.omv-flow-file-badge rect { fill: color-mix(in srgb, var(--omv-blue) 14%, var(--omv-surface)); stroke: var(--omv-blue); stroke-width: 1; }
.omv-flow-file-badge path { stroke: var(--omv-blue); stroke-width: 1.1; fill: none; }
.omv-flow-crack { stroke: var(--omv-orange); stroke-width: 1.6; fill: none; stroke-linecap: round; }
.omv-flow-inspector { min-height: 46px; padding: 7px 12px; display: flex; align-items: center; gap: 9px; border-top: 1px solid var(--omv-line); background: var(--omv-surface); }
.omv-flow-inspector-empty { color: var(--omv-faint); font-size: 10.5px; }
.omv-flow-inspector-kind { flex: none; padding: 2.5px 7px; border-radius: 5px; color: #fff; font-size: 9.5px; font-weight: 600; }
.omv-flow-inspector-copy { min-width: 0; display: grid; gap: 1px; }
.omv-flow-inspector-copy strong { overflow: hidden; color: var(--omv-text); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.omv-flow-inspector-copy span { overflow: hidden; color: var(--omv-muted); font-size: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-flow-inspector-copy small { color: var(--omv-faint); font-size: 9.5px; }
.omv-flow-inspector .omv-secondary { min-height: 27px; padding: 0 9px; font-size: 10px; }
.omv-flow-hint { position: absolute; right: 10px; bottom: 54px; padding: 2px 7px; border-radius: 5px; background: color-mix(in srgb, var(--omv-surface) 82%, transparent); color: var(--omv-faint); font-size: 9px; pointer-events: none; }
.omv-flow { position: relative; }
.omv-modal-backdrop { position: absolute; inset: 0; z-index: 10; display: grid; place-items: center; padding: 20px; background: rgba(0, 0, 0, .24); }
.omv-modal { width: min(480px, 100%); max-height: calc(100% - 20px); overflow: auto; border: 1px solid var(--omv-line); border-radius: 10px; background: var(--omv-surface); box-shadow: 0 16px 48px rgba(0, 0, 0, .14); }
.omv-command-palette { width: min(560px, 100%); max-height: min(620px, calc(100% - 20px)); overflow: hidden; border: 1px solid var(--omv-line); border-radius: 10px; background: var(--omv-surface); box-shadow: 0 16px 48px rgba(0, 0, 0, .16); }
.omv-command-palette-head { min-height: 54px; padding: 9px 11px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 16px minmax(0, 1fr) auto; align-items: center; gap: 7px; color: var(--omv-faint); }
.omv-command-palette-head .omv-input { height: 34px; border: 0; box-shadow: none; background: transparent; }
.omv-command-palette-head kbd { color: var(--omv-faint); font: 9px/1.2 ui-monospace, monospace; }
.omv-command-palette > ul { max-height: 500px; margin: 0; padding: 5px; overflow: auto; list-style: none; }
.omv-command-palette > ul li { margin: 1px 0; }
.omv-command-palette-item { width: 100%; min-height: 36px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: var(--omv-muted); display: flex; align-items: center; justify-content: space-between; text-align: left; cursor: pointer; font-size: 12px; }
.omv-command-palette-item:hover, .omv-command-palette-item.active { background: var(--omv-hover); color: var(--omv-text); }
.omv-command-palette-item kbd { min-width: 30px; padding: 3px 5px; border: 1px solid var(--omv-line); border-radius: 4px; color: var(--omv-faint); font: 9px/1.2 ui-monospace, monospace; text-align: center; }
.omv-modal-head { min-height: 52px; padding: 0 15px; border-bottom: 1px solid var(--omv-line); display: flex; align-items: center; }
.omv-modal-head h2 { margin: 0; font-size: 15px; font-weight: 600; }
.omv-modal-head .omv-icon-button { margin-left: auto; }
.omv-form { padding: 16px; }
.omv-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.omv-field { display: grid; gap: 6px; }
.omv-field-full { grid-column: 1 / -1; }
.omv-field label { color: var(--omv-muted); font-size: 12px; font-weight: 500; }
.omv-form-note { margin: 12px 0 0; padding: 10px; border-radius: 7px; background: var(--omv-bg); color: var(--omv-muted); font-size: 12px; line-height: 1.45; }
.omv-form-actions { justify-content: flex-end; margin-top: 16px; }
.omv-toast { position: absolute; z-index: 20; top: 72px; left: 50%; max-width: min(460px, calc(100% - 24px)); transform: translateX(-50%); padding: 9px 9px 9px 13px; border: 1px solid var(--omv-line); border-radius: 7px; background: var(--omv-surface); color: var(--dsw-alias-state-success-primary, #329568); box-shadow: 0 8px 24px rgba(0, 0, 0, .1); font-size: 12px; display: flex; align-items: center; gap: 10px; }
.omv-toast span { min-width: 0; line-height: 1.45; }
.omv-toast button { flex: none; width: 24px; height: 24px; padding: 0; border: 0; border-radius: 5px; background: transparent; color: currentColor; display: grid; place-items: center; cursor: pointer; }
.omv-toast button:hover { background: var(--omv-hover); }
.omv-toast[data-kind='error'] { color: var(--dsw-alias-state-error-primary, #c94b4b); }
.omv-error { padding: 12px; border: 1px solid var(--omv-line); border-radius: 8px; background: var(--dsw-alias-state-error-secondary, #fdecec); color: var(--dsw-alias-state-error-primary, #c94b4b); font-size: 12.5px; }
.omv-error-state { width: min(640px, 100%); margin: 8vh auto 0; padding: 24px; border: 1px solid var(--omv-line); border-radius: 12px; background: var(--omv-surface); box-shadow: 0 10px 32px rgba(0, 0, 0, .05); }
.omv-error-icon { width: 34px; height: 34px; margin-bottom: 14px; border-radius: 9px; background: var(--dsw-alias-state-error-secondary, #fdecec); color: var(--dsw-alias-state-error-primary, #c94b4b); display: grid; place-items: center; }
.omv-error-state .omv-eyebrow { margin-bottom: 5px; color: var(--dsw-alias-state-error-primary, #c94b4b); }
.omv-error-state h2 { margin: 0; color: var(--omv-text); font-size: 19px; line-height: 1.35; font-weight: 650; letter-spacing: -.02em; }
.omv-error-lead { margin: 8px 0 0; color: var(--omv-muted); font-size: 13px; line-height: 1.6; }
.omv-error-paths { margin-top: 16px; padding: 10px 12px; border: 1px solid var(--omv-line); border-radius: 7px; background: var(--omv-bg); display: grid; gap: 8px; }
.omv-error-paths > div { min-width: 0; display: grid; grid-template-columns: 78px minmax(0, 1fr); align-items: baseline; gap: 10px; }
.omv-error-paths span { color: var(--omv-faint); font-size: 11px; }
.omv-error-paths code { min-width: 0; overflow: hidden; color: var(--omv-muted); font: 10.5px/1.4 ui-monospace, monospace; text-overflow: ellipsis; white-space: nowrap; }
.omv-error-actions { margin-top: 16px; display: flex; flex-wrap: wrap; gap: 8px; }
.omv-error-details { margin-top: 18px; border-top: 1px solid var(--omv-line); padding-top: 11px; color: var(--omv-faint); font-size: 11px; }
.omv-error-details summary { cursor: pointer; color: var(--omv-muted); }
.omv-error-details pre { max-height: 130px; margin: 8px 0 0; padding: 9px; overflow: auto; border-radius: 6px; background: var(--omv-bg); color: var(--omv-faint); font: 10.5px/1.5 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
.omv-loading { min-height: 360px; display: grid; place-items: center; color: var(--omv-faint); font-size: 12px; }
.omv-spinner { width: 20px; height: 20px; margin: 0 auto 10px; border: 2px solid var(--omv-line); border-top-color: var(--omv-blue); border-radius: 50%; animation: omv-spin .8s linear infinite; }
@keyframes omv-spin { to { transform: rotate(360deg); } }

.omv-settings { width: 100%; max-width: 680px; padding: 4px 2px 24px; }
.omv-settings-title { display: flex; align-items: center; gap: 12px; margin: 2px 0 22px; }
.omv-settings-title > svg { color: var(--omv-blue); }
.omv-settings-title h2 { margin: 0; color: var(--omv-text); font: var(--dsw-font-l-strong-18, 600 18px/1.3 sans-serif); }
.omv-settings-title p { margin: 3px 0 0; color: var(--omv-faint); font: var(--dsw-font-xxs-12, 12px/1.4 sans-serif); }
 .omv-settings-card { overflow: hidden; border: 1px solid var(--omv-line); border-radius: var(--omv-radius-md); background: var(--omv-surface); }
.omv-settings-row { min-height: 48px; padding: 0 14px; border-bottom: 1px solid var(--omv-line); display: grid; grid-template-columns: 124px minmax(0, 1fr); align-items: center; gap: 16px; }
.omv-settings-row:last-child { border-bottom: 0; }
.omv-settings-row > span { color: var(--omv-muted); font-size: 12.5px; }
.omv-settings-row > b { color: var(--omv-text); font-size: 12.5px; font-weight: 500; text-align: right; }
.omv-settings-row > code { min-width: 0; overflow: hidden; color: var(--omv-faint); font: 11.5px/1.4 ui-monospace, monospace; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
.omv-settings-select { min-width: 132px; height: 30px; padding: 0 8px; border: 1px solid var(--omv-line); border-radius: 6px; background: var(--omv-surface); color: var(--omv-text); font: inherit; justify-self: end; }
.omv-settings-select:focus { outline: 0; border-color: var(--omv-blue); box-shadow: 0 0 0 2px color-mix(in srgb, var(--omv-blue) 14%, transparent); }
.omv-settings-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
.omv-settings-help { margin: 20px 0 0; color: var(--omv-faint); font-size: 12px; line-height: 1.6; }

@media (prefers-reduced-motion: reduce) {
  .omv-native-view *, .omv-native-view *::before, .omv-native-view *::after,
  .omv-settings *, .omv-settings *::before, .omv-settings *::after {
    animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important;
  }
}

@media (max-width: 900px) {
  .omv-workspace-path { display: none; }
  .omv-sync-meta { max-width: 86px; }
  .omv-content { padding: 22px 18px 32px; }
  .omv-grid { grid-template-columns: 1fr; }
  .omv-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .omv-campaigns { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .omv-quality-hero { grid-template-columns: 160px 1fr; }
  .omv-quality-summary { grid-column: 1 / -1; padding: 10px 0 0; border-top: 1px solid var(--omv-line); border-left: 0; }
  .omv-quality-queue-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 620px) {
  .omv-native-toolbar { padding: 0 6px; gap: 6px; }
  .omv-nav { flex: 1; }
  .omv-nav-button { min-width: 0; flex: 1; padding: 0 5px; font-size: 12.5px; }
  .omv-nav-count { display: none; }
  .omv-live, .omv-sync-meta { display: none; }
  .omv-palette-button span, .omv-palette-button kbd { display: none; }
  .omv-palette-button { width: 28px; padding: 0; justify-content: center; }
  .omv-content { padding: 18px 12px 26px; }
  .omv-hero { align-items: flex-start; flex-direction: column; }
  .omv-hero h2 { font-size: 20px; }
  .omv-metrics { grid-template-columns: 1fr 1fr; }
  .omv-queue-row { grid-template-columns: 1fr 78px 16px; }
  .omv-next { display: none; }
  .omv-campaigns { grid-template-columns: 1fr; }
  .omv-list-head { grid-template-columns: minmax(0, 1.6fr) 104px minmax(0, .9fr); }
  .omv-list-head > span:nth-child(3), .omv-list-head > span:nth-child(5) { display: none; }
  .omv-finding-row { grid-template-columns: minmax(0, 1.6fr) 104px minmax(0, .9fr); }
  .omv-finding-row > .omv-eco-chip, .omv-finding-row > code.omv-cell-mono { display: none; }
  .omv-form-grid { grid-template-columns: 1fr; }
  .omv-field-full { grid-column: auto; }
  .omv-chain { grid-template-columns: 1fr; gap: 7px; }
  .omv-chain-arrow { transform: rotate(90deg); }
  .omv-surface-lists { grid-template-columns: 1fr; }
  .omv-detail-summary { grid-template-columns: 82px 1fr; }
  .omv-graph-flow { grid-template-columns: 1fr; }
      .omv-ring { width: 78px; height: 78px; }
  .omv-ring::before { width: 66px; height: 66px; }
  .omv-error-state { margin-top: 3vh; padding: 18px; }
  .omv-error-paths > div { grid-template-columns: 1fr; gap: 2px; }
  .omv-quality-hero { grid-template-columns: 1fr; gap: 13px; }
  .omv-quality-counts { border-top: 1px solid var(--omv-line); padding-top: 10px; }
  .omv-quality-summary { grid-column: auto; }
  .omv-quality-queue-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .omv-quality-queue { min-height: 94px; }
  .omv-dedup-list li { align-items: flex-start; flex-direction: column; }
  .omv-dedup-actions { align-self: flex-end; }
}

/* ------------------------------------------------------------------------
 * DSH-native visual refresh
 *
 * The workbench intentionally stays quiet and information-dense, but gains
 * stronger rhythm, hierarchy and focus states. All colors still resolve
 * through DSH aliases so the surface follows the host theme.
 * ---------------------------------------------------------------------- */
.wSkVaW_viewArea:has(.omv-native-view) {
  min-height: 0 !important;
  height: 100% !important;
  flex: 1 1 0% !important;
  overflow: hidden !important;
}
.omv-native-view {
  --omv-bg: var(--dsw-alias-bg-layer-1, #f7f7f8);
  --omv-surface: var(--dsw-alias-bg-layer-2, #fff);
  --omv-line: var(--dsw-alias-border-l2, #e5e6e8);
  --omv-hover: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .045));
  flex: 1 1 0%;
  height: auto;
  max-height: 100%;
  min-height: 0;
  isolation: isolate;
}
.omv-native-toolbar {
  position: sticky;
  top: 0;
  z-index: 4;
  min-height: 48px;
  padding: 0 14px;
  gap: 12px;
  background: var(--omv-bg);
  box-shadow: 0 1px 0 var(--omv-line);
  backdrop-filter: none;
}
.omv-nav {
  gap: 2px; padding: 4px; border-radius: 999px;
  background: color-mix(in srgb, var(--omv-line) 45%, var(--omv-bg));
}
.omv-nav-button {
  min-width: 66px;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  flex: 0 0 auto;
  color: var(--omv-faint);
  font-size: 12px;
  font-weight: 500;
  transition: color .15s ease, background-color .15s ease, box-shadow .15s ease;
}
.omv-nav-button span { white-space: nowrap; }
.omv-nav-button svg { opacity: .72; }
.omv-nav-button:hover { color: var(--omv-text); background: var(--omv-hover); }
.omv-nav-button[data-active='true'] {
  color: var(--omv-text);
  background: var(--omv-surface);
  font-weight: 650;
  box-shadow: var(--omv-shadow-xs);
}
.omv-nav-button[data-active='true'] svg { opacity: 1; color: var(--omv-violet); }
.omv-nav-button[data-active='true']::after { content: none; }
.omv-nav-count {
  min-width: 19px; height: 19px; border-radius: 999px;
  background: color-mix(in srgb, var(--omv-violet) 14%, transparent); color: var(--omv-violet);
  border: none;
}
.omv-nav-button[data-active='true'] .omv-nav-count {
  background: color-mix(in srgb, var(--omv-violet) 18%, transparent); color: var(--omv-violet);
}
.omv-live { padding: 5px 8px; border: 1px solid var(--omv-line); border-radius: 999px; background: var(--omv-surface); }
.omv-live[data-state='live'] > i { box-shadow: none; }
.omv-palette-button { height: 32px; padding: 0 9px; border-radius: 7px; background: var(--omv-surface); box-shadow: none; }
.omv-icon-button { border-radius: var(--omv-radius-sm); background: transparent; }
.omv-content {
  min-height: 0;
  background: var(--omv-bg);
  padding: 28px 34px calc(var(--dsh-composer-height, 152px) + 34px);
}
.omv-content-inner { width: min(1160px, 100%); }
.omv-hero {
  position: relative;
  min-height: 92px;
  margin-bottom: 20px;
  padding: 21px 23px;
  overflow: hidden;
  border: 1px solid var(--omv-line);
  border-radius: var(--omv-radius-lg);
  background: linear-gradient(90deg, var(--omv-violet), var(--omv-teal)) top left / 100% 2px no-repeat, var(--omv-surface);
  box-shadow: var(--omv-shadow-xs);
}
.omv-hero::before {
  content: ''; position: absolute; inset: 0;
  background-image: radial-gradient(circle, color-mix(in srgb, var(--omv-text) 16%, transparent) 1px, transparent 1px);
  background-size: 15px 15px;
  -webkit-mask-image: linear-gradient(115deg, #000 0%, transparent 46%);
  mask-image: linear-gradient(115deg, #000 0%, transparent 46%);
  opacity: .5;
}
.omv-hero::after {
  content: ''; position: absolute; top: -40%; right: -12%; width: 260px; height: 260px; border-radius: 50%;
  background: var(--omv-signal); opacity: .16; filter: blur(2px);
}
.omv-hero > * { position: relative; z-index: 1; }
.omv-eyebrow { margin-bottom: 7px; color: var(--omv-violet); font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
.omv-hero h2 { font-size: 25px; letter-spacing: -.035em; }
.omv-hero p:not(.omv-eyebrow) { max-width: 690px; margin-top: 8px; color: var(--omv-muted); font-size: 13px; }
.omv-hero-actions { align-self: center; }
.omv-hero-status { padding: 7px 10px; border: 1px solid var(--omv-line); border-radius: 999px; background: var(--omv-surface); color: var(--omv-muted); font-size: 11px; box-shadow: none; }
.omv-hero-status > i { width: 7px; height: 7px; box-shadow: none; }
.omv-primary, .omv-secondary, .omv-danger { min-height: 36px; border-radius: var(--omv-radius-sm); font-size: 12px; font-weight: 600; }
.omv-primary, .omv-secondary { box-shadow: var(--omv-shadow-xs); }
.omv-primary:hover {
  box-shadow: var(--omv-shadow-sm), 0 0 0 3px color-mix(in srgb, var(--omv-blue) 16%, transparent);
  filter: brightness(1.04); transform: translateY(-1px);
}
.omv-primary:active { transform: translateY(0); filter: brightness(.94); box-shadow: var(--omv-shadow-xs); }
.omv-secondary:hover { box-shadow: var(--omv-shadow-sm); transform: translateY(-1px); }
.omv-secondary:active { transform: translateY(0); box-shadow: var(--omv-shadow-xs); }
.omv-metrics { gap: 16px; margin-bottom: 16px; }
.omv-metric {
  position: relative;
  min-height: 108px;
  padding: 17px 18px 15px;
  overflow: hidden;
  border-radius: var(--omv-radius-md);
  box-shadow: var(--omv-shadow-xs);
  transition: box-shadow .16s ease, transform .16s ease, border-color .16s ease;
}
.omv-metric:hover {
  box-shadow: var(--omv-shadow-sm); transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--omv-line) 55%, var(--metric-color, var(--omv-blue)));
}
.omv-metric::before { display: none; }
.omv-metric-head { font-size: 11.5px; }
.omv-metric-icon {
  width: 32px; height: 32px; border-radius: var(--omv-radius-sm);
  background: color-mix(in srgb, var(--metric-color, var(--omv-blue)) 12%, transparent);
}
.omv-metric strong { margin-top: 12px; font-size: 30px; font-variant-numeric: tabular-nums; }
.omv-metric-foot { margin-top: 10px; font-size: 12px; }
.omv-grid { gap: 16px; }
.omv-panel, .omv-list-wrap, .omv-campaign { border-radius: var(--omv-radius-md); box-shadow: var(--omv-shadow-xs); }
.omv-panel-head { min-height: 54px; padding: 0 18px; }
.omv-panel-head h3 { font-size: 12.5px; letter-spacing: -.01em; }
.omv-panel-head p { margin-top: 3px; font-size: 11px; }
.omv-queue-row { min-height: 62px; padding: 9px 17px; transition: background-color .12s ease; }
 .omv-queue-row:hover, .omv-quality-issue[role='button']:hover { background: color-mix(in srgb, var(--omv-blue) 5%, var(--omv-surface)); }
.omv-finding-name strong { font-size: 12.5px; }
.omv-finding-name span { margin-top: 3px; font-size: 11px; }
.omv-status { padding: 4px 9px; border-radius: 999px; font-size: 10.5px; font-weight: 600; letter-spacing: .01em; border: 1px solid color-mix(in srgb, var(--status) 22%, transparent); }
.omv-toolbar { margin-bottom: 12px; }
.omv-input, .omv-select, .omv-textarea { border-radius: 9px; box-shadow: inset 0 1px 1px rgba(18, 24, 40, .025); }
 .omv-list-head { height: 42px; padding: 0 20px; background: color-mix(in srgb, var(--omv-bg) 75%, var(--omv-surface)); }
 .omv-finding-row { padding: 12px 20px; }
 .omv-finding-row strong, .omv-quality-score strong, .omv-quality-counts b, .omv-campaign-summary strong, .omv-posture-score strong, .omv-quality-queue > strong { font-variant-numeric: tabular-nums; }
.omv-campaigns { gap: 12px; }
  .omv-campaign { position: relative; padding: 18px; overflow: hidden; border-radius: var(--omv-radius-md); transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease; }
  .omv-campaign::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--status-line, var(--omv-violet)); opacity: .75; }
  .omv-campaign[data-status='completed']::before, .omv-campaign[data-status='disclosed']::before, .omv-campaign[data-status='active']::before { --status-line: var(--omv-green); }
  .omv-campaign[data-status='blocked']::before, .omv-campaign[data-status='failed']::before { --status-line: var(--omv-red); }
  .omv-campaign[data-status='paused']::before, .omv-campaign[data-status='pending']::before, .omv-campaign[data-status='queued']::before { --status-line: var(--omv-orange); }
  .omv-campaign:hover { box-shadow: var(--omv-shadow-md); transform: translateY(-2px); border-color: color-mix(in srgb, var(--omv-line) 40%, var(--omv-blue)); }
  .omv-campaign-icon { width: 32px; height: 32px; border-radius: 10px; background: color-mix(in srgb, var(--omv-violet) 12%, transparent); color: var(--omv-violet); }
.omv-campaign h3 { margin-top: 15px; font-size: 14px; }
.omv-posture { padding: 18px; }
.omv-posture-score strong { font-size: 30px; letter-spacing: -.04em; }
.omv-posture-track i, .omv-score-track i { transition: width .45s cubic-bezier(.22, .61, .36, 1); }
 .omv-quality-hero, .omv-quality-queues { border-radius: var(--omv-radius-md); box-shadow: var(--omv-shadow-xs); }
 .omv-quality-hero {
  position: relative; overflow: hidden; border-color: var(--omv-line);
  background: radial-gradient(circle at 8% 20%, color-mix(in srgb, var(--omv-violet) 10%, transparent), transparent 55%), var(--omv-surface);
 }
 .omv-quality-hero::after {
  content: ''; position: absolute; top: -30%; right: -8%; width: 200px; height: 200px; border-radius: 50%;
  background: var(--omv-signal); opacity: .12; filter: blur(2px); pointer-events: none;
 }
 .omv-quality-hero > * { position: relative; z-index: 1; }
.omv-quality-score strong { font-size: 30px; letter-spacing: -.05em; }
.omv-quality-queue { min-height: 108px; border-radius: var(--omv-radius-sm); background: var(--omv-surface); transition: background .16s ease, border-color .16s ease; }
.omv-quality-queue:hover { transform: none; border-color: var(--omv-line); background: var(--omv-hover); }
.omv-quality-queue strong { font-size: 28px; letter-spacing: -.04em; }
.omv-repro-card{ padding: 15px 17px; }
.omv-repro-card:hover{ background: var(--omv-hover); }
.omv-section { margin-top: 14px; border-radius: var(--omv-radius-md); box-shadow: var(--omv-shadow-xs); }
.omv-section-title { min-height: 44px; padding: 0 16px; background: color-mix(in srgb, var(--omv-bg) 45%, var(--omv-surface)); }
.omv-section-title h3 { font-size: 12.5px; }
.omv-chain-card, .omv-maturity-hero { border-radius: var(--omv-radius-sm); }
.omv-modal-backdrop { background: rgba(15, 20, 32, .20); backdrop-filter: none; }
.omv-modal, .omv-command-palette { border-radius: var(--omv-radius-lg); box-shadow: var(--omv-shadow-lg); }
.omv-command-palette-head { min-height: 60px; padding: 11px 13px; }
.omv-command-palette-item { min-height: 40px; border-radius: var(--omv-radius-sm); }
.omv-command-palette-item:hover, .omv-command-palette-item.active { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--omv-blue) 22%, transparent); }
.omv-toast { top: 82px; border-radius: var(--omv-radius-md); box-shadow: var(--omv-shadow-lg); }
.omv-loading { min-height: 300px; }
.omv-native-view *, .omv-settings * { scrollbar-color: var(--omv-line) transparent; }
.omv-native-view *::-webkit-scrollbar, .omv-settings *::-webkit-scrollbar { width: 8px; height: 8px; }
.omv-native-view *::-webkit-scrollbar-track, .omv-settings *::-webkit-scrollbar-track { background: transparent; }
.omv-native-view *::-webkit-scrollbar-thumb, .omv-settings *::-webkit-scrollbar-thumb { background: var(--omv-line); border-radius: 999px; }
.omv-native-view *::-webkit-scrollbar-thumb:hover, .omv-settings *::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--omv-muted) 55%, var(--omv-line)); }
.omv-empty svg {
  box-sizing: content-box; width: 22px; height: 22px; padding: 10px; border-radius: 13px;
  background: color-mix(in srgb, var(--omv-blue) 9%, transparent); opacity: 1;
}

@media (max-width: 900px) {
  .omv-content { padding: 22px 20px calc(var(--dsh-composer-height, 152px) + 28px); }
  .omv-hero { padding: 18px 19px; }
}
@media (max-width: 620px) {
  .omv-native-toolbar { min-height: 44px; padding: 0 7px; }
  .omv-nav-button { min-width: 42px; padding: 0 7px; flex: 0 0 auto; }
  .omv-nav-button svg { display: none; }
  .omv-content { padding: 16px 12px calc(var(--dsh-composer-height, 152px) + 22px); }
  .omv-hero { min-height: 0; padding: 17px; border-radius: 12px; }
  .omv-hero::after { opacity: .2; }
  .omv-hero h2 { font-size: 21px; }
  .omv-metric { min-height: 100px; padding: 15px; }
  .omv-detail-backdrop { padding: 0; align-items: stretch; }
  .omv-detail { width: 100%; max-height: none; border-radius: 0; border: 0; }
  .omv-detail-head { border-radius: 0; }
  .omv-detail-body { padding: 16px; }
  .omv-surface-lists { grid-template-columns: 1fr; }
}
.omv-hint-line { margin: -6px 0 10px; color: var(--omv-orange); font-size: 10.5px; }
.omv-war { position: relative; display: grid; border: 1px solid var(--omv-line); border-radius: 10px; overflow: hidden; background: color-mix(in srgb, var(--omv-bg) 55%, var(--omv-surface)); }
.omv-war-toolbar { min-height: 32px; padding: 0 8px 0 12px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--omv-line); background: var(--omv-surface); }
.omv-war-canvas { position: relative; height: 300px; overflow: hidden; cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.omv-war-canvas:active { cursor: grabbing; }
.omv-war-canvas svg { display: block; }
.omv-war-seed rect { fill: color-mix(in srgb, var(--omv-text) 88%, var(--omv-surface)); stroke: none; }
.omv-war-seed-kicker { fill: color-mix(in srgb, #fff 62%, transparent); font-size: 9px; font-weight: 600; letter-spacing: .04em; }
.omv-war-seed-title { fill: #fff; font-size: 12.5px; font-weight: 700; }
.omv-war-seed-meta { fill: color-mix(in srgb, #fff 52%, transparent); font-size: 9.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.omv-war-lane { cursor: pointer; }
.omv-war-lane rect:first-of-type { fill: var(--omv-surface); stroke: var(--omv-line); stroke-width: 1; }
.omv-war-lane:hover rect:first-of-type { stroke: color-mix(in srgb, var(--omv-blue) 55%, var(--omv-line)); }
.omv-war-lane.selected rect:first-of-type { stroke: var(--omv-blue); stroke-width: 1.6; filter: drop-shadow(0 1px 4px color-mix(in srgb, var(--omv-blue) 26%, transparent)); }
.omv-war-lane[data-status='completed'] rect:first-of-type { stroke: color-mix(in srgb, var(--omv-green) 42%, var(--omv-line)); }
.omv-war-lane[data-status='failed'] rect:first-of-type, .omv-war-lane[data-status='blocked'] rect:first-of-type { stroke: color-mix(in srgb, var(--omv-red) 45%, var(--omv-line)); }
.omv-war-lane-index { fill: var(--omv-faint); font-size: 9px; font-weight: 600; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.omv-war-lane-status { font-size: 9px; font-weight: 700; }
.omv-war-lane-title { fill: var(--omv-text); font-size: 11px; font-weight: 600; }
.omv-war-lane-meta { fill: var(--omv-muted); font-size: 9.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
.omv-war-note-dot { fill: var(--omv-orange); }
.omv-war-pulse { fill: none; stroke: var(--omv-blue); stroke-width: 1.4; opacity: .55; animation: omv-war-pulse 1.6s ease-in-out infinite; }
@keyframes omv-war-pulse { 0%, 100% { opacity: .18; } 50% { opacity: .6; } }
@media (prefers-reduced-motion: reduce) { .omv-war-pulse { animation: none; opacity: .35; } }
.omv-war-inspector-actions { margin-left: auto; display: flex; gap: 5px; }
.omv-war-inspector-actions .omv-secondary { min-height: 27px; padding: 0 9px; font-size: 10px; }
`

export function ensureWorkbenchStyles(): void {
  if (typeof document === 'undefined' || document.querySelector('style[data-plugin-css="dsh-omv/workbench"]')) return
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-omv'
  style.dataset.pluginCss = 'dsh-omv/workbench'
  style.textContent = WORKBENCH_CSS
  document.head.appendChild(style)
}
