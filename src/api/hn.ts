import type { FeedKind } from '../router'
import type { HnItem } from './types'

const API_BASE = 'https://hacker-news.firebaseio.com/v0'

const feedEndpoint: Record<FeedKind, string> = {
  top: 'topstories',
  new: 'newstories',
  best: 'beststories',
  ask: 'askstories',
  show: 'showstories',
  jobs: 'jobstories',
}

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function fetchFeedIds(kind: FeedKind, signal?: AbortSignal) {
  return await fetchJson<number[]>(`/${feedEndpoint[kind]}.json`, signal)
}

const inFlight = new Map<number, Promise<HnItem | null>>()
const itemCache = new Map<number, HnItem | null>()

export async function fetchItem(id: number, signal?: AbortSignal): Promise<HnItem | null> {
  if (itemCache.has(id)) return itemCache.get(id) ?? null

  const existing = inFlight.get(id)
  if (existing) return await existing

  const promise = fetchJson<HnItem | null>(`/item/${id}.json`, signal)
    .then((item) => {
      itemCache.set(id, item)
      return item
    })
    .finally(() => {
      inFlight.delete(id)
    })

  inFlight.set(id, promise)
  return await promise
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const current = nextIndex
      if (current >= items.length) return
      nextIndex++
      results[current] = await fn(items[current])
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function fetchItems(ids: number[], options?: { concurrency?: number }) {
  const concurrency = options?.concurrency ?? 12
  const items = await mapConcurrent(ids, concurrency, async (id) => await fetchItem(id))
  return items.filter((x): x is HnItem => Boolean(x) && !x.deleted && !x.dead)
}
