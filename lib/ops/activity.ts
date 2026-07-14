// Team Activity data source (#mumate-ops-dashboard-phase1 Step 4). Uses the GitHub REST API
// directly with a fetch + timeout — `gh` CLI is not available in Vercel's serverless runtime.
// Shape verified live via `gh api search/issues` against mojisejr/mootech-fe + mootech-be.
const GITHUB_TIMEOUT_MS = 8000

export type PrActivityItem = {
  repo: string
  number: number
  title: string
  url: string
  state: 'open' | 'merged' | 'closed'
  author: string
  updatedAt: string
}

export type TeamActivity = {
  items: PrActivityItem[]
  status: 'ok' | 'warn' | 'bad'
  detail: string
}

type SearchIssuesItem = {
  number: number
  title: string
  html_url: string
  state: string
  repository_url: string
  updated_at: string
  user?: { login?: string }
  pull_request?: { merged_at?: string | null }
}

function repoNameFromUrl(repositoryUrl: string): string {
  return repositoryUrl.split('/').slice(-1)[0] ?? repositoryUrl
}

function prState(item: SearchIssuesItem): PrActivityItem['state'] {
  if (item.pull_request?.merged_at) return 'merged'
  return item.state === 'open' ? 'open' : 'closed'
}

export async function fetchTeamActivity(limit = 8): Promise<TeamActivity> {
  const token = process.env.GITHUB_TOKEN
  if (!token) {
    return { items: [], status: 'warn', detail: 'GITHUB_TOKEN not configured' }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS)

  try {
    const q = 'repo:mojisejr/mootech-fe repo:mojisejr/mootech-be is:pr'
    const url = `https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${limit}`
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    })

    if (res.status === 403 || res.status === 429) {
      return { items: [], status: 'warn', detail: 'GitHub API rate limited' }
    }
    if (!res.ok) {
      return { items: [], status: 'bad', detail: `GitHub API ${res.status}` }
    }

    const body = (await res.json()) as { items?: SearchIssuesItem[] }
    const items: PrActivityItem[] = (body.items ?? []).map((item) => ({
      repo: repoNameFromUrl(item.repository_url),
      number: item.number,
      title: item.title,
      url: item.html_url,
      state: prState(item),
      author: item.user?.login ?? 'unknown',
      updatedAt: item.updated_at,
    }))

    return { items, status: 'ok', detail: `${items.length} PR${items.length === 1 ? '' : 's'}` }
  } catch (e: any) {
    const timedOut = e?.name === 'AbortError'
    return { items: [], status: 'bad', detail: timedOut ? 'GitHub API timeout' : e?.message ?? 'GitHub fetch failed' }
  } finally {
    clearTimeout(timeout)
  }
}
