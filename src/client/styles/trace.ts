export const TRACE_CSS = String.raw`
/* Native Trace-inspired audit timeline.  The chart stays intentionally quiet so
   the event stream remains the primary source of truth. */
.omv-trace-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: -2px 0 14px;
}
.omv-trace-segmented {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border: 1px solid var(--omv-line);
  border-radius: 10px;
  background: var(--omv-surface);
  box-shadow: var(--omv-shadow-xs);
}
.omv-trace-segmented { border-radius: 7px; box-shadow: none; }
.omv-trace-segmented button {
  display: inline-flex;
  align-items: baseline;
  gap: 5px;
  min-height: 30px;
  padding: 0 11px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--omv-muted);
  font-size: 11.5px;
  font-weight: 560;
  cursor: pointer;
  transition: background .16s ease, color .16s ease, box-shadow .16s ease;
}
.omv-trace-segmented button small { color: var(--omv-faint); font-size: 9px; font-weight: 500; }
.omv-trace-segmented button:hover { background: var(--omv-hover); color: var(--omv-text); }
.omv-trace-segmented button[data-active='true'] { background: var(--omv-hover); color: var(--omv-text); box-shadow: none; }
.omv-trace-segmented button[data-active='true'] small { color: color-mix(in srgb, var(--omv-blue) 70%, var(--omv-muted)); }
.omv-trace-search {
  display: flex;
  align-items: center;
  flex: 1 1 260px;
  min-width: 180px;
  height: 36px;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid var(--omv-line);
  border-radius: 9px;
  background: var(--omv-surface);
  color: var(--omv-faint);
  box-shadow: var(--omv-shadow-xs);
  transition: border-color .16s ease, box-shadow .16s ease;
}
.omv-trace-search:focus-within { border-color: color-mix(in srgb, var(--omv-blue) 48%, var(--omv-line)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--omv-blue) 10%, transparent); }
.omv-trace-search { box-shadow: none; }
.omv-trace-search input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--omv-text); font-size: 12px; }
.omv-trace-search input::placeholder { color: var(--omv-faint); }
.omv-trace-search button { display: inline-flex; border: 0; background: transparent; color: var(--omv-faint); cursor: pointer; }
.omv-trace-filter { display: inline-flex; align-items: center; gap: 7px; height: 36px; padding: 0 10px; border: 1px solid var(--omv-line); border-radius: 7px; background: var(--omv-surface); color: var(--omv-muted); font-size: 11px; box-shadow: none; }
.omv-trace-filter select { border: 0; outline: 0; background: transparent; color: var(--omv-text); font: inherit; cursor: pointer; }
.omv-trace-layout { display: grid; grid-template-columns: minmax(0, 1fr) 248px; gap: 14px; align-items: stretch; }
.omv-trace-chart-panel { min-width: 0; overflow: hidden; }
.omv-trace-chart-head { min-height: 62px; }
.omv-trace-chart-head > span { max-width: 180px; overflow: hidden; color: var(--omv-faint); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
.omv-trace-plot { position: relative; display: grid; grid-template-columns: 28px minmax(0, 1fr); height: 148px; gap: 9px; padding: 16px 17px 0; background: var(--omv-surface); }
.omv-trace-y-axis { display: flex; flex-direction: column; justify-content: space-between; padding: 0 0 7px; color: var(--omv-faint); font-size: 9px; line-height: 1; text-align: right; }
.omv-trace-bars { display: grid; grid-template-columns: repeat(24, minmax(3px, 1fr)); align-items: end; gap: 5px; min-width: 0; border-bottom: 1px solid var(--omv-line); background: repeating-linear-gradient(to bottom, transparent 0, transparent 32px, color-mix(in srgb, var(--omv-line) 62%, transparent) 33px); }
.omv-trace-bar { position: relative; display: flex; align-items: flex-end; min-width: 0; height: 100%; padding: 0; }
.omv-trace-bar i { display: block; width: 100%; height: var(--trace-height); min-height: 3px; border-radius: 3px 3px 0 0; background: var(--omv-purple); box-shadow: none; transform-origin: bottom; animation: omv-trace-bar-in .52s cubic-bezier(.22, .75, .25, 1) both; animation-delay: var(--trace-delay); transition: height .3s ease, filter .16s ease, transform .16s ease; }
.omv-trace-plot[data-empty='true'] .omv-trace-bar i { animation: none; opacity: .12; transform: none; }
.omv-trace-chart-panel[data-empty='true'] .omv-trace-lane-cell { opacity: .04; }
.omv-trace-bar:hover i { filter: saturate(1.2); transform: translateY(-3px); }
.omv-trace-axis { display: grid; grid-template-columns: repeat(24, minmax(3px, 1fr)); gap: 5px; padding: 6px 17px 0 54px; color: var(--omv-faint); font-size: 9px; }
.omv-trace-axis span { min-width: 0; overflow: hidden; white-space: nowrap; }
.omv-trace-lanes { display: grid; gap: 6px; padding: 17px; border-top: 1px solid var(--omv-line); }
.omv-trace-lane { display: grid; grid-template-columns: 68px minmax(0, 1fr); align-items: center; gap: 9px; }
.omv-trace-lane > span { display: flex; align-items: center; justify-content: space-between; gap: 6px; color: var(--omv-muted); font-size: 10px; font-weight: 620; letter-spacing: .02em; }
.omv-trace-lane > span b { color: var(--omv-faint); font-size: 9px; font-weight: 560; }
.omv-trace-lane-track { display: grid; grid-template-columns: repeat(24, minmax(3px, 1fr)); gap: 4px; }
.omv-trace-lane-cell { display: block; height: 9px; border-radius: 3px; opacity: var(--trace-intensity); transition: opacity .2s ease, transform .2s ease; }
.omv-trace-lane-cell:hover { opacity: 1; transform: scaleY(1.35); }
.omv-trace-lane-cell[data-kind='context'] { background: var(--omv-green); }
.omv-trace-lane-cell[data-kind='assistant'] { background: var(--omv-purple); }
.omv-trace-lane-cell[data-kind='tool'] { background: var(--omv-orange); }
.omv-trace-chart-empty { position: absolute; inset: 16px 17px 0 54px; display: grid; place-items: center; align-content: center; gap: 6px; color: var(--omv-faint); font-size: 10.5px; pointer-events: none; }
.omv-trace-chart-empty svg { color: var(--omv-blue); opacity: .72; }
.omv-trace-stats { display: grid; grid-template-columns: 1fr; gap: 10px; }
.omv-trace-stats .omv-metric { min-height: 0; height: auto; padding: 14px 15px 12px; }
.omv-trace-stats .omv-metric strong { margin-top: 8px; font-size: 23px; }
.omv-trace-stats .omv-metric-foot { margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.omv-trace-jobs { margin-top: 14px; overflow: hidden; }
.omv-trace-jobs > .omv-panel-head > span, .omv-trace-stream > .omv-panel-head > span { color: var(--omv-faint); font-size: 10.5px; }
.omv-trace-job-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 9px; padding: 0 14px 14px; }
.omv-trace-job { min-width: 0; padding: 12px; border: 1px solid var(--omv-line); border-radius: 7px; background: var(--omv-surface); transition: border-color .16s ease, background .16s ease; }
.omv-trace-job:hover { transform: none; border-color: var(--omv-line); background: var(--omv-hover); }
.omv-trace-job > div { display: flex; align-items: center; gap: 7px; min-width: 0; }
.omv-trace-job > div i { width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; background: var(--omv-faint); }
.omv-trace-job[data-state='running'] > div i, .omv-trace-job[data-state='stopping'] > div i { background: var(--omv-green); box-shadow: 0 0 0 4px color-mix(in srgb, var(--omv-green) 12%, transparent); animation: omv-trace-pulse 1.8s ease-in-out infinite; }
.omv-trace-job strong { overflow: hidden; color: var(--omv-text); font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
.omv-trace-job code { display: block; margin-top: 7px; overflow: hidden; color: var(--omv-muted); font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }
.omv-trace-job > span { display: block; margin-top: 5px; overflow: hidden; color: var(--omv-faint); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.omv-trace-stream { margin-top: 14px; overflow: hidden; }
.omv-trace-events { margin: 0; padding: 0 17px 8px; list-style: none; }
.omv-trace-event { position: relative; display: grid; grid-template-columns: 22px minmax(0, 1fr); min-height: 60px; padding: 0; opacity: 0; animation: omv-trace-row-in .34s ease forwards; animation-delay: var(--trace-delay, 0ms); }
.omv-trace-event-rail { position: relative; display: flex; justify-content: center; }
.omv-trace-event-rail > i { z-index: 1; width: 9px; height: 9px; margin-top: 21px; border: 2px solid var(--omv-surface); border-radius: 50%; background: var(--omv-faint); box-shadow: 0 0 0 1px var(--omv-line); }
.omv-trace-event-rail > i[data-kind='tool'] { background: var(--omv-orange); }
.omv-trace-event-rail > i[data-kind='assistant'] { background: var(--omv-purple); }
.omv-trace-event-rail > i[data-kind='context'] { background: var(--omv-green); }
.omv-trace-event-rail > i[data-kind='system'] { background: var(--omv-blue); }
.omv-trace-event-rail > span { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--omv-line); }
.omv-trace-event:last-child .omv-trace-event-rail > span { bottom: 22px; }
.omv-trace-event-main { min-width: 0; padding: 12px 10px 10px 10px; border-bottom: 1px solid color-mix(in srgb, var(--omv-line) 72%, transparent); border-radius: 7px; transition: background .16s ease; }
.omv-trace-event:hover .omv-trace-event-main { background: color-mix(in srgb, var(--omv-blue) 4%, var(--omv-surface)); }
.omv-trace-event:last-child .omv-trace-event-main { border-bottom: 0; }
.omv-trace-event-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.omv-trace-badge { flex: 0 0 auto; padding: 4px 7px; border-radius: 6px; background: color-mix(in srgb, var(--omv-faint) 10%, transparent); color: var(--omv-muted); font-size: 9px; font-weight: 720; letter-spacing: .06em; }
.omv-trace-badge[data-kind='tool'] { background: color-mix(in srgb, var(--omv-orange) 13%, transparent); color: var(--omv-orange); }
.omv-trace-badge[data-kind='assistant'] { background: color-mix(in srgb, var(--omv-purple) 13%, transparent); color: var(--omv-purple); }
.omv-trace-badge[data-kind='context'] { background: color-mix(in srgb, var(--omv-green) 13%, transparent); color: var(--omv-green); }
.omv-trace-badge[data-kind='system'] { background: color-mix(in srgb, var(--omv-blue) 11%, transparent); color: var(--omv-blue); }
.omv-trace-event-title strong { overflow: hidden; color: var(--omv-text); font-size: 12px; font-weight: 620; text-overflow: ellipsis; white-space: nowrap; }
.omv-trace-event-detail { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; margin: 7px 0 0; color: var(--omv-muted); }
.omv-trace-event-detail code { overflow: hidden; color: var(--omv-muted); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
.omv-trace-event-detail time { flex: 0 0 auto; color: var(--omv-faint); font-size: 10px; }
@keyframes omv-trace-bar-in { from { opacity: 0; transform: scaleY(.12); } to { opacity: 1; transform: scaleY(1); } }
@keyframes omv-trace-row-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
@keyframes omv-trace-pulse { 0%, 100% { opacity: .58; transform: scale(.9); } 50% { opacity: 1; transform: scale(1); } }
@media (prefers-reduced-motion: reduce) {
  .omv-trace-bar i, .omv-trace-event, .omv-trace-job[data-state='running'] > div i, .omv-trace-job[data-state='stopping'] > div i { animation: none; opacity: 1; transform: none; }
}
@media (max-width: 900px) {
  .omv-trace-layout { grid-template-columns: 1fr; }
  .omv-trace-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .omv-trace-stats .omv-metric strong { font-size: 21px; }
}
@media (max-width: 620px) {
  .omv-trace-controls { flex-wrap: wrap; gap: 8px; }
  .omv-trace-segmented { order: 1; width: 100%; }
  .omv-trace-segmented button { flex: 1; justify-content: center; }
  .omv-trace-search { order: 2; min-width: 0; }
  .omv-trace-filter { order: 3; }
  .omv-trace-plot { padding-right: 12px; padding-left: 12px; }
  .omv-trace-axis { padding-left: 49px; padding-right: 12px; }
  .omv-trace-lanes { padding: 13px 12px; }
  .omv-trace-job-grid { grid-template-columns: 1fr; }
  .omv-trace-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .omv-trace-stats .omv-metric { min-height: 88px; }
  .omv-trace-events { padding-right: 12px; padding-left: 12px; }
  .omv-trace-event-main { padding-left: 7px; }
  .omv-trace-event-detail time { display: none; }
}

`
