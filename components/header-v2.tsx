import { OTPGet } from '@/constants/api/api-otp-get'
import { OTPVerify } from '@/constants/api/api-otp-verify'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { PageRouter } from '@/constants/router';
import Menu from './menu';
import { CookieKey } from '@/constants/cookie-key';
import { useCookies } from 'react-cookie';
import { UserGetById } from '@/constants/api/api-user-get';
import { useCurrentUser } from '@/lib/auth/use-current-user';

type ComponentProps = {
  isShowMenu: boolean,
  isLogin: boolean,
  image: string,
  isShowProfile?: boolean,
  // calc-only opt-in (#calculator-hero-flow): public visitors (not logged in) get a
  // "เข้าสู่ระบบ / สมัครสมาชิก" button and NO hamburger/menu; members get the menu + upgrade + avatar
  // back. index.tsx doesn't pass this, so its header behaviour is unchanged.
  gateByLogin?: boolean

}
const HeaderMuMate = ({
  isShowMenu,
  isLogin,
  image,
  isShowProfile = true,
  gateByLogin = false
}: ComponentProps) => {


  const router = useRouter();

  const [isShow, setIsShow] = useState<boolean>(isShowMenu)
  const [isShowUpgrade, setIsShowUpgrade] = useState<boolean>(false)

  const fallback = '/images/mumate/ic_logo.svg'

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID,
    CookieKey.MEMBER_IMAGE,
  ])

  // Avatar source resolution (#mootech-login-coldstart-fix). On a returning /
  // deep-link entry (paste a link, open-in-external-browser from LINE) the home
  // page early-returns when MEMBER_ID already exists and never re-hydrates the
  // image prop, so `image` arrives as the fallback logo even though the real
  // photo is sitting in the MEMBER_IMAGE cookie. Prefer the real image (prop or
  // cookie) over the logo so the avatar shows the user's photo on first paint,
  // not after a navigate-away-and-back. (was "avatar หาย" = logo, not photo)
  const memberImage = cookies[CookieKey.MEMBER_IMAGE]
  const resolveAvatar = (img: string) =>
    img && img !== fallback ? img : memberImage || fallback
  const [imgSrc, setImgSrc] = useState(resolveAvatar(image))

  // Use the uuid-validated identity (never the raw cookie) so a stale OAuth access
  // token left in MEMBER_ID can't fire UserGetById(ya29...) -> 400.
  const { userId: resolvedUserId } = useCurrentUser()
  const isLoggedIn = isLogin || !!resolvedUserId
  const showMenuTrigger = !gateByLogin || isLoggedIn

  useEffect(() => {
    if (resolvedUserId) {
      callApiGetUser(resolvedUserId)
    }
  },  [resolvedUserId])




  const callApiGetUser = async (user_id: string) => {
    const result = await UserGetById(user_id);
    if (result && result.user_id) {
    
      if (result.payment && result.payment.expire_at && result.payment.is_not_expired == true) {
        setIsShowUpgrade(false)
      } else {
        setIsShowUpgrade(true)
      }
    }
  }

  useEffect(() => {
    // Keep the avatar on the real photo (prop or cookie); only fall to the logo
    // when neither exists. Avoids the deep-link "logo instead of photo" flash.
    setImgSrc(resolveAvatar(image))
  }, [image, memberImage])


  const onClickMenu = () => {
    setIsShow(!isShow)
  }


  const gotoLoginWith = () => {
    router.push(PageRouter.LOGIN_WITH)
  }


  const gotoHome = () => {
    router.replace(PageRouter.HOME)
  }


  return (
    <div className='w-full flexed top-0 left-0'>

      <div className='w-full relative'>
          <div className='w-full z-50  bg-[#1B9AAF] fixed top-0 left-0 h-[60px] flex items-center px-4 flex-nowrap'>
            {showMenuTrigger && (
              <div className='w-fit flex flex-none'>
                <Image
                  src={isShow ? '/images/icons/x.svg' : '/images/mumate/ic_menu.svg'}
                  width={32}
                  height={32}
                  onClick={() => { onClickMenu()}}
                  className=' cursor-pointer '
                  alt='icon-menu' />
              </div>
            )}

            <div className='w-full grow flex pl-4'>
              <Image
                src={'/images/mumate/ic_logo.svg'}
                width={103}
                height={24}
                className=" cursor-pointer  "
                onClick={ () => { gotoHome() }}
                alt='icon-app' />
            </div>

            <div className='w-fit flex  items-center flex-none'>
              {
                isShowUpgrade && <div className='w-fit pr-4'>
                  <span 
                  onClick={() => { router.replace(PageRouter.PACKAGE_PRICE) }}
                  className='w-fit cursor-pointer text-[#1B9AAF] bg-[#F1FF75] py-[4px] px-[8px] rounded-[8px]'>
                  อัพเกรด
                </span>
                </div>
              }
              {
                // Show the avatar whenever identity is real — trust the
                // cookie-validated `resolvedUserId` (useCurrentUser), not only the
                // parent's optimistic local `isLogin`. During the cold/login window
                // `isLogin` could lag while the MEMBER_ID cookie was already set,
                // collapsing the slot to the "เข้าสู่ระบบ" text = the "icon หาย"
                // symptom. (#mootech-login-coldstart-fix)
                (isLogin || !!resolvedUserId) && isShowProfile == true?
                <Image
                    src={imgSrc}
                    width={40}
                    height={40}
                    className=' rounded-full cursor-pointer '
                    alt='icon-app'
                    onClick={() => { router.push(PageRouter.PROFILE)}}
                    onError={() => setImgSrc(fallback)}

                />
                :
                isShowProfile == true ?
                  gateByLogin ?
                    <button
                      type='button'
                      onClick={ () => { gotoLoginWith() }}
                      className='rounded-full bg-white px-4 py-1.5 text-[13px] font-medium text-[#1B9AAF] cursor-pointer'
                    >เข้าสู่ระบบ / สมัครสมาชิก</button>
                  :
                  <span
                    onClick={ () => { gotoLoginWith() }}
                    className=' text-white text-md cursor-pointer '
                  >เข้าสู่ระบบ</span>
                :
                null
              }
            </div>


            
          </div>
          
          {
              isShow && showMenuTrigger ?
              <div className=' w-full flex flex-wrap fixed  top-0 left-0  z-50 '>

                <Menu is_show={isShow} />


              </div>
              :
              null
          }

        </div>
  </div>
  )
}

export default HeaderMuMate
