/** Public event emitted after an OMV-native tool reaches its final result. */
export interface OmvToolResultEvent {
  name: string
  callId: string
  ok: boolean
  sessionId?: string
  projectRoot?: string
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'dsh-omv/tool-result': (event: OmvToolResultEvent) => void
  }
}
