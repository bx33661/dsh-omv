import type { EvidenceGraph, EvidenceGraphEdge, EvidenceGraphNode } from '../contracts.js'

/**
 * Deterministic layered layout for the evidence flow canvas. Pure on purpose:
 * the same graph always produces the same picture, and tests can pin it down.
 * Layers follow the narrative direction (finding → claim → evidence → results)
 * computed as longest-path depth, so `source → sink → guard` reads left to right
 * and cycle-safe by ignoring back edges.
 */

export interface GraphLayoutOptions {
  nodeWidth: number
  nodeHeight: number
  columnGap: number
  rowGap: number
  padding: number
}

export const DEFAULT_GRAPH_LAYOUT: GraphLayoutOptions = {
  nodeWidth: 208,
  nodeHeight: 58,
  columnGap: 84,
  rowGap: 16,
  padding: 20,
}

/** Rendering order inside a column: the kill chain first, supporting facts after. */
const KIND_ORDER: Record<EvidenceGraphNode['kind'], number> = {
  finding: 0,
  claim: 1,
  source: 2,
  sink: 3,
  guard: 4,
  reproducer: 5,
  observation: 6,
  session: 7,
  artifact: 8,
}

export interface LaidOutNode {
  node: EvidenceGraphNode
  x: number
  y: number
  layer: number
  openablePath: string | undefined
}

export interface LaidOutEdge extends EvidenceGraphEdge {
  d: string
}

export interface GraphLayout {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  width: number
  height: number
  columns: number
}

export function openablePathOf(node: EvidenceGraphNode): string | undefined {
  if (node.codeRef?.path !== undefined && node.codeRef.path !== '') return node.codeRef.path
  const match = node.value.match(/(?:^|\s)([^\s:]+\.[A-Za-z0-9]+):\d+(?:-\d+|:\d+)?/)
  return match?.[1]
}

export function layoutEvidenceGraph(graph: EvidenceGraph, options: GraphLayoutOptions = DEFAULT_GRAPH_LAYOUT): GraphLayout {
  const { nodeWidth, nodeHeight, columnGap, rowGap, padding } = options
  const byId = new Map(graph.nodes.map(node => [node.id, node]))
  const outgoing = new Map<string, EvidenceGraphEdge[]>()
  const incoming = new Map<string, EvidenceGraphEdge[]>()
  for (const edge of graph.edges) {
    if (!byId.has(edge.from) || !byId.has(edge.to)) continue
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge])
    incoming.set(edge.to, [...(incoming.get(edge.to) ?? []), edge])
  }

  // Longest-path layering with a visiting guard so cyclic input still lays out.
  const layerOf = new Map<string, number>()
  const visiting = new Set<string>()
  const depth = (id: string): number => {
    const cached = layerOf.get(id)
    if (cached !== undefined) return cached
    if (visiting.has(id)) return 0
    visiting.add(id)
    let level = 0
    const parents = incoming.get(id) ?? []
    for (const edge of parents) {
      level = Math.max(level, depth(edge.from) + 1)
    }
    // Orphan chains (e.g. source→sink→guard has no edge back to the finding
    // root) still read left to right: anchor them one column below the root.
    if (parents.length === 0 && byId.get(id)?.kind !== 'finding') level = Math.max(level, 1)
    visiting.delete(id)
    layerOf.set(id, level)
    return level
  }
  for (const node of graph.nodes) depth(node.id)

  const maxLayer = Math.max(0, ...graph.nodes.map(node => layerOf.get(node.id) ?? 0))
  const columns: EvidenceGraphNode[][] = Array.from({ length: maxLayer + 1 }, () => [])
  for (const node of graph.nodes) {
    const column = columns[layerOf.get(node.id) ?? 0]
    if (column !== undefined) column.push(node)
  }
  for (const column of columns) {
    column.sort((left, right) =>
      (KIND_ORDER[left.kind] ?? 99) - (KIND_ORDER[right.kind] ?? 99) ||
      left.id.localeCompare(right.id),
    )
  }

  const columnSize = Math.max(...columns.map(column => column.length))
  const nodes: LaidOutNode[] = []
  columns.forEach((column, layer) => {
    const columnHeight = column.length * nodeHeight + (column.length - 1) * rowGap
    const topOffset = padding + ((columnSize * nodeHeight + (columnSize - 1) * rowGap) - columnHeight) / 2
    column.forEach((node, index) => {
      nodes.push({
        node,
        layer,
        x: padding + layer * (nodeWidth + columnGap),
        y: topOffset + index * (nodeHeight + rowGap),
        openablePath: openablePathOf(node),
      })
    })
  })

  const positioned = new Map(nodes.map(item => [item.node.id, item]))
  const edges: LaidOutEdge[] = []
  for (const edge of graph.edges) {
    const from = positioned.get(edge.from)
    const to = positioned.get(edge.to)
    if (from === undefined || to === undefined) continue
    edges.push({ ...edge, d: edgePath(from.x, from.y, nodeWidth, nodeHeight, to.x, to.y) })
  }

  const width = padding * 2 + maxLayer * (nodeWidth + columnGap) + nodeWidth
  const height = padding * 2 + columnSize * nodeHeight + (columnSize - 1) * rowGap
  return { nodes, edges, width: Math.max(width, nodeWidth + padding * 2), height: Math.max(height, nodeHeight + padding * 2), columns: maxLayer + 1 }
}

/** Horizontal cubic bezier between the right edge of `from` and the left edge of `to`. */
export function edgePath(fromX: number, fromY: number, nodeWidth: number, nodeHeight: number, toX: number, toY: number): string {
  const x1 = fromX + nodeWidth
  const y1 = fromY + nodeHeight / 2
  const x2 = toX
  const y2 = toY + nodeHeight / 2
  const bend = Math.max(28, Math.abs(x2 - x1) / 2)
  const forward = x2 + bend > x1
  const c1x = forward ? x1 + bend : x1 - bend * 0.4
  const c2x = forward ? x2 - bend : x2 - bend * 0.8
  const midY = (y1 + y2) / 2
  return forward
    ? `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`
    // Back edge (cycle-guarded input): dip below both nodes to stay readable.
    : `M ${x1} ${y1} C ${x1 + bend} ${midY + 46}, ${x2 - bend} ${midY + 46}, ${x2} ${y2}`
}

/** Truncate free-form evidence text to fit one canvas line. */
export function truncateForCanvas(value: string, max = 34): string {
  const flat = value.replaceAll(/\s+/gu, ' ').trim()
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`
}

// ── Campaign war room ────────────────────────────────────────────────────────

/**
 * Radial "diffusion" layout for the campaign war room: the target seed sits on
 * the left and its audit lanes fan out on an arc to the right, so a run reads
 * as one seed radiating hypotheses. Pure and deterministic like the flow
 * layout above.
 */

export const WAR_ROOM_NODE = { width: 212, height: 64, seedWidth: 176, seedHeight: 64 }

export interface WarRoomLaneSpot {
  index: number
  x: number
  y: number
}

export interface WarRoomLayout {
  seed: { x: number; y: number }
  lanes: WarRoomLaneSpot[]
  width: number
  height: number
}

export function layoutWarRoom(laneCount: number, padding = 20): WarRoomLayout {
  const count = Math.max(0, laneCount)
  const laneSpacing = WAR_ROOM_NODE.height + 16
  const radiusX = 300
  // Even vertical spacing guarantees non-overlap; the x arc keeps the fan look.
  const height = Math.max(
    WAR_ROOM_NODE.height * 2 + padding * 2,
    (count - 1) * laneSpacing + WAR_ROOM_NODE.height + padding * 2,
  )
  const centerY = height / 2 - WAR_ROOM_NODE.height / 2
  const seed = { x: padding, y: centerY }
  const spread = count <= 1 ? 0 : Math.min(Math.PI / 2.4, (Math.PI / 2) * Math.min(1, count / 7))
  const lanes: WarRoomLaneSpot[] = Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1)
    const angle = (t - 0.5) * 2 * spread
    return {
      index,
      x: padding + WAR_ROOM_NODE.seedWidth + radiusX * Math.cos(angle * 0.92),
      y: centerY + (t - 0.5) * (count - 1) * laneSpacing,
    }
  })
  const rightMost = lanes.reduce((max, lane) => Math.max(max, lane.x + WAR_ROOM_NODE.width), seed.x + WAR_ROOM_NODE.seedWidth)
  return { seed, lanes, width: rightMost + padding, height }
}

/** Bezier from the seed's right edge to a lane's left edge. */
export function warRoomEdgePath(seedX: number, seedY: number, laneX: number, laneY: number): string {
  const x1 = seedX + WAR_ROOM_NODE.seedWidth
  const y1 = seedY + WAR_ROOM_NODE.seedHeight / 2
  const x2 = laneX
  const y2 = laneY + WAR_ROOM_NODE.height / 2
  const bend = Math.max(40, (x2 - x1) * 0.55)
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`
}
