import { AlertTriangle } from 'lucide-react'

export function GateForm({
  users,
  error,
}: {
  users: Array<{ id: string; name: string }>
  error: string | null
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ops_bg p-4 font-ibm">
      <form
        method="POST"
        action="/api/ops/login"
        className="w-full max-w-sm rounded-xl border border-ops_border bg-ops_surface p-6"
      >
        <h1 className="mb-1 text-lg font-semibold text-ops_text">Ops Dashboard</h1>
        <p className="mb-4 text-sm text-ops_text_muted">Internal only — กรอก passkey แล้วเลือกชื่อ</p>

        {error && (
          <p className="mb-3 flex items-center gap-1.5 text-sm text-status_bad" role="alert">
            <AlertTriangle size={16} aria-hidden="true" />
            passkey ไม่ถูกต้อง หรือบัญชีไม่ถูกใช้งาน
          </p>
        )}

        <label className="mb-1 block text-sm text-ops_text_muted" htmlFor="passkey">
          Passkey
        </label>
        <input
          id="passkey"
          name="passkey"
          type="password"
          required
          autoComplete="off"
          className="mb-3 w-full rounded-md border border-ops_border bg-ops_bg px-3 py-2 text-sm text-ops_text"
        />

        <label className="mb-1 block text-sm text-ops_text_muted" htmlFor="userId">
          ชื่อของคุณ
        </label>
        <select
          id="userId"
          name="userId"
          required
          defaultValue=""
          disabled={users.length === 0}
          className="mb-4 w-full rounded-md border border-ops_border bg-ops_bg px-3 py-2 text-sm text-ops_text disabled:opacity-50"
        >
          <option value="" disabled>
            เลือกชื่อ
          </option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          disabled={users.length === 0}
          className="w-full rounded-md bg-moumate_blue py-2 text-sm font-medium text-moumate_black disabled:opacity-50"
        >
          เข้าสู่ระบบ
        </button>

        {users.length === 0 && (
          <p className="mt-3 text-xs text-status_warn">
            ยังไม่มีรายชื่อใน dashboard_users — ต้องเพิ่มก่อนถึงจะเข้าได้
          </p>
        )}
      </form>
    </main>
  )
}
