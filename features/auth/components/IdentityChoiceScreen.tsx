// IdentityChoiceScreen — /v2/welcome-back (mumate-login-identity-001 slice 5).
//
// Reached only from the self-heal, when the signed identity has NO owner and the switch
// is on. Three states, all read from /api/auth/identity-status on mount:
//
//   ask          "have you used MuMate with <other> before?"
//                  yes → sign in with <other>, come back here with ?proof=<this provider>
//                  no  → remember "create new" for this identity (this tab) → /v2, where
//                        the self-heal creates the account exactly as it always has
//   proof        ?proof=<p> and the session now HAS an owner → attach <p> to it through
//                  slice 3's link flow (the only way this slice writes anything)
//   proof-failed ?proof=<p> but the identity signed in with is ALSO unowned → say so;
//                  try again, or create the account with this identity (owner decision 18:
//                  no dead end; a wrong choice is repaired later by slice 4's merge)
//
// The wording is the agent's draft (owner decision, plan 0.8) until the owner approves it.
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { FullBleedScreen } from '@/features/v2-shell/components/FullBleedScreen'
import { LineButton } from './LineButton'
import { GoogleButton } from './GoogleButton'
import {
  PROVIDER_LABEL,
  asAskableProvider,
  fetchIdentityStatus,
  linkStartUrl,
  otherProvider,
  rememberCreateNew,
  type AskableProvider,
} from '@/lib/auth/ask-before-create'
import { buildRegisterParamsFromSession } from '@/lib/auth/register-params'
import { startOAuthRedirect } from '@/lib/auth/oauth-redirect'
import { isLineInAppBrowser, openInExternalBrowser } from '@/lib/line/liff'
import { CookieKey } from '@/constants/cookie-key'
import { CONFIG } from '@/constants/config'

export const WELCOME_BACK_CALLBACK = (proof: AskableProvider) => `/v2/welcome-back?proof=${proof}`

type View =
  | { kind: 'loading' }
  | { kind: 'ask'; current: AskableProvider }
  | { kind: 'proof-failed'; current: AskableProvider }
  | { kind: 'google-in-line' }

export interface IdentityChoiceDeps {
  navigate: (url: string) => void
  startOAuth: (provider: AskableProvider, callbackUrl: string) => void
  inLineApp: () => boolean
  openExternal: (url: string) => void
  storage: () => Storage | null
  fetchStatus: typeof fetchIdentityStatus
}

const defaultDeps: IdentityChoiceDeps = {
  navigate: (url) => window.location.assign(url),
  startOAuth: (provider, callbackUrl) => {
    // Same analytics cookie useV2Login sets, so the login method is reported truthfully.
    document.cookie = `${CookieKey.LOGIN_PROVIDER}=${provider}; path=/; max-age=${CONFIG.EXPIRED_TIME_COOKIE}; samesite=strict`
    // select_account: the commonest way to land here twice is picking the wrong Google
    // account in the chooser, so never let Google silently reuse the last one.
    void startOAuthRedirect(provider, callbackUrl, provider === 'google' ? { prompt: 'select_account' } : undefined)
  },
  inLineApp: isLineInAppBrowser,
  openExternal: (url) => void openInExternalBrowser(url),
  storage: () => {
    try {
      return window.sessionStorage
    } catch {
      return null
    }
  },
  fetchStatus: fetchIdentityStatus,
}

function GlyphFor({ provider }: { provider: AskableProvider }) {
  // Same assets LoginView uses.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/images/v2/onboarding/${provider}.svg`} alt="" width={20} height={20} className="size-5" />
}

export function IdentityChoiceScreen({ deps = defaultDeps }: { deps?: IdentityChoiceDeps }) {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  const proof = asAskableProvider(typeof router.query.proof === 'string' ? router.query.proof : null)

  useEffect(() => {
    if (!router.isReady || sessionStatus === 'loading') return
    let cancelled = false
    void (async () => {
      const status = await deps.fetchStatus()
      if (cancelled) return
      // Anything we cannot read, or a signed-out visitor: this page has nothing to ask.
      if (!status || !status.signedIn || !status.provider) return deps.navigate('/v2')
      if (status.known === true) {
        // proof succeeded → attach the identity they started with; otherwise nothing to ask
        return deps.navigate(proof ? linkStartUrl(proof) : '/v2')
      }
      if (status.known === false) {
        setView({ kind: proof ? 'proof-failed' : 'ask', current: status.provider })
        return
      }
      deps.navigate('/v2')
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, sessionStatus, proof])

  const proveWith = (provider: AskableProvider, returnTo: AskableProvider) => {
    // Google refuses to sign in inside LINE's in-app browser (disallowed_useragent).
    if (provider === 'google' && deps.inLineApp()) return setView({ kind: 'google-in-line' })
    setBusy(true)
    deps.startOAuth(provider, WELCOME_BACK_CALLBACK(returnTo))
  }

  const createNew = () => {
    const params = buildRegisterParamsFromSession(session)
    if (params) rememberCreateNew(deps.storage(), params.provider, params.id_token)
    setBusy(true)
    deps.navigate('/v2')
  }

  return (
    <FullBleedScreen
      bgSrc="/images/v2/bg/BG01.png"
      bgFallback="linear-gradient(180deg, #FBEFE6 0%, #F7E9F0 50%, #EAF0FB 100%)"
      contentClassName="justify-center px-8"
    >
      <Head>
        <title>ยินดีต้อนรับ · MuMate</title>
      </Head>
      <div className="flex flex-1 flex-col justify-center" data-testid="identity-choice">
        {view.kind === 'loading' ? (
          <p className="text-center font-ibm text-sm text-v3-text-body" data-testid="identity-choice-loading">
            กำลังตรวจสอบบัญชี…
          </p>
        ) : null}

        {view.kind === 'ask' ? (
          <AskView
            current={view.current}
            busy={busy}
            onYes={() => proveWith(otherProvider(view.current), view.current)}
            onNo={createNew}
          />
        ) : null}

        {view.kind === 'proof-failed' ? (
          <div className="flex flex-col gap-7" data-testid="identity-choice-proof-failed">
            <div className="flex flex-col gap-2.5 text-center">
              <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">
                ไม่พบบัญชีมูเมทที่ใช้ {PROVIDER_LABEL[view.current]} นี้
              </h1>
              <p className="font-ibm text-[15px] leading-[22px] text-v3-text-body">
                อาจเลือกบัญชีผิด ลองอีกครั้ง หรือสร้างบัญชีใหม่ได้เลย
              </p>
            </div>
            <div className="flex w-full flex-col gap-3">
              <ProviderButton
                provider={view.current}
                disabled={busy}
                onClick={() => proveWith(view.current, proof ?? otherProvider(view.current))}
                testId="identity-choice-retry"
              >
                ลองอีกครั้งด้วย {PROVIDER_LABEL[view.current]}
              </ProviderButton>
              <SecondaryButton onClick={createNew} disabled={busy} testId="identity-choice-create">
                สร้างบัญชีใหม่ด้วย {PROVIDER_LABEL[view.current]} นี้
              </SecondaryButton>
            </div>
          </div>
        ) : null}

        {view.kind === 'google-in-line' ? (
          <div className="flex flex-col gap-7" data-testid="identity-choice-google-in-line">
            <div className="flex flex-col gap-2.5 text-center">
              <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">เปิดในเบราว์เซอร์ก่อน</h1>
              <p className="font-ibm text-[15px] leading-[22px] text-v3-text-body">
                การยืนยันด้วย Google ทำในแอป LINE ไม่ได้ เปิดมูเมทในเบราว์เซอร์ (Chrome หรือ Safari) แล้วเข้าด้วย Google
                จากนั้นเชื่อม LINE ได้ที่ ตั้งค่า › บัญชีที่เชื่อมต่อ
              </p>
            </div>
            <div className="flex w-full flex-col gap-3">
              <GoogleButton
                onClick={() => deps.openExternal(`${window.location.origin}/v2/login`)}
                leadingIcon={<GlyphFor provider="google" />}
              >
                เปิดในเบราว์เซอร์
              </GoogleButton>
              <SecondaryButton onClick={createNew} disabled={busy} testId="identity-choice-create">
                ไม่ใช่ — สร้างบัญชีใหม่ด้วย LINE
              </SecondaryButton>
            </div>
          </div>
        ) : null}
      </div>
    </FullBleedScreen>
  )
}

function AskView({
  current,
  busy,
  onYes,
  onNo,
}: {
  current: AskableProvider
  busy: boolean
  onYes: () => void
  onNo: () => void
}) {
  const other = otherProvider(current)
  return (
    <div className="flex flex-col gap-7" data-testid="identity-choice-ask">
      <div className="flex flex-col gap-2.5 text-center">
        <h1 className="font-ibm text-2xl font-bold leading-8 text-v3-text-title">เคยใช้มูเมทมาก่อนไหม?</h1>
        <p className="font-ibm text-[15px] leading-[22px] text-v3-text-body">
          บัญชี {PROVIDER_LABEL[current]} นี้ยังไม่เคยใช้กับมูเมท ถ้าคุณเคยเข้าด้วย {PROVIDER_LABEL[other]} ให้ยืนยันด้วย{' '}
          {PROVIDER_LABEL[other]} ก่อน ดวง QI และประวัติของคุณจะอยู่ในบัญชีเดียวกัน
        </p>
      </div>
      <div className="flex w-full flex-col gap-3">
        <ProviderButton provider={other} disabled={busy} onClick={onYes} testId="identity-choice-yes">
          เคยใช้ — ยืนยันด้วย {PROVIDER_LABEL[other]}
        </ProviderButton>
        <SecondaryButton onClick={onNo} disabled={busy} testId="identity-choice-no">
          ไม่เคย — สร้างบัญชีใหม่
        </SecondaryButton>
      </div>
      <p className="text-center font-ibm text-[12px] leading-[18px] text-v3-text-muted">
        ไม่แน่ใจ? สร้างบัญชีใหม่ได้เลย ถ้าเจอบัญชีเก่าภายหลัง รวมบัญชีได้ที่ ตั้งค่า › บัญชีที่เชื่อมต่อ
      </p>
    </div>
  )
}

function ProviderButton({
  provider,
  disabled,
  onClick,
  testId,
  children,
}: {
  provider: AskableProvider
  disabled: boolean
  onClick: () => void
  testId: string
  children: React.ReactNode
}) {
  const Button = provider === 'line' ? LineButton : GoogleButton
  return (
    <Button onClick={onClick} disabled={disabled} data-testid={testId} leadingIcon={<GlyphFor provider={provider} />}>
      {children}
    </Button>
  )
}

function SecondaryButton({
  onClick,
  disabled,
  testId,
  children,
}: {
  onClick: () => void
  disabled: boolean
  testId: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="h-12 w-full rounded-full border border-v3-border-card bg-white font-ibm text-[15px] font-bold text-v3-text-title disabled:opacity-50"
    >
      {children}
    </button>
  )
}

export default IdentityChoiceScreen
