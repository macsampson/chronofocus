// Chrome extension types
export interface ChromeMessage {
  type: string
  data?: any
  keys?: string[]
}

export interface ChromeResponse {
  success?: boolean
  error?: string
  data?: any
}
