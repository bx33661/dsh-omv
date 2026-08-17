/**
 * 重新设计的样式系统
 *
 * 设计原则：
 * 1. 8px 网格系统 - 所有间距都是 8 的倍数
 * 2. 一致的视觉层次 - 清晰的标题/正文/辅助文字层级
 * 3. 现代卡片设计 - 柔和阴影、圆角、悬浮效果
 * 4. 语义化颜色 - 每种颜色都有明确含义
 * 5. 流畅动画 - 微妙的过渡效果提升体验
 *
 * 作用域说明：所有规则都以 `.omv-page` 作为前缀，避免与 styles.ts 中仍在使用的
 * 旧版共享组件（例如 ui.tsx 的 Metric / EmptyState）发生类名冲突。之前 `.omv-metric-icon`
 * 等类未加作用域，导致重新设计版本的样式覆盖了 Reproduction 等页面里旧版组件的样式。
 */

export const REDESIGNED_CSS = String.raw`
/* ============================================================================
   设计令牌 (Design Tokens) —— 作用域限定在 .omv-page 内，不污染全局 :root
   ============================================================================ */

.omv-page {
  /* 间距系统 - 8px 网格 */
  --omv-space-1: 4px;
  --omv-space-2: 8px;
  --omv-space-3: 12px;
  --omv-space-4: 16px;
  --omv-space-5: 24px;
  --omv-space-6: 32px;
  --omv-space-7: 40px;
  --omv-space-8: 48px;

  /* 圆角 */
  --omv-radius-sm: 6px;
  --omv-radius-md: 10px;
  --omv-radius-lg: 14px;
  --omv-radius-xl: 20px;

  /* 阴影 */
  --omv-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.06);
  --omv-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --omv-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --omv-shadow-hover: 0 6px 16px rgba(0, 0, 0, 0.10);

  /* 颜色系统 */
  --omv-blue-50: #eff6ff;
  --omv-blue-100: #dbeafe;
  --omv-blue-500: #3b82f6;
  --omv-blue-600: #2563eb;
  --omv-blue-700: #1d4ed8;

  --omv-green-50: #f0fdf4;
  --omv-green-100: #dcfce7;
  --omv-green-500: #22c55e;
  --omv-green-600: #16a34a;
  --omv-green-700: #15803d;

  --omv-orange-50: #fff7ed;
  --omv-orange-100: #ffedd5;
  --omv-orange-500: #f97316;
  --omv-orange-600: #ea580c;
  --omv-orange-700: #c2410c;

  --omv-red-50: #fef2f2;
  --omv-red-100: #fee2e2;
  --omv-red-500: #ef4444;
  --omv-red-600: #dc2626;

  --omv-gray-50: #f9fafb;
  --omv-gray-100: #f3f4f6;
  --omv-gray-200: #e5e7eb;
  --omv-gray-300: #d1d5db;
  --omv-gray-400: #9ca3af;
  --omv-gray-500: #6b7280;
  --omv-gray-600: #4b5563;
  --omv-gray-700: #374151;
  --omv-gray-800: #1f2937;
  --omv-gray-900: #111827;

  /* 语义化颜色 */
  --omv-bg: var(--omv-gray-50);
  --omv-surface: #ffffff;
  --omv-text: var(--omv-gray-900);
  --omv-text-secondary: var(--omv-gray-600);
  --omv-text-muted: var(--omv-gray-500);
  --omv-border: var(--omv-gray-200);
  --omv-border-hover: var(--omv-gray-300);

  /* 动画 */
  --omv-transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}

@media (prefers-color-scheme: dark) {
  .omv-page {
    --omv-bg: #0a0a0b;
    --omv-surface: #18181b;
    --omv-text: #fafafa;
    --omv-text-secondary: #a1a1aa;
    --omv-text-muted: #71717a;
    --omv-border: #27272a;
    --omv-border-hover: #3f3f46;

    --omv-shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.3);
    --omv-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
    --omv-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);
    --omv-shadow-hover: 0 6px 16px rgba(0, 0, 0, 0.45);
  }
}

/* ============================================================================
   页面布局
   ============================================================================ */

.omv-page {
  /* 外层 padding / max-width 由 shell 的 .omv-content / .omv-content-inner 负责，
     这里不再重复设置，避免和旧版共享容器产生双重内边距。 */
  color: var(--omv-text);
}

/* 页面头部 */
.omv-page .omv-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--omv-space-5);
  margin-bottom: var(--omv-space-6);
  padding-bottom: var(--omv-space-5);
  border-bottom: 1px solid var(--omv-border);
}

.omv-page .omv-page-header-content {
  flex: 1;
}

.omv-page .omv-page-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--omv-text);
  letter-spacing: -0.02em;
}

.omv-page .omv-page-description {
  margin: var(--omv-space-2) 0 0;
  font-size: 15px;
  line-height: 1.5;
  color: var(--omv-text-secondary);
}

.omv-page .omv-page-actions {
  display: flex;
  gap: var(--omv-space-3);
  align-items: center;
}

/* ============================================================================
   卡片组件
   ============================================================================ */

.omv-page .omv-card {
  background: var(--omv-surface);
  border: 1px solid var(--omv-border);
  border-radius: var(--omv-radius-lg);
  box-shadow: var(--omv-shadow-sm);
  overflow: hidden;
  transition: box-shadow var(--omv-transition), border-color var(--omv-transition);
}

.omv-page .omv-card-primary {
  border-color: transparent;
  box-shadow: var(--omv-shadow-md);
}

.omv-page .omv-card:hover {
  box-shadow: var(--omv-shadow-hover);
}

.omv-page .omv-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--omv-space-4);
  padding: var(--omv-space-5);
  border-bottom: 1px solid var(--omv-border);
}

.omv-page .omv-card-header-content {
  flex: 1;
}

.omv-page .omv-card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--omv-text);
}

.omv-page .omv-card-title-sm {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--omv-text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.omv-page .omv-card-subtitle {
  margin: var(--omv-space-1) 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--omv-text-muted);
}

.omv-page .omv-card-body {
  padding: var(--omv-space-5);
}

/* ============================================================================
   指标卡片网格
   ============================================================================ */

.omv-page .omv-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--omv-space-4);
  margin-bottom: var(--omv-space-6);
}

.omv-page .omv-metric-card {
  display: flex;
  align-items: flex-start;
  gap: var(--omv-space-4);
  padding: var(--omv-space-5);
  background: var(--omv-surface);
  border: 1px solid var(--omv-border);
  border-radius: var(--omv-radius-lg);
  box-shadow: var(--omv-shadow-sm);
  cursor: pointer;
  transition: all var(--omv-transition);
}

.omv-page .omv-metric-card:hover {
  border-color: var(--omv-border-hover);
  box-shadow: var(--omv-shadow-md);
  transform: translateY(-2px);
}

.omv-page .omv-metric-card-blue {
  background: linear-gradient(135deg, var(--omv-blue-50) 0%, var(--omv-surface) 100%);
  border-color: var(--omv-blue-100);
}

.omv-page .omv-metric-card-green {
  background: linear-gradient(135deg, var(--omv-green-50) 0%, var(--omv-surface) 100%);
  border-color: var(--omv-green-100);
}

.omv-page .omv-metric-card-orange {
  background: linear-gradient(135deg, var(--omv-orange-50) 0%, var(--omv-surface) 100%);
  border-color: var(--omv-orange-100);
}

.omv-page .omv-metric-card-teal {
  background: linear-gradient(135deg, #f0fdfa 0%, var(--omv-surface) 100%);
  border-color: #ccfbf1;
}

.omv-page .omv-metric-card .omv-metric-icon {
  font-size: 28px;
  line-height: 1;
  opacity: 0.9;
}

.omv-page .omv-metric-content {
  flex: 1;
}

.omv-page .omv-metric-value {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--omv-text);
}

.omv-page .omv-metric-label {
  margin-top: var(--omv-space-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  color: var(--omv-text-secondary);
}

.omv-page .omv-metric-trend {
  margin-top: var(--omv-space-1);
  font-size: 12px;
  line-height: 1.4;
  color: var(--omv-text-muted);
}

/* ============================================================================
   内容网格 (主内容 + 侧边栏)
   ============================================================================ */

.omv-page .omv-content-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: var(--omv-space-5);
  align-items: start;
}

@media (max-width: 1024px) {
  .omv-page .omv-content-grid {
    grid-template-columns: 1fr;
  }
}

.omv-page .omv-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--omv-space-4);
  position: sticky;
  top: var(--omv-space-5);
}

/* ============================================================================
   漏洞列表
   ============================================================================ */

.omv-page .omv-finding-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--omv-space-3);
}

.omv-page .omv-finding-item {
  padding: var(--omv-space-4);
  background: var(--omv-bg);
  border: 1px solid var(--omv-border);
  border-radius: var(--omv-radius-md);
  cursor: pointer;
  transition: all var(--omv-transition);
}

.omv-page .omv-finding-item:hover {
  border-color: var(--omv-border-hover);
  background: var(--omv-surface);
  box-shadow: var(--omv-shadow-sm);
  transform: translateX(4px);
}

.omv-page .omv-finding-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--omv-space-3);
  margin-bottom: var(--omv-space-3);
}

.omv-page .omv-finding-id {
  font-size: 11px;
  font-weight: 600;
  font-family: ui-monospace, monospace;
  color: var(--omv-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.omv-page .omv-finding-status {
  padding: var(--omv-space-1) var(--omv-space-2);
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--omv-radius-sm);
  text-transform: capitalize;
}

.omv-page .omv-finding-status[data-status='candidate'] {
  background: var(--omv-blue-100);
  color: var(--omv-blue-700);
}

.omv-page .omv-finding-status[data-status='proven'] {
  background: var(--omv-green-100);
  color: var(--omv-green-700);
}

.omv-page .omv-finding-status[data-status='blocked'] {
  background: var(--omv-orange-100);
  color: var(--omv-orange-700);
}

.omv-page .omv-finding-item-body {
  margin-bottom: var(--omv-space-3);
}

.omv-page .omv-finding-package {
  margin: 0 0 var(--omv-space-1);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--omv-text);
}

.omv-page .omv-finding-vuln {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--omv-text-secondary);
}

.omv-page .omv-finding-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--omv-space-3);
}

.omv-page .omv-finding-next-action {
  font-size: 12px;
  font-weight: 500;
  color: var(--omv-blue-600);
}

.omv-page .omv-finding-chevron {
  font-size: 14px;
  color: var(--omv-text-muted);
  opacity: 0;
  transition: opacity var(--omv-transition), transform var(--omv-transition);
}

.omv-page .omv-finding-item:hover .omv-finding-chevron {
  opacity: 1;
  transform: translateX(2px);
}

/* ============================================================================
   按钮系统
   ============================================================================ */

.omv-page .omv-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--omv-space-2);
  padding: 0 var(--omv-space-4);
  height: 38px;
  border: 1px solid transparent;
  border-radius: var(--omv-radius-md);
  font-size: 14px;
  font-weight: 500;
  line-height: 1;
  cursor: pointer;
  transition: all var(--omv-transition);
  white-space: nowrap;
}

.omv-page .omv-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.omv-page .omv-btn-primary {
  background: var(--omv-blue-600);
  color: white;
  box-shadow: 0 1px 2px rgba(37, 99, 235, 0.2);
}

.omv-page .omv-btn-primary:hover:not(:disabled) {
  background: var(--omv-blue-700);
  box-shadow: 0 2px 4px rgba(37, 99, 235, 0.3);
  transform: translateY(-1px);
}

.omv-page .omv-btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.omv-page .omv-btn-secondary {
  background: var(--omv-surface);
  border-color: var(--omv-border);
  color: var(--omv-text);
}

.omv-page .omv-btn-secondary:hover:not(:disabled) {
  border-color: var(--omv-border-hover);
  background: var(--omv-bg);
}

.omv-page .omv-btn-ghost {
  background: transparent;
  color: var(--omv-text-secondary);
}

.omv-page .omv-btn-ghost:hover:not(:disabled) {
  background: var(--omv-bg);
  color: var(--omv-text);
}

.omv-page .omv-btn-sm {
  height: 32px;
  padding: 0 var(--omv-space-3);
  font-size: 13px;
}

.omv-page .omv-btn-icon {
  font-size: 16px;
  line-height: 1;
}

/* ============================================================================
   态势图表
   ============================================================================ */

.omv-page .omv-posture-chart {
  display: flex;
  flex-direction: column;
  gap: var(--omv-space-3);
}

.omv-page .omv-posture-item {
  cursor: pointer;
  transition: transform var(--omv-transition);
}

.omv-page .omv-posture-item:hover {
  transform: translateX(2px);
}

.omv-page .omv-posture-bar {
  height: 8px;
  background: var(--omv-bg);
  border-radius: var(--omv-radius-sm);
  overflow: hidden;
  margin-bottom: var(--omv-space-2);
}

.omv-page .omv-posture-fill {
  height: 100%;
  border-radius: var(--omv-radius-sm);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.omv-page .omv-posture-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--omv-space-2);
}

.omv-page .omv-posture-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--omv-text-secondary);
}

.omv-page .omv-posture-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--omv-text);
  font-variant-numeric: tabular-nums;
}

/* ============================================================================
   活动时间线
   ============================================================================ */

.omv-page .omv-activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--omv-space-4);
}

.omv-page .omv-activity-item {
  position: relative;
  padding-left: var(--omv-space-5);
}

.omv-page .omv-activity-item .omv-activity-dot {
  position: absolute;
  left: 0;
  top: 4px;
  width: 8px;
  height: 8px;
  background: var(--omv-blue-500);
  border-radius: 50%;
  box-shadow: 0 0 0 3px var(--omv-blue-100);
}

.omv-page .omv-activity-item:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 3.5px;
  top: 12px;
  bottom: -16px;
  width: 1px;
  background: var(--omv-border);
}

.omv-page .omv-activity-action {
  margin: 0 0 var(--omv-space-1);
  font-size: 13px;
  line-height: 1.5;
  color: var(--omv-text);
}

.omv-page .omv-activity-time {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--omv-text-muted);
}

/* ============================================================================
   空状态
   ============================================================================ */

.omv-page .omv-empty-state {
  padding: var(--omv-space-8) var(--omv-space-5);
  text-align: center;
}

.omv-page .omv-empty-icon {
  font-size: 48px;
  line-height: 1;
  margin-bottom: var(--omv-space-4);
  opacity: 0.5;
}

.omv-page .omv-empty-title {
  margin: 0 0 var(--omv-space-2);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--omv-text);
}

.omv-page .omv-empty-description {
  margin: 0 0 var(--omv-space-5);
  font-size: 14px;
  line-height: 1.5;
  color: var(--omv-text-secondary);
}

.omv-page .omv-empty-state-sm {
  padding: var(--omv-space-5);
  text-align: center;
  font-size: 13px;
  color: var(--omv-text-muted);
}

/* ============================================================================
   快速操作
   ============================================================================ */

.omv-page .omv-quick-actions {
  display: flex;
  flex-direction: column;
  gap: var(--omv-space-2);
}

.omv-page .omv-quick-action {
  appearance: none;
  display: flex;
  align-items: center;
  gap: var(--omv-space-3);
  padding: var(--omv-space-3);
  border: 1px solid var(--omv-border);
  border-radius: var(--omv-radius-md);
  background: var(--omv-surface);
  cursor: pointer;
  transition: all var(--omv-transition);
}

.omv-page .omv-quick-action:hover {
  border-color: var(--omv-border-hover);
  background: var(--omv-bg);
  transform: translateX(2px);
}

.omv-page .omv-quick-action-icon {
  font-size: 18px;
  line-height: 1;
}

.omv-page .omv-quick-action-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--omv-text);
}
`

export function ensureRedesignedStyles(): void {
  if (typeof document === 'undefined' || document.querySelector('style[data-omv-redesign]')) return
  const style = document.createElement('style')
  style.dataset.omvRedesign = 'true'
  style.textContent = REDESIGNED_CSS
  document.head.appendChild(style)
}
