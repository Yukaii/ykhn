const API_BASE = 'https://hn.algolia.com/api/v1'

type AlgoliaStoryHit = {
  objectID: string
}

type AlgoliaSearchResponse = {
  hits: AlgoliaStoryHit[]
  page: number
  nbPages: number
  hitsPerPage: number
  query: string
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function searchStoryIds(
  query: string,
  options?: { page?: number; hitsPerPage?: number; signal?: AbortSignal }
): Promise<{ ids: number[]; page: number; nbPages: number }> {
  const q = query.trim()
  if (!q) return { ids: [], page: 0, nbPages: 0 }

  const page = options?.page ?? 0
  const hitsPerPage = options?.hitsPerPage ?? 30

  const url = new URL(`${API_BASE}/search`)
  url.searchParams.set('query', q)
  url.searchParams.set('tags', 'story')
  url.searchParams.set('page', String(page))
  url.searchParams.set('hitsPerPage', String(hitsPerPage))

  const data = await fetchJson<AlgoliaSearchResponse>(url.toString(), options?.signal)

  const ids = data.hits
    .map((h) => Number(h.objectID))
    .filter((n): n is number => Number.isFinite(n) && n > 0)

  return { ids, page: data.page, nbPages: data.nbPages }
}
