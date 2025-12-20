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

const FEED_IDS_TTL_MS = 2 * 60 * 1000
const feedIdsCache = new Map<FeedKind, { ids: number[]; at: number }>()
const feedIdsInFlight = new Map<FeedKind, Promise<number[]>>()

export async function fetchFeedIds(kind: FeedKind, signal?: AbortSignal) {
  const cached = feedIdsCache.get(kind)
  if (cached && Date.now() - cached.at < FEED_IDS_TTL_MS) return cached.ids

  const existing = feedIdsInFlight.get(kind)
  if (existing) return await existing

  const promise = fetchJson<number[]>(`/${feedEndpoint[kind]}.json`, signal)
    .then((ids) => {
      feedIdsCache.set(kind, { ids, at: Date.now() })
      return ids
    })
    .finally(() => {
      feedIdsInFlight.delete(kind)
    })

  feedIdsInFlight.set(kind, promise)
  return await promise
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

      const item = items[current]
      if (item === undefined) throw new Error('Invariant: missing item')
      results[current] = await fn(item)
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

function isValidItem(x: HnItem | null): x is HnItem {
  return x != null && !x.deleted && !x.dead
}

function cachedItem(id: number) {
  const item = itemCache.get(id)
  return isValidItem(item ?? null) ? item : null
}

export async function fetchItems(ids: number[], options?: { concurrency?: number }) {
  // Fast path: everything is already in memory cache.
  const cached = ids.map((id) => cachedItem(id))
  const allCached = cached.every((x) => x !== null)
  if (allCached) return cached.filter((x): x is HnItem => x !== null)

  const concurrency = options?.concurrency ?? 12
  const items = await mapConcurrent(ids, concurrency, async (id) => await fetchItem(id))
  return items.filter(isValidItem)
}
