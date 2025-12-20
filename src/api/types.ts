export type HnItemType = 'job' | 'story' | 'comment' | 'poll' | 'pollopt'

export type HnItem = {
  id: number
  deleted?: boolean
  type?: HnItemType
  by?: string
  time?: number
  text?: string
  dead?: boolean
  parent?: number
  poll?: number
  kids?: number[]
  url?: string
  score?: number
  title?: string
  parts?: number[]
  descendants?: number
}
