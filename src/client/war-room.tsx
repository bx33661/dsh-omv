import { useMemo, useRef, useState } from 'react'
import { layoutWarRoom, truncateForCanvas, WAR_ROOM_NODE, warRoomEdgePath } from './graph-layout.js'
import { useCanvasViewport } from './hooks.js'
import { statusColor, statusLabel } from './runtime.js'
import { Icon } from './ui.js'

/**
 * Campaign war room: the target seed radiates its audit lanes on an arc, each
 * lane carrying live run status. Selecting a lane moves its controls into the
 * inspector strip, so the map — not a separate list — is the control surface.
 */

export interface WarRoomLaneView {
  id: string
  title: string
  detail: string
  status: string
  attempts: number
  summary?: string | undefined
  sessionId?: string | undefined
  findingId?: string | undefined
}

export interface CampaignWarRoomProps {
  target: string
  ecosystem: string
  lanes: WarRoomLaneView[]
  onControl?: (runId: string, control: 'pause' | 'resume' | 'cancel' | 'retry', laneId?: string) => void
  onOpenSession?: (sessionId: string) => void
  onFinding?: (findingId: string) => void
}

const ACTIVE_STATES = new Set(['running', 'dispatching'])

function laneStroke(status: string): string {
  return status === 'pending' ? 'var(--omv-faint)' : statusColor(status)
}

export function CampaignWarRoom({ target, ecosystem, lanes, onControl, onOpenSession, onFinding }: CampaignWarRoomProps) {
  const layout = useMemo(() => layoutWarRoom(lanes.length), [lanes.length])
  const containerRef = useRef<HTMLDivElement>(null)
  const canvas = useCanvasViewport(containerRef, layout.width, layout.height, 300, `${target}-${lanes.length}`)
  const [selected, setSelected] = useState<string>()
  const selectedLane = lanes.find(lane => lane.id === selected)
  const retryable = selectedLane !== undefined && ['failed', 'blocked', 'awaiting_evidence', 'cancelled'].includes(selectedLane.status)

  return (
    <div className="omv-war">
      <div className="omv-war-toolbar">
        <div className="omv-flow-legend">
          <span><i style={{ background: 'var(--omv-green)' }} />已收敛</span>
          <span><i style={{ background: 'var(--omv-blue)' }} />执行中</span>
          <span><i style={{ background: 'var(--omv-orange)' }} />待处理</span>
          <span><i style={{ background: 'var(--omv-faint)' }} />未启动</span>
        </div>
        <div className="omv-flow-zoom">
          <button type="button" aria-label="缩小" onClick={() => canvas.zoomBy(1 / 1.25)}>−</button>
          <button type="button" aria-label="放大" onClick={() => canvas.zoomBy(1.25)}>＋</button>
          <button type="button" onClick={canvas.fit}>适配</button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="omv-war-canvas"
        onWheel={canvas.onWheel}
        onPointerDown={canvas.onPointerDown}
        onPointerMove={canvas.onPointerMove}
        onPointerUp={canvas.onPointerUp}
        onPointerCancel={canvas.onPointerCancel}
      >
        <svg width={layout.width} height={layout.height} role="img" aria-label={`作战地图：${target} · ${lanes.length} 条审计 Lane`}>
          <defs>
            {lanes.map(lane => (
              <marker key={lane.id} id={`omv-war-arrow-${lane.id}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0.8 7.2 4 0 7.2Z" fill={laneStroke(lane.status)} />
              </marker>
            ))}
          </defs>
          <g transform={`translate(${canvas.viewport.tx} ${canvas.viewport.ty}) scale(${canvas.viewport.k})`}>
            {lanes.map((lane, index) => {
              const spot = layout.lanes[index]!
              return (
                <path
                  key={`edge-${lane.id}`}
                  d={warRoomEdgePath(layout.seed.x, layout.seed.y, spot.x, spot.y)}
                  fill="none"
                  stroke={laneStroke(lane.status)}
                  strokeWidth={ACTIVE_STATES.has(lane.status) ? 2.2 : 1.5}
                  strokeDasharray={lane.status === 'pending' ? '4 5' : undefined}
                  markerEnd={`url(#omv-war-arrow-${lane.id})`}
                  className="omv-flow-edge"
                />
              )
            })}
            <g transform={`translate(${layout.seed.x} ${layout.seed.y})`} className="omv-war-seed">
              <rect width={WAR_ROOM_NODE.seedWidth} height={WAR_ROOM_NODE.seedHeight} rx={10} />
              <text x={14} y={22} className="omv-war-seed-kicker">种子目标</text>
              <text x={14} y={41} className="omv-war-seed-title">{truncateForCanvas(target, 20)}</text>
              <text x={14} y={55} className="omv-war-seed-meta">{ecosystem}</text>
            </g>
            {lanes.map((lane, index) => {
              const spot = layout.lanes[index]!
              const stroke = laneStroke(lane.status)
              const active = ACTIVE_STATES.has(lane.status)
              return (
                <g
                  key={lane.id}
                  transform={`translate(${spot.x} ${spot.y})`}
                  className={`omv-war-lane${selected === lane.id ? ' selected' : ''}${active ? ' active' : ''}`}
                  data-status={lane.status}
                  role="button"
                  tabIndex={0}
                  aria-label={`Lane ${index + 1} ${lane.title} · ${statusLabel(lane.status)}`}
                  onClick={() => setSelected(previous => (previous === lane.id ? undefined : lane.id))}
                  onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(previous => (previous === lane.id ? undefined : lane.id)) } }}
                >
                  {active && <rect x={-4} y={-4} width={WAR_ROOM_NODE.width + 8} height={WAR_ROOM_NODE.height + 8} rx={12} className="omv-war-pulse" />}
                  <rect width={WAR_ROOM_NODE.width} height={WAR_ROOM_NODE.height} rx={9} />
                  <rect width={4} height={WAR_ROOM_NODE.height} rx={2} fill={stroke} />
                  <text x={14} y={21} className="omv-war-lane-index">Lane {String(index + 1).padStart(2, '0')}</text>
                  <text x={64} y={21} className="omv-war-lane-status" fill={stroke}>{statusLabel(lane.status)}</text>
                  <text x={14} y={39} className="omv-war-lane-title">{truncateForCanvas(lane.title, 24)}</text>
                  <text x={14} y={55} className="omv-war-lane-meta">{truncateForCanvas(lane.detail, 30)}{lane.attempts > 1 ? ` · 尝试 ${lane.attempts}` : ''}</text>
                  {lane.summary !== undefined && <circle cx={WAR_ROOM_NODE.width - 11} cy={12} r={4} className="omv-war-note-dot" />}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
      {selectedLane === undefined ? (
        <div className="omv-flow-inspector omv-flow-inspector-empty">点击 Lane 节点查看执行详情与操作；拖拽平移 · ⌘/Ctrl+滚轮缩放</div>
      ) : (
        <div className="omv-flow-inspector">
          <span className="omv-flow-inspector-kind" style={{ background: laneStroke(selectedLane.status) }}>{statusLabel(selectedLane.status)}</span>
          <div className="omv-flow-inspector-copy">
            <strong>{selectedLane.title}</strong>
            <span>{selectedLane.detail}{selectedLane.findingId === undefined ? '' : ` · ${selectedLane.findingId}`}</span>
            <small>尝试 {selectedLane.attempts} 次{selectedLane.summary === undefined ? '' : ` · ${truncateForCanvas(selectedLane.summary, 80)}`}</small>
          </div>
          <div className="omv-war-inspector-actions">
            {selectedLane.findingId !== undefined && onFinding !== undefined && (
              <button type="button" className="omv-secondary" onClick={() => onFinding(selectedLane.findingId!)}><Icon name="finding" size={11} />Finding</button>
            )}
            {selectedLane.sessionId !== undefined && onOpenSession !== undefined && (
              <button type="button" className="omv-secondary" onClick={() => onOpenSession(selectedLane.sessionId!)}><Icon name="terminal" size={11} />会话</button>
            )}
            {retryable && onControl !== undefined && (
              <button type="button" className="omv-secondary" onClick={() => onControl(selectedLane.id, 'retry', selectedLane.id)}><Icon name="refresh" size={11} />重试此 Lane</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
