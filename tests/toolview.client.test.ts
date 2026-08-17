import { describe, expect, it } from 'vitest'
import type { RunningToolCall, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveOmvToolCard, toolState } from '../src/client/omv-toolview.js'

const running: RunningToolCall = {
  callId: 'call-1',
  name: 'omv_finding_inspect',
  argsRaw: '{"id":"demo-finding"}',
  turn: 1,
  step: 1,
  time: 1000,
  callView: { card: 'generic', title: '读取发现 demo-finding', kind: 'read' },
  subCalls: [],
}

const settled: ToolResultNode = {
  kind: 'tool-result',
  seq: 2,
  time: 1100,
  callId: 'call-1',
  call: { name: running.name, argsRaw: running.argsRaw },
  callTime: running.time,
  content: [{ type: 'text', text: 'status: confirmed\nnext: report' }],
  isError: false,
  callView: running.callView,
  resultView: { card: 'generic', title: '发现 demo-finding' },
  subCalls: [],
}

describe('OMV native Tool card projection', () => {
  it('keeps running calls compact and uses the tool presenter title', () => {
    expect(toolState(running)).toBe('running')
    expect(deriveOmvToolCard(running.name, running)).toMatchObject({
      state: 'running',
      title: '读取发现 demo-finding',
      preview: 'id=demo-finding',
    })
  })

  it('shows settled result status and a bounded one-line preview', () => {
    expect(toolState(settled)).toBe('ok')
    expect(deriveOmvToolCard(running.name, settled)).toMatchObject({
      state: 'ok',
      title: '发现 demo-finding',
      preview: 'status: confirmed',
      output: 'status: confirmed\nnext: report',
    })
  })

  it('keeps structured results and failures visible in the expanded card', () => {
    const structured = {
      ...settled,
      content: [{ type: 'json', value: { status: 'confirmed' } }],
    } as unknown as ToolResultNode
    expect(deriveOmvToolCard(running.name, structured)).toMatchObject({
      state: 'ok',
      preview: '{',
      output: '{\n  "type": "json",\n  "value": {\n    "status": "confirmed"\n  }\n}',
    })

    const failed: ToolResultNode = {
      ...settled,
      isError: true,
      error: { name: 'AbortError', code: 'interrupted' },
      content: [],
    }
    expect(deriveOmvToolCard(running.name, failed)).toMatchObject({
      state: 'stopped',
      preview: 'AbortError: interrupted',
      output: 'AbortError: interrupted',
    })
  })
})
