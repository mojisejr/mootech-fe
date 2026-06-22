// Deterministic unit tests for the multi-session chat store (#mootech-chat-sessions).
// Browser-free: a fake in-memory StorageLike is injected (DI). Run: npx tsx scripts/chat-session-store.test.ts
import assert from 'node:assert/strict'
import {
  LocalStorageSessionStore,
  migrateLegacyHistory,
  titleFromMessages,
  DEFAULT_TITLE,
  type StorageLike,
} from '../lib/chat/session-store'

let pass = 0
function t(name: string, fn: () => void) {
  try {
    fn()
    pass++
  } catch (e: any) {
    console.error(`✗ ${name}\n  ${e?.message ?? e}`)
    process.exitCode = 1
  }
}

function fakeStorage(): StorageLike & { dump: () => Record<string, string> } {
  const m = new Map<string, string>()
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  }
}

const msg = (id: string, message: string, is_ai = false) => ({ id, message, is_ai })

// ── create / list / active ──
t('create makes a session, sets it active, list returns it', () => {
  const s = new LocalStorageSessionStore('u1', fakeStorage())
  const a = s.create()
  assert.equal(a.title, DEFAULT_TITLE)
  assert.deepEqual(a.messages, [])
  assert.equal(s.getActiveId(), a.id)
  assert.equal(s.list().length, 1)
})

t('list is sorted most-recently-updated first', () => {
  let clock = 0
  const s = new LocalStorageSessionStore('u1', fakeStorage(), () => ++clock)
  const a = s.create()
  s.create() // b — newer at creation
  s.setMessages(a.id, [msg('m1', 'ทำงานปีนี้')]) // bumps a.updatedAt to newest
  assert.equal(s.list()[0].id, a.id)
})

// ── setMessages auto-title ──
t('setMessages auto-titles from first user turn (truncated at 40)', () => {
  const s = new LocalStorageSessionStore('u1', fakeStorage())
  const a = s.create()
  s.setMessages(a.id, [msg('m1', 'a'.repeat(60))])
  const title = s.get(a.id)!.title
  assert.equal(title.length, 41) // 40 chars + ellipsis
  assert.ok(title.endsWith('…'))
})

t('manual rename is preserved across setMessages', () => {
  const s = new LocalStorageSessionStore('u1', fakeStorage())
  const a = s.create()
  s.rename(a.id, 'ดวงการเงิน')
  s.setMessages(a.id, [msg('m1', 'คำถามแรก')])
  assert.equal(s.get(a.id)!.title, 'ดวงการเงิน')
})

t('rename falls back to default on blank', () => {
  const s = new LocalStorageSessionStore('u1', fakeStorage())
  const a = s.create()
  s.rename(a.id, '   ')
  assert.equal(s.get(a.id)!.title, DEFAULT_TITLE)
})

// ── remove ──
t('remove deletes the session and clears active if it was active', () => {
  const s = new LocalStorageSessionStore('u1', fakeStorage())
  const a = s.create()
  s.remove(a.id)
  assert.equal(s.list().length, 0)
  assert.equal(s.getActiveId(), null)
})

// ── per-user namespacing ──
t('two users on one device never mix', () => {
  const st = fakeStorage()
  const u1 = new LocalStorageSessionStore('u1', st)
  const u2 = new LocalStorageSessionStore('u2', st)
  u1.create()
  u2.create()
  u2.create()
  assert.equal(u1.list().length, 1)
  assert.equal(u2.list().length, 2)
})

// ── cap ──
t('soft cap keeps only the 50 most-recent sessions', () => {
  const s = new LocalStorageSessionStore('u1', fakeStorage())
  for (let i = 0; i < 55; i++) s.create()
  assert.equal(s.list().length, 50)
})

// ── corrupt data ──
t('corrupt sessions JSON degrades to empty (no throw)', () => {
  const st = fakeStorage()
  st.setItem('bazi-chat-sessions:v1:u1', '{not json')
  const s = new LocalStorageSessionStore('u1', st)
  assert.deepEqual(s.list(), [])
})

// ── empty userId guard ──
t('empty userId is inert (no writes, empty list)', () => {
  const s = new LocalStorageSessionStore('', fakeStorage())
  s.create()
  assert.deepEqual(s.list(), [])
  assert.equal(s.getActiveId(), null)
})

// ── migration (no data loss) ──
t('migrates legacy single-thread history into one session', () => {
  const st = fakeStorage()
  st.setItem(
    'bazi-chat-history:u1',
    JSON.stringify([
      msg('m1', 'ดวงฉันเป็นไง'),
      msg('m2', 'ปีนี้ธาตุไฟเด่น', true),
    ]),
  )
  const id = migrateLegacyHistory('u1', st)
  assert.ok(id)
  const s = new LocalStorageSessionStore('u1', st)
  const sess = s.get(id!)!
  assert.equal(sess.messages.length, 2)
  assert.equal(sess.messages[0].message, 'ดวงฉันเป็นไง')
  assert.equal(sess.title, 'ดวงฉันเป็นไง') // auto-titled from first user turn
  assert.equal(s.getActiveId(), id)
})

t('legacy key is NOT deleted (append-only)', () => {
  const st = fakeStorage()
  st.setItem('bazi-chat-history:u1', JSON.stringify([msg('m1', 'hi')]))
  migrateLegacyHistory('u1', st)
  assert.ok(st.getItem('bazi-chat-history:u1') !== null)
})

t('migration is idempotent — runs once, no duplicate sessions', () => {
  const st = fakeStorage()
  st.setItem('bazi-chat-history:u1', JSON.stringify([msg('m1', 'hi')]))
  migrateLegacyHistory('u1', st)
  const again = migrateLegacyHistory('u1', st)
  assert.equal(again, null)
  assert.equal(new LocalStorageSessionStore('u1', st).list().length, 1)
})

t('no legacy history -> nothing migrated, marker still set', () => {
  const st = fakeStorage()
  assert.equal(migrateLegacyHistory('u1', st), null)
  assert.equal(new LocalStorageSessionStore('u1', st).list().length, 0)
})

t('migration skipped when user already has sessions', () => {
  const st = fakeStorage()
  new LocalStorageSessionStore('u1', st).create()
  st.setItem('bazi-chat-history:u1', JSON.stringify([msg('m1', 'hi')]))
  assert.equal(migrateLegacyHistory('u1', st), null)
})

// ── titleFromMessages ──
t('titleFromMessages defaults when no user turn', () => {
  assert.equal(titleFromMessages([msg('m1', 'ai only', true)]), DEFAULT_TITLE)
  assert.equal(titleFromMessages([]), DEFAULT_TITLE)
})

if (!process.exitCode) console.log(`✓ all ${pass} chat-session-store assertions passed`)
else console.error(`\n${pass} passed, FAILURES above`)
