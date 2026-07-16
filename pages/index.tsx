import HeaderMuMate from '@/components/header-v2';
import Menu from '@/components/menu';
import ModalEmail from '@/components/modal-email';
import ModalLoginSuccess from '@/components/modal-login-success';
import ScreenLoading from '@/components/screen-loading';
import { MemberWithFriendGetNewFriendApi } from '@/constants/api/api-member-with-friend-get-new-friend';
import { UserCheckLine } from '@/constants/api/api-user-check-line';
import { UserRegisterOrLogin } from '@/constants/api/api-user-register-or-login';
import { UserGetById } from '@/constants/api/api-user-get';
import { CONFIG } from '@/constants/config';
import { CookieKey } from '@/constants/cookie-key';
import { PageRouter } from '@/constants/router';
import { shouldClearToken, shouldRegister } from '@/lib/auth/login-state';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { resolveWelcomeTarget } from '@/lib/auth/welcome-target';
import { resolveReturningResult } from '@/lib/auth/returning-result';
import { resolveCtaReady } from '@/lib/auth/cta-ready';
import { signIn, signOut, useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useCookies } from 'react-cookie';
import { issueNonce, NONCE_COOKIE } from '@/lib/calculator/nonce';
import { CalculatorHomeExperience } from '@/components/calculator/CalculatorHomeExperience';

// #calculator-homepage-swap: the homepage now serves the public Bazi Calculator experience (shared
// with /calculator). The calculator's compute API requires the nonce cookie, so this page must issue
// it in getServerSideProps exactly like /calculator does — otherwise the first compute POST from the
// homepage would be rejected.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const nonce = issueNonce()
  ctx.res.setHeader('Set-Cookie', `${NONCE_COOKIE}=${nonce}; HttpOnly; Path=/; SameSite=Lax; Secure; Max-Age=600`)
  return { props: {} }
}


export default function HomePage() {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID,
    CookieKey.MEMBER_NAME,
    CookieKey.MEMBER_SURNAME,
    CookieKey.MEMBER_REFER_CODE,
    CookieKey.MEMBER_IMAGE,
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER
  ])


  const [isLogin, setIsLogin] = useState<boolean>(false)
  const [isRegistering, setIsRegistering] = useState<boolean>(false)
  // In-flight guard: idempotent register may re-evaluate on every authed render
  // tick — this ref prevents firing the network round-trip twice concurrently
  // (mirrors the promptpay/createSubmitGuard defensive pattern). Reset to false
  // when the round-trip settles so a later genuine cookie-wipe can re-register.
  const registerInFlightRef = useRef<boolean>(false)
  // One-shot guard for the returning-user routing-state hydration (get-user).
  // (#mootech-home-cta-bounce-migration)
  const returningHydratedRef = useRef<boolean>(false)

  const router = useRouter();
  const callback = router.query.callback as string || '/';
  const { data: session, status } = useSession();
  // Cookie-validated identity (never the optimistic local isLogin/infoUserId).
  // The home CTA guard reads THIS, so a returning user with a valid MEMBER_ID is
  // never bounced to /login. (#mootech-home-cta-bounce-migration)
  const { status: authStatus } = useCurrentUser();


  const [isShowModalEmail, setIsShowModalEmail] = useState<boolean>(false)


  const [infoUserId, setInfoUserId] = useState<any>('')
  const [infoToken, setInfoToken] = useState<any>('')
  const [infoName, setInfoName] = useState<any>('')
  const [infoImage, setInfoImage] = useState<any>('')
  const [infoProvider, setInfoProvider] = useState<any>('')
  const [infoRefCode, setInfoRefCode] = useState<any>('')
  const [infoEmail, setInfoEmail] = useState<any>('')



  const [resultCode, setResultCode] = useState<string>('')
  const [isRefreshResult, setIsRefreshResult] = useState<boolean>(false)
  // Gate for the home CTA race (#mootech-cta-race-gate): resultCode hydrates from
  // get-user async, but authStatus is cookie-instant. Until the routing state has
  // settled we hold the CTA so a returning user can't click into /register before
  // their chart loads. Set true at EVERY settle path (returning hydrate, DEV
  // bypass, first-login register) — never in the error catch, so a failed hydrate
  // keeps the gate closed and lets the retry re-open it.
  const [resultHydrated, setResultHydrated] = useState<boolean>(false)


  const [isShowMenu, setIsShowMenu] = useState<boolean>(false)


  const fallback = '/images/mumate/ic_logo.svg'
  const [imgSrc, setImgSrc] = useState(infoImage || fallback)

  const [message, setMessage] = useState("");
  const [show, setShow] = useState(false);

  const showNotification = (text: string) => {
    setMessage(text);
    setShow(true);

    setTimeout(() => {
      setShow(false);
    }, 2500);
  };

  useEffect(() => {

    const data = cookies[CookieKey.LOGIN_PROVIDER]
    if (data) {
      setInfoProvider(data.toUpperCase())
    }

   const data2 = cookies[CookieKey.REFCODE_FGF]
    if (data) {
      setInfoRefCode(data2)
    }

  }, [ cookies[CookieKey.LOGIN_PROVIDER, CookieKey.REFCODE_FGF]])



  // useEffect(() => {

  //   if (callback) {
  //    setCookie(CookieKey.REFCODE_FGF, callback, {
  //       path: '/',
  //       maxAge: CONFIG.EXPIRED_TIME_COOKIE,
  //       sameSite: true,
  //     })
  //   }

  // }, [callback])

  const [isShowModalSuccess, setIsShowModalSuccess] = useState<boolean>(false)


  const clearToken = () => {
    removeCookie(CookieKey.MEMBER_ID)
    removeCookie(CookieKey.MEMBER_NAME)
    removeCookie(CookieKey.MEMBER_SURNAME)
    removeCookie(CookieKey.MEMBER_REFER_CODE)
    removeCookie(CookieKey.MEMBER_IMAGE)
    // removeCookie(CookieKey.REFCODE_FGF)
    removeCookie(CookieKey.LOGIN_PROVIDER)
  }

useEffect(() => {
  if (router.query.fromLogout === 'true') {
    // ถ้ามาจาก logout จริงๆ ค่อย clear
    clearToken()
    signOut({ redirect: false })
  }
}, [router.query])

  const getNotify = async (userId: any) => {
    const result = await MemberWithFriendGetNewFriendApi(userId)
    if (result && result.length > 0) {
      result.forEach((item: any, index: number) => {
        setTimeout(() => {
          showNotification(
            `🎉 ${item.name} ${item.surname} แอดคุณเป็นเพื่อนใหม่`
          );
        }, index * 3000);
      });
    }
  }

    const callApiRegister = async (
      id_token: any,
      image: any,
      name: any,
      refer_code: any,
      email: any,
      provider: any,
    ) => {

    if(isRegistering == true) {
        setIsRegistering(false)
        const result = await UserRegisterOrLogin(
          id_token,
          image,
          name,
          refer_code,
          email,
          provider
        )
        if (result && result.ok == false) {
          // Explicit BE rejection (real auth failure) — safe to clear + sign out.
          registerInFlightRef.current = false
          clearToken()
          signOut({ redirect: false })

          return
        }
          if (result && result.user_id) {
            registerInFlightRef.current = false
              getNotify(result.user_id)
            setCookie(CookieKey.MEMBER_ID, result.user_id, {
              path: '/',
              maxAge: CONFIG.EXPIRED_TIME_COOKIE,
              sameSite: true,
            })

            setCookie(CookieKey.MEMBER_NAME, result.name, {
              path: '/',
              maxAge: CONFIG.EXPIRED_TIME_COOKIE,
              sameSite: true,
            })
            // register-login returns the refer code as `ref_code`, but a BE edge
            // branch can return it null/empty. An empty MEMBER_REFER_CODE cookie
            // is what later bounced the logged-in user to /login?refresh=2 and
            // caused the loop. BACKFILL from get-user (UserGetById -> field
            // `refer_code`) so the cookie is reliably populated post-login.
            // (#mootech-login-loop-fix-v2)
            let referCode = result.ref_code
            if (!referCode || referCode === '') {
              try {
                const fetched = await UserGetById(result.user_id)
                if (fetched && fetched.refer_code) {
                  referCode = fetched.refer_code
                }
              } catch {
                // non-fatal: leave referCode as-is; never block login on backfill
              }
            }
            setCookie(CookieKey.MEMBER_REFER_CODE, referCode, {
              path: '/',
              maxAge: CONFIG.EXPIRED_TIME_COOKIE,
              sameSite: true,
            })

            setCookie(CookieKey.MEMBER_IMAGE, result.picture_url, {
              path: '/',
              maxAge: CONFIG.EXPIRED_TIME_COOKIE,
              sameSite: true,
            })

            setInfoImage(result.picture_url)
            setImgSrc(result.picture_url)
            // DEVELOP
            if (result.result_code && result.result_code  != '') {
              setIsRefreshResult(result.is_refresh)
              if (result.is_refresh == false) {
                setResultCode(result.result_code)
              } else {
                // CALL AGAIN
              }
            }
            setInfoUserId(result.user_id)
            // Routing state for the CTA is now resolved (a first-login user with
            // no chart simply has resultCode='' -> /register, which is correct).
            // Open the CTA gate. (#mootech-cta-race-gate)
            setResultHydrated(true)

          } else {
            // Defensive: response present but NO user_id (should not happen per BE
            // logs). Do NOT clearToken or redirect-loop — release the in-flight
            // guard and let the idempotent authed effect retry on the next render
            // (MEMBER_ID still absent -> shouldRegister stays true). Never wipe.
            registerInFlightRef.current = false
          }
    }
    }


useEffect(() => {
  if (isRegistering) {
    callApiRegister(
      infoToken,
      infoImage,
      infoName,
      infoRefCode,
      infoEmail,
      infoProvider

    )

  }

}, [isRegistering, infoToken, infoImage, infoName, infoRefCode, infoEmail, infoProvider])


  // Returning user: pull resultCode/isRefreshResult from get-user (register-login
  // is skipped when MEMBER_ID exists). Fire once; allow retry only on failure.
  // (#mootech-home-cta-bounce-migration)
  const hydrateReturningUserResult = async (user_id: string) => {
    if (returningHydratedRef.current) return
    returningHydratedRef.current = true
    try {
      const result = await UserGetById(user_id)
      if (result && result.user_id) {
        const { resultCode: code, isRefreshResult: refresh } = resolveReturningResult(result)
        setIsRefreshResult(refresh)
        setResultCode(code)
      }
      // Settle the CTA gate on ANY non-throwing response — even one without a
      // user_id means get-user resolved as far as it can, so the routing state is
      // known (empty -> /register, which is correct). Leaving this only inside the
      // user_id branch would deadlock the CTA on that edge. (#mootech-cta-race-gate)
      setResultHydrated(true)
    } catch {
      // Network failure: keep the gate CLOSED and release the one-shot ref so the
      // next render retries. The CTA stays in loading rather than firing blind.
      returningHydratedRef.current = false
    }
  }


  useEffect(() => {
    const hasMemberId = !!cookies[CookieKey.MEMBER_ID]

    if (status === "authenticated") {
      // DEV bypass: /dev-login already set MEMBER_ID cookie -> skip old-server register-or-login
      if (cookies[CookieKey.LOGIN_PROVIDER] === "DEV") {
        if (hasMemberId) {
          setIsLogin(true)
          setInfoUserId(cookies[CookieKey.MEMBER_ID])
          // DEV bypass never hydrates from get-user, so open the CTA gate here or
          // the dev session's button would hang forever. (#mootech-cta-race-gate)
          setResultHydrated(true)
        }
        return
      }

      // Already have a resolved identity. register-login is skipped here, so the
      // routing state the home CTA needs (resultCode/isRefreshResult) would stay
      // empty -> a returning user with a computed chart was wrongly routed to
      // /register instead of /my-destiny. Rehydrate those two values from get-user
      // (the same source /my-destiny uses), exactly once.
      // (#mootech-home-cta-bounce-migration)
      if (hasMemberId) {
        setIsLogin(true)
        setInfoUserId(cookies[CookieKey.MEMBER_ID])
        hydrateReturningUserResult(cookies[CookieKey.MEMBER_ID])
        return
      }

      // IDEMPOTENT register: fire the round-trip whenever authenticated AND the
      // MEMBER_ID cookie is not present (first login OR after any wipe). The
      // in-flight ref prevents firing twice concurrently while the network call
      // is still pending.
      if (session && shouldRegister(status, hasMemberId) && !registerInFlightRef.current) {
        const user = session.user
        const lineProfile = session.lineProfile

        if (user) {
          registerInFlightRef.current = true
          if (lineProfile && lineProfile.sub) {
            setIsLogin(true)
            setInfoToken(lineProfile.sub)
            setInfoName(user?.name)
            setInfoImage(user.image)
            setImgSrc(user.image)
            setInfoProvider('LINE')
            // setInfoRefCode(callback.length > 5 ? callback : '')
            setInfoEmail('')
            setIsRegistering(true)
          } else {
            setIsLogin(true)
            // Use the STABLE per-provider id, not the short-lived OAuth access token.
            // Passing session.accessToken (ya29...) caused /api/user 400 + log_calculate
            // varchar(255) overflow. providerId = account.providerAccountId.
            setInfoToken(session.providerId)
            setInfoName(user?.name)
            setInfoImage(user.image)
            setImgSrc(user.image)
            setInfoProvider(session.provider ?? infoProvider)
            // setInfoRefCode(callback.length > 5 ? callback : '')
            setInfoEmail(user.email)
            setIsRegistering(true)
          }
        }
      }
    } else if (shouldClearToken(status)) {
      // ONLY on a genuine settled logout ("unauthenticated") — NEVER on the
      // "loading" tick. The loading-tick wipe is what raced the register
      // round-trip and caused the login loop.
      clearToken()
    }
  }, [status , session, callback, cookies[CookieKey.MEMBER_ID], cookies[CookieKey.LOGIN_PROVIDER]]);


  // #calculator-homepage-swap — homepage funnel: a logged-in visitor is routed ONWARD to their
  // destiny (resolveWelcomeTarget) instead of dwelling on the calculator. Same targets the old home
  // CTA produced (result / register), just auto-fired once the routing state is known — replacing the
  // manual click. Anonymous visitors are never touched here and stay on the calculator experience.
  //
  // Gate carefully (per goo consult): authStatus==='authed' AND resolveCtaReady — NOT resolveCtaReady
  // alone, which is true for anon too (→ would bounce anon to /login and destroy the public calc).
  // resolveAuth reports 'loading' (never 'authed') throughout the first-login register round-trip, so
  // this cannot fire before MEMBER_ID lands (no register race). One-shot ref guards against re-firing.
  //
  // BOUNDED WINDOW (goo adversarial review of PR#64 · ฟีม chose option c): the redirect effect can't
  // see the calculator's `phase` (separate component) — a naive fire yanks a logged-in user out of the
  // form/result mid-interaction if resultHydrated settles late (slow network). So the auto-redirect is
  // only allowed to fire within a short window (REDIRECT_WINDOW_MS) after the calculator becomes
  // visible (status settles). In the common case hydrate (one get-user call) settles well inside the
  // window → the funnel works. If it settles LATE, the window has closed → we do NOT yank; the authed
  // user keeps a usable calculator and can click the "เข้าใช้งานเต็มระบบ" secondary CTA themselves.
  const REDIRECT_WINDOW_MS = 1500
  const redirectedRef = useRef<boolean>(false)
  const redirectWindowClosedRef = useRef<boolean>(false)
  useEffect(() => {
    // Start the window only once the calculator is actually visible (past the loading gate) — before
    // that the user can't interact anyway, so the clock protecting interaction shouldn't run yet.
    if (status === 'loading') return
    const t = setTimeout(() => { redirectWindowClosedRef.current = true }, REDIRECT_WINDOW_MS)
    return () => clearTimeout(t)
  }, [status])
  useEffect(() => {
    if (redirectedRef.current || redirectWindowClosedRef.current) return
    if (authStatus !== 'authed') return
    if (!resolveCtaReady(authStatus, resultHydrated)) return
    const target = resolveWelcomeTarget(authStatus, resultCode, isRefreshResult)
    // 'login'/'wait' are unreachable for an authed+ready user — guard anyway, never bounce.
    if (target.kind === 'login' || target.kind === 'wait') return
    redirectedRef.current = true
    switch (target.kind) {
      case 'result':
        router.replace(PageRouter.RESULT.replaceAll(':code', target.code))
        break
      case 'register':
        router.replace(PageRouter.REGISTER)
        break
      case 'register-refresh':
        router.replace(PageRouter.REGISTER + '?refresh=1')
        break
    }
  }, [authStatus, resultHydrated, resultCode, isRefreshResult, router])


  // ✅ Loading
  if (status === "loading") {
    return <ScreenLoading />;
  }

  const onCloseModalEmail = () => {
    setIsShowModalEmail(false)
  }
  const onSubmitModalEmail = (email: any) => {
    setIsShowModalEmail(false)

    callApiRegister(
      infoToken,
      infoImage,
      infoName,
      infoRefCode,
      email,
      infoProvider

    )

  }


  return (
    <>
      <Head>
        <title>Mumate</title>
      </Head>

      {/* #calculator-homepage-swap — the homepage IS the public Bazi Calculator experience now
          (shared component with /calculator). The auth/register machine above still runs on every
          render; an authed visitor is redirected onward by the effect above, an anonymous visitor
          stays here and uses the calculator. The legacy static hero was retired (git history:
          commit 804f85f and earlier). */}
      <CalculatorHomeExperience />

      {
        isShowModalSuccess ?
          <ModalLoginSuccess />
        :
          null
      }

      {
        isShowModalEmail ?
          <ModalEmail
            onClose={onCloseModalEmail}
            onSubmitOK={onSubmitModalEmail}
            id_token={infoToken}
            name={infoName}
            image={infoImage}
            refer_code={infoRefCode}
            provider={infoProvider}
          />
        :
          null
      }


      {message && (
        <div
          className={`
            fixed top-0 right-10 z-50 mt-12
            rounded-2xl
            bg-white
            border border-white/10
            px-5 py-4
            shadow-2xl
            backdrop-blur-md
            transition-all duration-1000
            ${
              show
                ? "translate-y-0 opacity-100"
                : "-translate-y-4 opacity-0"
            }
          `}
        >
          {message}
        </div>
      )}
    </>
  );
}
