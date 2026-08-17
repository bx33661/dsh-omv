import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import type { JobView, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  ActionRequest,
  CampaignPayload,
  DashboardPayload,
  FindingPayload,
} from '../contracts.js'
import type { Tab } from './types.js'

/**
 * 重新设计的页面布局 - 改进信息架构和视觉层次
 *
 * 核心改进：
 * 1. 清晰的视觉层次 - 从概览到详情逐层深入
 * 2. 一致的间距系统 - 8px 基础单位
 * 3. 卡片式布局 - 每个功能区域独立成卡片
 * 4. 明确的行动召唤 - 主要操作突出显示
 * 5. 渐进式信息展示 - 先显示关键信息，细节可展开
 */

// ============================================================================
// 重新设计的 Overview 页面
// ============================================================================

export function OverviewRedesign({ data, onTab, onFinding, onNew }: {
  data: DashboardPayload
  onTab: (tab: Tab) => void
  onFinding: (id: string) => void
  onNew: () => void
}) {
  const { metrics } = data
  const priorityFindings = data.findings.slice(0, 5)

  return (
    <div className="omv-page">
      {/* 页面头部 - 简洁明了 */}
      <header className="omv-page-header">
        <div className="omv-page-header-content">
          <h1 className="omv-page-title">工作区概览</h1>
          <p className="omv-page-description">查看漏洞态势、优先审计队列和最近活动</p>
        </div>
        <div className="omv-page-actions">
          <button type="button" className="omv-btn omv-btn-primary" onClick={onNew}>
            <span className="omv-btn-icon">+</span>
            新建候选
          </button>
        </div>
      </header>

      {/* 核心指标 - 四个关键数据 */}
      <section className="omv-metrics-grid">
        <MetricCard
          label="活跃发现"
          value={metrics.active}
          trend={`${metrics.candidates} 条在审计中`}
          icon="📊"
          variant="blue"
          onClick={() => onTab('findings')}
        />
        <MetricCard
          label="已确认漏洞"
          value={metrics.confirmed}
          trend={`${metrics.reportReady} 条可提交`}
          icon="✓"
          variant="green"
        />
        <MetricCard
          label="证据成熟度"
          value={`${metrics.evidenceMaturity.verified}/${metrics.active}`}
          trend={`${metrics.evidenceMaturity.supported} 条已验证`}
          icon="🎯"
          variant="teal"
        />
        <MetricCard
          label="需要关注"
          value={metrics.blocked}
          trend={`${metrics.archived} 条已归档`}
          icon="⚠️"
          variant="orange"
        />
      </section>

      {/* 主内容区域 - 左右布局 */}
      <div className="omv-content-grid">
        {/* 左侧主要内容 - 优先队列 */}
        <section className="omv-card omv-card-primary">
          <div className="omv-card-header">
            <div className="omv-card-header-content">
              <h2 className="omv-card-title">优先审计队列</h2>
              <p className="omv-card-subtitle">按证据成熟度和紧急程度排序</p>
            </div>
            <button
              type="button"
              className="omv-btn omv-btn-ghost omv-btn-sm"
              onClick={() => onTab('findings')}
            >
              查看全部 →
            </button>
          </div>

          <div className="omv-card-body">
            {priorityFindings.length === 0 ? (
              <div className="omv-empty-state">
                <div className="omv-empty-icon">📭</div>
                <h3 className="omv-empty-title">暂无待审计项</h3>
                <p className="omv-empty-description">创建第一个漏洞候选开始研究</p>
                <button type="button" className="omv-btn omv-btn-secondary" onClick={onNew}>
                  创建候选
                </button>
              </div>
            ) : (
              <ul className="omv-finding-list">
                {priorityFindings.map(finding => (
                  <li
                    key={finding.id}
                    className="omv-finding-item"
                    onClick={() => onFinding(finding.id)}
                  >
                    <div className="omv-finding-item-header">
                      <span className="omv-finding-id">{finding.id}</span>
                      <span className="omv-finding-status" data-status={finding.status}>
                        {finding.status}
                      </span>
                    </div>
                    <div className="omv-finding-item-body">
                      <h4 className="omv-finding-package">{finding.package}</h4>
                      <p className="omv-finding-vuln">{finding.vulnerability}</p>
                    </div>
                    <div className="omv-finding-item-footer">
                      <span className="omv-finding-next-action">{finding.nextAction}</span>
                      <span className="omv-finding-chevron">→</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* 右侧辅助信息栏 */}
        <div className="omv-sidebar">
          {/* 态势总览 */}
          <section className="omv-card">
            <div className="omv-card-header">
              <h3 className="omv-card-title-sm">态势分布</h3>
            </div>
            <div className="omv-card-body">
              <PostureChart metrics={metrics} onTab={onTab} />
            </div>
          </section>

          {/* 最近活动 */}
          <section className="omv-card">
            <div className="omv-card-header">
              <h3 className="omv-card-title-sm">最近活动</h3>
            </div>
            <div className="omv-card-body">
              <ActivityTimeline activities={data.activity.slice(0, 5)} />
            </div>
          </section>

          {/* 快速操作 */}
          <section className="omv-card">
            <div className="omv-card-header">
              <h3 className="omv-card-title-sm">快速操作</h3>
            </div>
            <div className="omv-card-body">
              <div className="omv-quick-actions">
                <button
                  type="button"
                  className="omv-quick-action"
                  onClick={() => onTab('campaigns')}
                >
                  <span className="omv-quick-action-icon">🚀</span>
                  <span className="omv-quick-action-label">查看战役</span>
                </button>
                <button
                  type="button"
                  className="omv-quick-action"
                  onClick={onNew}
                >
                  <span className="omv-quick-action-icon">➕</span>
                  <span className="omv-quick-action-label">新建候选</span>
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// 重新设计的组件
// ============================================================================

function MetricCard({ label, value, trend, icon, variant, onClick }: {
  label: string
  value: number | string
  trend: string
  icon: string
  variant: 'blue' | 'green' | 'teal' | 'orange'
  onClick?: () => void
}) {
  return (
    <div
      className={`omv-metric-card omv-metric-card-${variant}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="omv-metric-icon">{icon}</div>
      <div className="omv-metric-content">
        <div className="omv-metric-value">{value}</div>
        <div className="omv-metric-label">{label}</div>
        <div className="omv-metric-trend">{trend}</div>
      </div>
    </div>
  )
}

function PostureChart({ metrics, onTab }: {
  metrics: DashboardPayload['metrics']
  onTab: (tab: Tab) => void
}) {
  const total = metrics.active + metrics.archived
  const stages = [
    { label: '候选', value: metrics.candidates, color: 'var(--omv-blue)' },
    { label: '已确认', value: metrics.confirmed, color: 'var(--omv-green)' },
    { label: '阻塞', value: metrics.blocked, color: 'var(--omv-orange)' },
    { label: '归档', value: metrics.archived, color: 'var(--omv-muted)' },
  ]

  return (
    <div className="omv-posture-chart">
      {stages.map(stage => {
        const percentage = total > 0 ? Math.round((stage.value / total) * 100) : 0
        return (
          <div
            key={stage.label}
            className="omv-posture-item"
            onClick={() => onTab('findings')}
          >
            <div className="omv-posture-bar">
              <div
                className="omv-posture-fill"
                style={{ width: `${percentage}%`, background: stage.color }}
              />
            </div>
            <div className="omv-posture-meta">
              <span className="omv-posture-label">{stage.label}</span>
              <span className="omv-posture-value">{stage.value}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ActivityTimeline({ activities }: {
  activities: DashboardPayload['activity']
}) {
  if (activities.length === 0) {
    return (
      <div className="omv-empty-state-sm">
        <p>暂无活动记录</p>
      </div>
    )
  }

  return (
    <ul className="omv-activity-list">
      {activities.map((activity, idx) => (
        <li key={`${activity.timestamp}-${idx}`} className="omv-activity-item">
          <div className="omv-activity-dot" />
          <div className="omv-activity-content">
            <p className="omv-activity-action">{activity.action}</p>
            <p className="omv-activity-time">{new Date(activity.timestamp).toLocaleString('zh-CN', {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
