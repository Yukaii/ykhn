const AUTH_API_BASE = import.meta.env.VITE_HN_AUTH_PROXY_URL ?? (import.meta.env.DEV ? '/auth-proxy' : 'https://hn-api.yukai.dev')

export type AuthUser = {
  id: string
}

export type AuthSession = {
  token: string
  tokenType: 'Bearer'
  expiresAt: number
  user: AuthUser
}

export type MeResponse = {
  user: AuthUser
  session: {
    id: string
    expiresAt: number
  }
}

export type HnVoteAction = {
  id: number
  how: 'up' | 'un'
  href: string
}

export type AuthListKind = 'submissions' | 'comments' | 'upvoted-submissions' | 'upvoted-comments' | 'favorites-submissions' | 'favorites-comments'

export type AuthSubmissionItem = {
  id: number
  rank: number | null
  title: string
  url: string
  site: string | null
  score: number | null
  by: string | null
  age: string | null
  time: number | null
  comments: number | null
  itemUrl: string
}

export type AuthCommentItem = {
  id: number
  by: string | null
  age: string | null
  time: number | null
  text: string
  textHtml: string
  parentUrl: string | null
  contextUrl: string | null
  itemUrl: string
  story: {
    id: number | null
    title: string | null
    url: string | null
  } | null
}

export type AuthSubmissionListResponse = {
  user: string
  page: number
  items: AuthSubmissionItem[]
  nextPage: number | null
  nextUrl: string | null
}

export type AuthCommentListResponse = {
  user: string
  page: number
  items: AuthCommentItem[]
  nextPage: number | null
  nextUrl: string | null
}

export type AuthListResponse = AuthSubmissionListResponse | AuthCommentListResponse

type AuthErrorBody = {
  error?: string
}

function authUrl(path: string) {
  return `${AUTH_API_BASE}${path}`
}

function bearerHeaders(token: string) {
  return {
    authorization: `Bearer ${token}`,
  }
}

async function parseAuthError(res: Response) {
  try {
    const body = (await res.json()) as AuthErrorBody
    return body.error || `HTTP ${res.status}`
  } catch {
    return `HTTP ${res.status}`
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(authUrl(path), {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {}),
    },
  })

  if (!res.ok) throw new Error(await parseAuthError(res))
  return (await res.json()) as T
}

export async function loginToAuthProxy(username: string, password: string) {
  return await fetchJson<AuthSession>('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchCurrentSession(token: string) {
  return await fetchJson<MeResponse>('/auth/me', {
    headers: bearerHeaders(token),
  })
}

export async function fetchAuthList(kind: AuthListKind, token: string, page = 1) {
  const query = new URLSearchParams()
  if (page > 1) query.set('page', String(page))

  let path: string
  if (kind === 'submissions') {
    path = '/auth/submissions'
  } else if (kind === 'comments') {
    path = '/auth/comments'
  } else if (kind === 'upvoted-submissions') {
    path = '/auth/upvoted'
    query.set('type', 'submissions')
  } else if (kind === 'upvoted-comments') {
    path = '/auth/upvoted'
    query.set('type', 'comments')
  } else if (kind === 'favorites-submissions') {
    path = '/auth/favorites'
    query.set('type', 'submissions')
  } else {
    path = '/auth/favorites'
    query.set('type', 'comments')
  }

  const suffix = query.toString()
  return await fetchJson<AuthListResponse>(`${path}${suffix ? `?${suffix}` : ''}`, {
    headers: bearerHeaders(token),
  })
}

export async function logoutAuthProxy(token: string) {
  return await fetchJson<{ ok: boolean }>('/auth/logout', {
    method: 'POST',
    headers: bearerHeaders(token),
  })
}

export async function fetchHnProxyText(pathAndQuery: string, token: string) {
  const normalized = pathAndQuery.replace(/^\/+/, '')
  const res = await fetch(authUrl(`/hn/${normalized}`), {
    headers: {
      accept: 'text/html',
      ...bearerHeaders(token),
    },
  })

  if (!res.ok) throw new Error(await parseAuthError(res))
  return await res.text()
}

export async function runHnProxyAction(pathAndQuery: string, token: string) {
  const normalized = pathAndQuery.replace(/^\/+/, '')
  const res = await fetch(authUrl(`/hn/${normalized}`), {
    headers: bearerHeaders(token),
    redirect: 'manual',
  })

  if (res.status >= 400) throw new Error(await parseAuthError(res))
}

export function parseVoteActions(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href^="vote?"]'))
  const actions: HnVoteAction[] = []

  for (const link of links) {
    const href = link.getAttribute('href')
    if (!href) continue

    const params = new URLSearchParams(href.split('?', 2)[1] ?? '')
    const id = Number(params.get('id'))
    const how = params.get('how')

    if (!Number.isFinite(id)) continue
    if (how !== 'up' && how !== 'un') continue

    actions.push({ id, how, href })
  }

  return actions
}

export async function fetchVoteActionsForItemPage(itemId: number, token: string) {
  const html = await fetchHnProxyText(`item?id=${itemId}`, token)
  return parseVoteActions(html)
}
