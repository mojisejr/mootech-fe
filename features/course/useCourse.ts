// โหลดรายการ EP + สิทธิ์ของผู้ชมจาก /api/course/[slug] (ไม่ล็อกอินก็ได้)
import { useEffect, useState } from 'react'
import type { CourseSlug, Episode } from '@/lib/course/content'

export type CourseEpisode = Episode & { ready: boolean; videoId: string | null }
export type CourseState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ok'; loggedIn: boolean; access: boolean; via: 'member' | 'purchase' | null; episodes: CourseEpisode[] }

export function useCourse(slug: CourseSlug | null): CourseState {
  const [state, setState] = useState<CourseState>({ status: 'loading' })
  useEffect(() => {
    if (!slug) return
    let alive = true
    setState({ status: 'loading' })
    fetch(`/api/course/${slug}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j) => {
        if (alive) setState({ status: 'ok', loggedIn: !!j.loggedIn, access: !!j.access, via: j.via ?? null, episodes: j.episodes ?? [] })
      })
      .catch(() => alive && setState({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [slug])
  return state
}
