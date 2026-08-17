import { describe, expect, it } from 'vitest'
import { DEFAULT_GRAPH_LAYOUT, WAR_ROOM_NODE, layoutEvidenceGraph, layoutWarRoom, openablePathOf, truncateForCanvas, warRoomEdgePath } from '../src/client/graph-layout.js'
import type { EvidenceGraph, EvidenceGraphEdge, EvidenceGraphNode } from '../src/contracts.js'

const node = (id: string, kind: EvidenceGraphNode['kind'], value = id): EvidenceGraphNode => ({
  id, kind, label: id, value, state: 'known',
})
const edge = (from: string, to: string, relation: EvidenceGraphEdge['relation'] = 'flows_to'): EvidenceGraphEdge => ({
  from, to, relation,
})

const findingGraph = (): EvidenceGraph => ({
  findingId: 'demo',
  generatedAt: '2026-08-17T00:00:00Z',
  nodes: [
    node('finding:demo', 'finding'),
    node('finding:demo:claim', 'claim'),
    node('finding:demo:source', 'source', 'index.js:29 matter(input)'),
    node('finding:demo:sink', 'sink', 'engines.js:43 eval(str)'),
    node('finding:demo:guard', 'guard', 'None'),
    node('finding:demo:reproducer', 'reproducer'),
    node('finding:demo:observation', 'observation'),
  ],
  edges: [
    edge('finding:demo', 'finding:demo:claim', 'describes'),
    edge('finding:demo:source', 'finding:demo:sink', 'flows_to'),
    edge('finding:demo:sink', 'finding:demo:guard', 'guarded_by'),
    edge('finding:demo:claim', 'finding:demo:reproducer', 'reproduced_by'),
    edge('finding:demo:reproducer', 'finding:demo:observation', 'observed_as'),
  ],
})

describe('evidence graph layout', () => {
  it('layers the kill chain left to right, anchoring orphan chains below the root', () => {
    const layout = layoutEvidenceGraph(findingGraph())
    const layerOf = new Map(layout.nodes.map(item => [item.node.id, item.layer]))
    expect(layerOf.get('finding:demo')).toBe(0)
    expect(layerOf.get('finding:demo:claim')).toBe(1)
    // source→sink→guard has no incoming edge from the root; it must still
    // read left to right starting one column below the finding.
    expect(layerOf.get('finding:demo:source')).toBe(1)
    expect(layerOf.get('finding:demo:sink')).toBe(2)
    expect(layerOf.get('finding:demo:guard')).toBe(3)
    expect(layerOf.get('finding:demo:reproducer')).toBe(2)
    expect(layerOf.get('finding:demo:observation')).toBe(3)
    expect(layout.columns).toBe(4)
    // every node sits strictly right of its parent
    for (const item of layout.nodes) {
      for (const connection of layout.edges.filter(e => e.to === item.node.id)) {
        const parent = layout.nodes.find(n => n.node.id === connection.from)!
        expect(item.x).toBeGreaterThan(parent.x)
      }
    }
  })

  it('produces a path string per edge and sizes the canvas to the grid', () => {
    const layout = layoutEvidenceGraph(findingGraph())
    expect(layout.edges).toHaveLength(5)
    for (const connection of layout.edges) {
      expect(connection.d).toMatch(/^M -?\d+(?:\.\d+)? -?\d+(?:\.\d+)? C /)
    }
    const expectedWidth = DEFAULT_GRAPH_LAYOUT.padding * 2 + 3 * (DEFAULT_GRAPH_LAYOUT.nodeWidth + DEFAULT_GRAPH_LAYOUT.columnGap) + DEFAULT_GRAPH_LAYOUT.nodeWidth
    expect(Math.round(layout.width)).toBe(Math.round(expectedWidth))
    expect(layout.height).toBeGreaterThan(0)
  })

  it('keeps every node inside the canvas bounds and never overlaps within a column', () => {
    const layout = layoutEvidenceGraph(findingGraph())
    for (const item of layout.nodes) {
      expect(item.x).toBeGreaterThanOrEqual(0)
      expect(item.y).toBeGreaterThanOrEqual(0)
      expect(item.x + DEFAULT_GRAPH_LAYOUT.nodeWidth).toBeLessThanOrEqual(layout.width + 1)
      expect(item.y + DEFAULT_GRAPH_LAYOUT.nodeHeight).toBeLessThanOrEqual(layout.height + 1)
    }
    const columns = new Map<number, number[]>()
    for (const item of layout.nodes) columns.set(item.layer, [...(columns.get(item.layer) ?? []), item.y])
    for (const ys of columns.values()) {
      const sorted = [...ys].sort((a, b) => a - b)
      for (let index = 1; index < sorted.length; index += 1) {
        expect(sorted[index]! - sorted[index - 1]!).toBeGreaterThanOrEqual(DEFAULT_GRAPH_LAYOUT.nodeHeight + DEFAULT_GRAPH_LAYOUT.rowGap - 1)
      }
    }
  })

  it('survives cycles and empty graphs without throwing', () => {
    const cyclic: EvidenceGraph = {
      findingId: 'c', generatedAt: 't',
      nodes: [node('a', 'source'), node('b', 'sink')],
      edges: [edge('a', 'b'), edge('b', 'a')],
    }
    expect(() => layoutEvidenceGraph(cyclic)).not.toThrow()
    expect(layoutEvidenceGraph(cyclic).nodes).toHaveLength(2)
    const empty = layoutEvidenceGraph({ findingId: 'e', generatedAt: 't', nodes: [], edges: [] })
    expect(empty.nodes).toHaveLength(0)
    expect(empty.columns).toBe(1)
  })

  it('drops edges that reference unknown nodes instead of rendering ghosts', () => {
    const graph = findingGraph()
    graph.edges.push(edge('finding:demo', 'ghost', 'attached_as'))
    const layout = layoutEvidenceGraph(graph)
    expect(layout.edges).toHaveLength(5)
  })

  it('is deterministic for the same input', () => {
    const left = layoutEvidenceGraph(findingGraph())
    const right = layoutEvidenceGraph(findingGraph())
    expect(left.nodes.map(n => [n.node.id, n.x, n.y, n.layer])).toEqual(right.nodes.map(n => [n.node.id, n.x, n.y, n.layer]))
  })
})

describe('canvas helpers', () => {
  it('extracts openable file paths from evidence values and prefers explicit code refs', () => {
    expect(openablePathOf({ ...node('s', 'source', 'index.js:29 matter(input) — attacker controlled') })).toBe('index.js')
    expect(openablePathOf({ ...node('s', 'source', 'no code reference here') })).toBeUndefined()
    expect(openablePathOf({ ...node('s', 'source', 'anything'), codeRef: { path: 'lib/parse.js', note: '' } })).toBe('lib/parse.js')
  })

  it('flattens and truncates long evidence text for canvas lines', () => {
    expect(truncateForCanvas('single   line\n\nwith   gaps')).toBe('single line with gaps')
    expect(truncateForCanvas('a'.repeat(50), 34)).toHaveLength(34)
    expect(truncateForCanvas('a'.repeat(50), 34).endsWith('…')).toBe(true)
  })
})

describe('campaign war room layout', () => {
  it('fans lanes out on an arc to the right of the seed without overlaps', () => {
    const layout = layoutWarRoom(5)
    expect(layout.lanes).toHaveLength(5)
    for (const lane of layout.lanes) {
      expect(lane.x).toBeGreaterThan(layout.seed.x + WAR_ROOM_NODE.seedWidth - 1)
      expect(lane.y).toBeGreaterThanOrEqual(0)
      expect(lane.x + WAR_ROOM_NODE.width).toBeLessThanOrEqual(layout.width + 1)
      expect(lane.y + WAR_ROOM_NODE.height).toBeLessThanOrEqual(layout.height + 1)
    }
    // vertical spacing: no two lanes on overlapping rows
    const ys = layout.lanes.map(lane => lane.y).sort((a, b) => a - b)
    for (let index = 1; index < ys.length; index += 1) {
      expect(ys[index]! - ys[index - 1]!).toBeGreaterThanOrEqual(WAR_ROOM_NODE.height - 1)
    }
    // symmetric fan around the seed center line
    const mid = (ys[0]! + ys[ys.length - 1]!) / 2
    expect(Math.abs(mid - layout.seed.y)).toBeLessThanOrEqual(2)
  })

  it('keeps a single lane level with the seed and handles zero lanes', () => {
    const single = layoutWarRoom(1)
    expect(single.lanes[0]!.y).toBe(single.seed.y)
    const empty = layoutWarRoom(0)
    expect(empty.lanes).toHaveLength(0)
    expect(empty.width).toBeGreaterThan(0)
    expect(empty.height).toBeGreaterThan(0)
  })

  it('grows the canvas as lane count increases and stays deterministic', () => {
    const small = layoutWarRoom(2)
    const large = layoutWarRoom(8)
    expect(large.height).toBeGreaterThan(small.height)
    const again = layoutWarRoom(8)
    expect(again).toEqual(large)
  })

  it('draws war room edges from the seed edge toward each lane', () => {
    const path = warRoomEdgePath(20, 50, 300, 10)
    expect(path).toMatch(/^M \d+ \d+ C /)
    expect(path).toContain(`M ${20 + WAR_ROOM_NODE.seedWidth}`)
  })
})
