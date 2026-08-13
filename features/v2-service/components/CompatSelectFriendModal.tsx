// features/v2-service/components/CompatSelectFriendModal.tsx — "เลือกเพื่อน / คู่รัก" (V3-native).
// ฟีม 2026-07-29 ruled: do NOT mount the v1 modal raw — build this in V3 language matching the add-friend
// sheet (Figma 636:17802 / 636:18533), and ADD the friend-list the design is missing. This is a NEW
// component (v1's components/modal-select-freind.tsx is NOT touched — กฎเหล็ก); it only REUSES the v1 DATA
// api MemberWithFriendGetApi (a UI-agnostic GET) to read the friend list, then maps a picked friend →
// goo's selectFriend({id,name,surname,picture_url}). The hook enriches dob/time from the friend detail.
//
// FLAG → evidence: the friend-LIST is not in the Figma node (636:17802 has only the form + connect options);
// ฟีม ORDERED it added ("เพิ่มสิ่งที่ต้องมี") — designed by Lamun in the sheet's V3 language, not invented.
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useCookies } from 'react-cookie'
import { CookieKey } from '@/constants/cookie-key'
import { MemberWithFriendGetApi } from '@/constants/api/api-member-with-friend-get'
import type { SelectFriendInput } from '../hooks/useCompatibility'
import type { QuotaView } from '../hooks/useQuota'
import { QuotaLine } from './QuotaLine'

// only the fields the list renders + maps (matches v1's item usage: id/name/surname/picture_url/is_disable).
type FriendItem = { id: string; name: string; surname?: string; picture_url?: string | null; is_disable?: boolean }

export function CompatSelectFriendModal({ onClose, onSelect, onAddNew, friendQuota }: {
  onClose: () => void
  onSelect: (input: SelectFriendInput) => void
  onAddNew: () => void
  /** #264 — how many more friends may be added. Passed in (not fetched here) so both indicators on this
   *  screen come from one read and cannot disagree. */
  friendQuota: QuotaView
}) {
  const [cookies] = useCookies([CookieKey.MEMBER_ID])
  const userId = (cookies[CookieKey.MEMBER_ID] as string) || ''
  const [friends, setFriends] = useState<FriendItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    if (!userId) { setFriends([]); return }
    ;(async () => {
      try {
        const res = (await MemberWithFriendGetApi(userId)) as FriendItem[] | { error: unknown } | null
        if (!alive) return
        if (Array.isArray(res)) setFriends(res)
        else { setFriends([]); setFailed(true) }
      } catch {
        if (alive) { setFriends([]); setFailed(true) }
      }
    })()
    return () => { alive = false }
  }, [userId])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(33,33,33,0.6)]" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-hidden rounded-t-[28px] bg-v3-bg-cream px-5 pb-10 pt-3 font-ibm" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="เลือกเพื่อน" data-testid="compat-select-modal">
        <span aria-hidden className="mx-auto h-[5px] w-11 shrink-0 rounded-full bg-v3-border-warm-2" />
        <h2 className="text-center text-[20px] font-bold leading-7 text-v3-navy">เลือกเพื่อน / คู่รัก</h2>

        {/* add-new — dashed "+" row, same language as the empty person-2 slot → opens the V3 AddFriendSheet */}
        <button type="button" onClick={onAddNew} data-testid="compat-select-add-new" className="flex h-[60px] w-full shrink-0 items-center gap-3 rounded-[56px] bg-v3-lemon-chiffon pl-2.5 pr-4 text-left">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-v3-sapphire bg-white text-v3-sapphire">
            <svg viewBox="0 0 18 18" className="size-[18px]" fill="none" aria-hidden><path d="M9 3.75v10.5M3.75 9h10.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          </span>
          <span className="text-[16px] font-bold uppercase leading-6 text-v3-sapphire">เพิ่มเพื่อนใหม่</span>
        </button>

        {/* #264 — directly under the action it constrains, so it is read BEFORE the form is filled in
            rather than after the effort is spent. Same quiet treatment as the calculation counter. */}
        <QuotaLine quota={friendQuota} label={(n) => `เพิ่มได้อีก ${n} คน`} testId="compat-quota-friend" />

        {/* the friend LIST (ฟีม-ordered addition — not in Figma) */}
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto" data-testid="compat-friend-list">
          {friends === null ? (
            <p data-testid="compat-friend-loading" className="py-8 text-center text-[14px] font-medium text-v3-text-muted">กำลังโหลดรายชื่อ…</p>
          ) : friends.length === 0 ? (
            <p data-testid="compat-friend-empty" className="py-8 text-center text-[14px] font-medium text-v3-text-muted">
              {failed ? 'โหลดรายชื่อไม่สำเร็จ ลองใหม่อีกครั้ง' : 'ยังไม่มีเพื่อน — เพิ่มเพื่อนใหม่เพื่อเริ่มดูดวงสมพงศ์'}
            </p>
          ) : (
            friends.map((f) => {
              const disabled = f.is_disable === true
              const full = `${f.name ?? ''}${f.surname ? ` ${f.surname}` : ''}`.trim()
              return (
                <button
                  key={f.id} type="button" disabled={disabled} aria-disabled={disabled}
                  data-testid={`compat-friend-${f.id}`}
                  onClick={() => onSelect({ id: f.id, name: f.name, surname: f.surname, picture_url: f.picture_url ?? undefined })}
                  className={`flex w-full items-center gap-3 rounded-[56px] bg-v3-ghost-white py-3 pl-3 pr-6 text-left ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                >
                  <span className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-v3-sapphire text-sm font-bold text-white">
                    {f.picture_url ? <Image src={f.picture_url} alt="" fill sizes="40px" style={{ objectFit: 'cover' }} /> : <span>{full.charAt(0) || '?'}</span>}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[16px] font-bold leading-6 text-v3-navy">{full || '(ไม่มีชื่อ)'}</span>
                  {disabled && <span className="shrink-0 text-[12px] font-medium text-v3-text-muted">เลือกไม่ได้</span>}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
