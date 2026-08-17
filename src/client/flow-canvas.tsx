import { useMemo, useRef, useState } from 'react'
import type { EvidenceGraph, EvidenceGraphNode } from '../contracts.js'
import { DEFAULT_GRAPH_LAYOUT, layoutEvidenceGraph, truncateForCanvas, type LaidOutNode } from './graph-layout.js'
import { useCanvasViewport } from './hooks.js'
import { formatTime } from './runtime.js'
import { Icon } from './ui.js'

/**
 * Interactive evidence attack-path canvas: layered SVG with pan/zoom, kind
 * glyphs, guard gates, and an inspector strip. The layout is deterministic
 * (see graph-layout.ts), so the same evidence always paints the same picture.
 */

type KindStyle = { label: string; color: string }

const KIND_STYLES: Record<EvidenceGraphNode['kind'], KindStyle> = {
  finding: { label: '发现', color: 'var(--omv-text)' },
  claim: { label: '漏洞主张', color: 'var(--omv-blue)' },
  source: { label: '入口', color: 'var(--omv-blue)' },
  sink: { label: '汇聚点', color: 'var(--omv-red)' },
  guard: { label: '防护闸', color: 'var(--omv-green)' },
  reproducer: { label: '复现', color: 'var(--omv-teal)' },
  observation: { label: '观测', color: 'var(--omv-teal)' },
  session: { label: '会话', color: 'var(--omv-purple)' },
  artifact: { label: '制品', color: 'var(--omv-muted)' },
}

const FALLBACK_KIND: KindStyle = { label: '证据', color: 'var(--omv-blue)' }

const kindStyle = (kind: EvidenceGraphNode['kind']): KindStyle => KIND_STYLES[kind] ?? FALLBACK_KIND

interface EdgeStyle { stroke: string; dash?: string; marker: string; width: number }

const EDGE_STYLES: Record<string, EdgeStyle> = {
  flows_to: { stroke: 'var(--omv-blue)', marker: 'omv-arrow-strong', width: 2 },
  guarded_by: { stroke: 'var(--omv-orange)', dash: '5 4', marker: 'omv-arrow-warn', width: 1.6 },
  reproduced_by: { stroke: 'var(--omv-teal)', marker: 'omv-arrow-teal', width: 1.6 },
  observed_as: { stroke: 'var(--omv-teal)', dash: '4 4', marker: 'omv-arrow-teal', width: 1.4 },
  describes: { stroke: 'var(--omv-faint)', marker: 'omv-arrow-muted', width: 1.3 },
  produced_in: { stroke: 'var(--omv-purple)', dash: '3 4', marker: 'omv-arrow-muted', width: 1.2 },
  attached_as: { stroke: 'var(--omv-faint)', dash: '3 4', marker: 'omv-arrow-muted', width: 1.2 },
}

const FALLBACK_EDGE: EdgeStyle = { stroke: 'var(--omv-faint)', marker: 'omv-arrow-muted', width: 1.2 }

const edgeStyle = (relation: string): EdgeStyle => EDGE_STYLES[relation] ?? FALLBACK_EDGE

const STATE_LABELS: Record<EvidenceGraphNode['state'], string> = { verified: '已验证', known: '已知', unknown: '未知' }

function KindGlyph({ kind, size = 13 }: { kind: EvidenceGraphNode['kind']; size?: number }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.1, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  switch (kind) {
    case 'source': return <svg {...props}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.5 12 8l2.5 2.5" /></svg>
    case 'sink': return <svg {...props}><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>
    case 'guard': return <svg {...props}><path d="M12 3 5 6v5c0 4.5 2.7 7.7 7 9 4.3-1.3 7-4.5 7-9V6l-7-3Z" /></svg>
    case 'reproducer': return <svg {...props}><rect x="3" y="4.5" width="18" height="15" rx="2" /><path d="m7 9.5 3 3-3 3M13 15h4" /></svg>
    case 'observation': return <svg {...props}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.6" /></svg>
    case 'session': return <svg {...props}><path d="M4 5.5h16v10H9l-4 3.5v-3.5H4Z" /><path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" /></svg>
    case 'artifact': return <svg {...props}><path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5Z" /><path d="M14 3.5V9h5" /></svg>
    case 'claim': return <svg {...props}><path d="M6 21V4M6 5h12l-2.5 4L18 13H6" /></svg>
    default: return <svg {...props}><circle cx="12" cy="12" r="8" /></svg>
  }
}

export function EvidenceFlowCanvas({ graph, onOpenPath }: { graph: EvidenceGraph; onOpenPath?: (path: string) => void }) {
  const viewHeight = 320
  const [showSupporting, setShowSupporting] = useState(false)
  const [selected, setSelected] = useState<string>()
  const visibleGraph = useMemo(() => {
    if (showSupporting) return graph
    const visibleIds = new Set(graph.nodes.filter(node => !['session', 'artifact'].includes(node.kind)).map(node => node.id))
    return {
      ...graph,
      nodes: graph.nodes.filter(node => visibleIds.has(node.id)),
      edges: graph.edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to)),
    }
  }, [graph, showSupporting])
  const layout = useMemo(() => layoutEvidenceGraph(visibleGraph), [visibleGraph])
  const containerRef = useRef<HTMLDivElement>(null)
  const canvas = useCanvasViewport(containerRef, layout.width, layout.height, viewHeight, `${graph.generatedAt}:${showSupporting ? 'all' : 'path'}`)
  const { viewport } = canvas

  const selectedNode = layout.nodes.find(item => item.node.id === selected)
  return (
    <div className="omv-flow">
      <div className="omv-flow-toolbar">
        <div className="omv-flow-legend">
          <span><i style={{ background: 'var(--omv-blue)' }} />入口</span>
          <span><i style={{ background: 'var(--omv-red)' }} />汇聚</span>
          <span><i style={{ background: 'var(--omv-green)' }} />防护</span>
          <span><i style={{ background: 'var(--omv-teal)' }} />复现</span>
          <span><i className="omv-flow-legend-dash" />未验证边</span>
        </div>
        <div className="omv-flow-zoom">
          <button type="button" className="omv-flow-mode" aria-pressed={!showSupporting} onClick={() => { setShowSupporting(false); setSelected(undefined) }}>主路径</button>
          <button type="button" className="omv-flow-mode" aria-pressed={showSupporting} onClick={() => setShowSupporting(true)}>全部证据 <small>{graph.nodes.length}</small></button>
          <button type="button" aria-label="缩小" onClick={() => canvas.zoomBy(1 / 1.25)}>−</button>
          <button type="button" aria-label="放大" onClick={() => canvas.zoomBy(1.25)}>＋</button>
          <button type="button" aria-label="适配图谱" onClick={canvas.fit}>适配</button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="omv-flow-canvas"
        onWheel={canvas.onWheel}
        onPointerDown={canvas.onPointerDown}
        onPointerMove={canvas.onPointerMove}
        onPointerUp={canvas.onPointerUp}
        onPointerCancel={canvas.onPointerCancel}
      >
        <svg width="100%" height={viewHeight} viewBox={`0 0 ${canvas.viewWidth || layout.width} ${viewHeight}`} preserveAspectRatio="none" role="img" aria-label={`证据图谱：${visibleGraph.nodes.length} 节点`}>
          <defs>
            {(['strong', 'warn', 'teal', 'muted'] as const).map(tone => (
              <marker key={tone} id={`omv-arrow-${tone}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0.8 7.2 4 0 7.2Z" fill={tone === 'strong' ? 'var(--omv-blue)' : tone === 'warn' ? 'var(--omv-orange)' : tone === 'teal' ? 'var(--omv-teal)' : 'var(--omv-faint)'} />
              </marker>
            ))}
          </defs>
          <g transform={`translate(${viewport.tx} ${viewport.ty}) scale(${viewport.k})`}>
            {layout.edges.map((edge, index) => {
              const style = edgeStyle(edge.relation)
              const verified = layout.nodes.find(item => item.node.id === edge.from)?.node.state === 'verified'
              return (
                <path
                  key={`${edge.from}-${edge.to}-${index}`}
                  d={edge.d}
                  fill="none"
                  stroke={style.stroke}
                  strokeWidth={style.width}
                  strokeDasharray={verified && style.dash === undefined ? undefined : style.dash ?? '10 7'}
                  markerEnd={`url(#${style.marker})`}
                  className="omv-flow-edge"
                />
              )
            })}
            {layout.nodes.map(item => (
              <FlowNode
                key={item.node.id}
                item={item}
                selected={selected === item.node.id}
                onSelect={() => setSelected(previous => (previous === item.node.id ? undefined : item.node.id))}
              />
            ))}
          </g>
        </svg>
      </div>
      {selectedNode === undefined ? (
        <div className="omv-flow-inspector omv-flow-inspector-empty" aria-live="polite"><span>点击节点查看证据详情</span><small>{showSupporting ? '已显示全部证据' : `主路径 · ${visibleGraph.nodes.length}/${graph.nodes.length} 个节点`}{onOpenPath === undefined ? '' : ' · 带文件角标可打开源码'}</small></div>
      ) : (
        <div className="omv-flow-inspector" aria-live="polite">
          <span className="omv-flow-inspector-kind" style={{ background: kindStyle(selectedNode.node.kind).color }}>
            {kindStyle(selectedNode.node.kind).label}
          </span>
          <div className="omv-flow-inspector-copy">
            <strong>{selectedNode.node.label}</strong>
            <span>{truncateForCanvas(selectedNode.node.value, 110)}</span>
            <small>
              {STATE_LABELS[selectedNode.node.state]} · {selectedNode.node.path ?? '无路径'}
              {selectedNode.node.line === undefined ? '' : `:${selectedNode.node.line}`}
              {selectedNode.node.timestamp === undefined ? '' : ` · ${formatTime(selectedNode.node.timestamp)}`}
            </small>
          </div>
          {selectedNode.openablePath !== undefined && onOpenPath !== undefined
            ? <button type="button" className="omv-secondary" onClick={() => onOpenPath(selectedNode.openablePath!)}><Icon name="file" size={11} />打开源码</button>
            : undefined}
        </div>
      )}
      <span className="omv-flow-hint">拖拽平移 · ⌘/Ctrl+滚轮 或 ± 缩放</span>
    </div>
  )
}

function FlowNode({ item, selected, onSelect }: { item: LaidOutNode; selected: boolean; onSelect: () => void }) {
  const { node } = item
  const style = kindStyle(node.kind)
  const { nodeWidth: width, nodeHeight: height } = DEFAULT_GRAPH_LAYOUT
  const guardBroken = node.kind === 'guard' && node.state === 'unknown'
  return (
    <g
      transform={`translate(${item.x} ${item.y})`}
      className={`omv-flow-node${selected ? ' selected' : ''}${item.openablePath !== undefined ? ' openable' : ''}`}
      data-state={node.state}
      data-kind={node.kind}
      role="button"
      tabIndex={0}
      aria-label={`${style.label} ${node.label}`}
      onClick={onSelect}
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect() } }}
    >
      <title>{`${style.label} · ${node.label}\n${node.value}${node.path === undefined ? '' : `\n${node.path}${node.line === undefined ? '' : `:${node.line}`}`}`}</title>
      <rect width={width} height={height} rx={9} />
      <rect width={4} height={height} rx={2} fill={style.color} />
      <g transform={`translate(14 ${height / 2 - 13})`} className="omv-flow-glyph" style={{ color: style.color }}><KindGlyph kind={node.kind} /></g>
      <text x={38} y={21} className="omv-flow-node-kind">{style.label}{guardBroken ? ' · 缺失' : ''}</text>
      <text x={38} y={39} className="omv-flow-node-value">{truncateForCanvas(node.value, 24)}</text>
      {node.state === 'verified' && <circle cx={width - 12} cy={12} r={4.5} className="omv-flow-verified-dot" />}
      {item.openablePath !== undefined && <g transform={`translate(${width - 26} ${height - 16})`} className="omv-flow-file-badge"><rect width="12" height="12" rx="2.5" /><path d="M3.5 6h5M3.5 8.5h3.5" /></g>}
      {guardBroken && <path d={`M ${width - 30} 6 l6 8 M ${width - 22} 10 l-7 9`} className="omv-flow-crack" />}
    </g>
  )
}
