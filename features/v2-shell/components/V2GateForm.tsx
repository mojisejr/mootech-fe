// MuMate v2 preview gate form. Rendered by /v2's getServerSideProps when the visitor has no valid
// v2_access cookie. Plain POST to /api/v2/login (no client JS needed — works even if hydration
// hasn't run), matching the ops GateForm's progressive-enhancement shape. Team-only single passkey.
import Head from 'next/head'

type V2GateFormProps = {
  gateError: string | null
}

const ERROR_COPY: Record<string, string> = {
  invalid: 'รหัสผ่านไม่ถูกต้อง ลองอีกครั้ง',
  unavailable: 'ตอนนี้ยังไม่เปิดให้เข้า',
}

export function V2GateForm({ gateError }: V2GateFormProps) {
  const message = gateError ? (ERROR_COPY[gateError] ?? 'เข้าไม่สำเร็จ ลองอีกครั้ง') : null
  return (
    <>
      <Head>
        <title>MuMate · preview</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div className="flex min-h-screen items-center justify-center bg-v3-ghost-white px-4">
        <form
          method="POST"
          action="/api/v2/login"
          className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg"
        >
          <h1 className="mb-1 text-center font-poppins-v3 text-xl font-bold text-v3-sapphire">
            MuMate preview
          </h1>
          <p className="mb-6 text-center text-sm text-neutral-500">
            เฉพาะทีม — กรอกรหัสผ่านเพื่อเข้าใช้งาน
          </p>

          {message ? (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600" role="alert">
              {message}
            </p>
          ) : null}

          <label className="block text-sm font-medium text-neutral-700">
            รหัสผ่าน
            <input
              type="password"
              name="passkey"
              autoComplete="off"
              required
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-base outline-none focus:border-v3-sapphire focus:ring-2 focus:ring-v3-lime"
            />
          </label>

          <button
            type="submit"
            className="mt-6 w-full rounded-lg bg-v3-sapphire py-3 font-poppins-v3 font-semibold text-v3-lime transition-opacity hover:opacity-90"
          >
            เข้าสู่ระบบ
          </button>
        </form>
      </div>
    </>
  )
}
