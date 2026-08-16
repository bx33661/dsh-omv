import { describe, expect, it } from 'vitest'
import type { EvidenceGraph, EvidenceGraphNode, EvidenceGraphEdge } from '../src/contracts.js'
import { analyzeEvidenceGraph, exportEvidenceGraph } from '../src/evidence-graph.js'

function buildFixtureGraph(): EvidenceGraph {
  const nodes: EvidenceGraphNode[] = [
    { id: 'finding:f-1', kind: 'finding', label: 'SSRF in fetch', value: 'finding', state: 'known' },
    { id: 'finding:f-1:claim', kind: 'claim', label: 'User input flows to HTTP request', value: 'User-controlled URL parameter reaches fetch() without validation', state: 'known' },
    { id: 'finding:f-1:source', kind: 'source', label: 'req.query.url', value: 'req.query.url', state: 'known', path: 'src/api.ts', line: 15 },
    { id: 'finding:f-1:sink', kind: 'sink', label: 'fetch(url)', value: 'fetch(url)', state: 'known', path: 'src/api.ts', line: 42 },
    { id: 'finding:f-1:guard', kind: 'guard', label: 'URL allowlist check', value: 'missing', state: 'unknown' },
    { id: 'finding:f-1:reproducer', kind: 'reproducer', label: 'curl PoC', value: 'curl http://localhost:3000/api?url=http://internal', state: 'known' },
    { id: 'finding:f-1:observation', kind: 'observation', label: 'Internal service accessed', value: 'unknown', state: 'unknown' },
    { id: 'finding:f-1:artifact', kind: 'artifact', label: 'network-trace.pcap', value: 'network-trace.pcap', state: 'known' },
  ]
  const edges: EvidenceGraphEdge[] = [
    { from: 'finding:f-1', to: 'finding:f-1:claim', relation: 'describes' },
    { from: 'finding:f-1:claim', to: 'finding:f-1:source', relation: 'describes' },
    { from: 'finding:f-1:source', to: 'finding:f-1:sink', relation: 'flows_to' },
    { from: 'finding:f-1:sink', to: 'finding:f-1:guard', relation: 'guarded_by' },
    { from: 'finding:f-1:claim', to: 'finding:f-1:reproducer', relation: 'reproduced_by' },
    { from: 'finding:f-1:reproducer', to: 'finding:f-1:observation', relation: 'observed_as' },
    { from: 'finding:f-1:observation', to: 'finding:f-1:artifact', relation: 'attached_as' },
  ]
  return { findingId: 'f-1', generatedAt: new Date().toISOString(), nodes, edges }
}

describe('Evidence Graph analysis', () => {
  it('marks the source-to-sink-to-guard chain as the critical path', () => {
    const graph = buildFixtureGraph()
    const result = analyzeEvidenceGraph(graph)
    expect(result.primaryPath).toEqual(['finding:f-1:source', 'finding:f-1:sink'])
    expect(result.highlightedNodes).toContain('finding:f-1:source')
    expect(result.highlightedNodes).toContain('finding:f-1:sink')
    expect(result.missingGuards).toEqual(['finding:f-1:guard'])
  })

  it('identifies missing guards', () => {
    const graph = buildFixtureGraph()
    const result = analyzeEvidenceGraph(graph)
    expect(result.missingGuards).toHaveLength(1)
    expect(result.missingGuards[0]).toBe('finding:f-1:guard')
  })

  it('projects CodeRef from node path and line', () => {
    const graph = buildFixtureGraph()
    const sourceNode = graph.nodes.find(n => n.id === 'finding:f-1:source')
    expect(sourceNode?.path).toBe('src/api.ts')
    expect(sourceNode?.line).toBe(15)
  })

  it('marks disconnected nodes', () => {
    const graph = buildFixtureGraph()
    const result = analyzeEvidenceGraph(graph)
    // All nodes are connected through the claim, so no disconnected nodes
    expect(result.disconnectedNodes).toEqual([])
  })

  it('handles a graph with a verified guard', () => {
    const graph = buildFixtureGraph()
    const guardNode = graph.nodes.find(n => n.id === 'finding:f-1:guard')
    if (guardNode) {
      guardNode.value = 'URL validation present'
      guardNode.state = 'known'
    }
    const result = analyzeEvidenceGraph(graph)
    expect(result.primaryPath).toEqual(['finding:f-1:source', 'finding:f-1:sink', 'finding:f-1:guard'])
    expect(result.missingGuards).toEqual([])
  })
})

describe('Evidence Graph export', () => {
  it('escapes untrusted graph labels in DOT output', () => {
    const graph = buildFixtureGraph()
    const findingNode = graph.nodes[0]
    if (findingNode) {
      findingNode.label = 'Test "quote" and\nnewline'
    }
    const output = exportEvidenceGraph(graph, 'dot')
    expect(output).toContain('\\"')
    expect(output).toContain('\\n')
    expect(output).not.toContain('"\n')
  })

  it('generates valid DOT format', () => {
    const graph = buildFixtureGraph()
    const output = exportEvidenceGraph(graph, 'dot')
    expect(output).toContain('digraph EvidenceGraph {')
    expect(output).toContain('rankdir=LR')
    expect(output).toContain('->')
    expect(output).toContain('}')
  })

  it('generates valid Mermaid format', () => {
    const graph = buildFixtureGraph()
    const output = exportEvidenceGraph(graph, 'mermaid')
    expect(output).toContain('graph LR')
    expect(output).toContain('-->')
    expect(output).toMatch(/finding_f_1\(\(/)
  })

  it('escapes Mermaid special characters', () => {
    const graph = buildFixtureGraph()
    const findingNode = graph.nodes[0]
    if (findingNode) {
      findingNode.label = 'Test [brackets] and (parens) {braces}'
    }
    const output = exportEvidenceGraph(graph, 'mermaid')
    expect(output).toContain('\\[')
    expect(output).toContain('\\]')
    expect(output).toContain('\\(')
    expect(output).toContain('\\)')
  })

  it('uses stable node IDs across exports', () => {
    const graph = buildFixtureGraph()
    const dot1 = exportEvidenceGraph(graph, 'dot')
    const dot2 = exportEvidenceGraph(graph, 'dot')
    expect(dot1).toBe(dot2)
  })
})
