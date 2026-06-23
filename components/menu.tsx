import { OTPGet } from '@/constants/api/api-otp-get'
import { OTPVerify } from '@/constants/api/api-otp-verify'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { PageRouter } from '@/constants/router';
import { useCookies } from 'react-cookie';
import { CookieKey } from '@/constants/cookie-key';
import { CONFIG } from '@/constants/config';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { resolveMatchingTarget } from '@/lib/auth/matching-target';
import { UserGetById } from '@/constants/api/api-user-get';

type ComponentProps = {
  is_show: boolean,

}
const Menu = ({
  is_show,
}: ComponentProps) => {

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
    CookieKey.REFCODE_FGF,
    CookieKey.LOGIN_PROVIDER
  ])

  const [resultCode, setResultCode] = useState<any>(null)

  const router = useRouter();
  const { userId: authUserId, status: authStatus } = useCurrentUser();

  useEffect(() => {

    const data = cookies[CookieKey.MEMBER_REFER_CODE]
    if (data) {
      setResultCode(data)
    }

  }, [ cookies[CookieKey.MEMBER_REFER_CODE]])

  const [menus, setMenus] = useState<any[]>([
    { title: 'หน้าหลัก' , to: PageRouter.HOME, items: [] },
    { title: 'บริการของเรา' , to: PageRouter.HOME, items: 
        [ 
          {title: 'ดวงสมพงศ์' , to: PageRouter.HOME, image: '/images/mumate/ic_menu_1.svg'},
          {title: 'ดวงสมพงศ์ แบบ public' , to: PageRouter.HOME, image: '/images/mumate/ic_menu_2.svg'},
          {title: 'ดูดวงสำหรับองค์กร' , to: PageRouter.HOME, image: '/images/mumate/ic_menu_3.svg'},
          {title: 'เซียมซี' , to: PageRouter.FORTUNE_STICK, image: '/images/mumate/ic_menu_4.svg'},
          {title: 'ปฏิทิน' , to: PageRouter.CHINESE_CALENDAR, image: '/images/mumate/ic_menu_5.svg'},
          {title: 'ดูดวง' , to: PageRouter.PACKAGE_HOROSCOPE, image: '/images/mumate/ic_menu_6.svg'},
          {title: 'Ai Chat' , to: PageRouter.HOME, image: '/images/mumate/ic_menu_7.svg'},
          {title: 'แพ็คเกจราคา' , to: PageRouter.PACKAGE_PRICE, image: '/images/mumate/ic_menu_8.svg'},
          {title: 'ร้านค้า' , to: PageRouter.HOME, image: '/images/mumate/ic_menu_9.svg'},

        ] 
    },
    { title: 'แพ็คเกจราคา' , to: PageRouter.PACKAGE_PRICE, items: [] },
    { title: 'ร้านค้า' , to: PageRouter.HOME, items: [] },
    { title: 'บทความ' , to: PageRouter.HOME, items: [] }
  ])

  const [isOpen, setIsOpen] = useState<boolean>(true)


  const goToMatchingWithCode = (code: string) => {
    router.replace(PageRouter.MATCHING.replaceAll(':code', code))
  }

  // A logged-in user must NEVER be bounced to /login because the refer-code
  // cookie is empty. Empty refer-code is a DATA hydration problem -> backfill it
  // from get-user (UserGetById -> field `refer_code`), set the cookie, then route
  // onward to /matching. If the backfill yields nothing, still route the user
  // onward (HOME) rather than stranding/looping them. Only a genuinely anonymous
  // user (no auth) is sent to /login. (#mootech-login-loop-fix-v2)
  const backfillAndRoute = async () => {
    let code = ''
    try {
      if (authUserId) {
        const result = await UserGetById(authUserId)
        if (result && result.refer_code) {
          code = String(result.refer_code)
          setCookie(CookieKey.MEMBER_REFER_CODE, code, {
            path: '/',
            maxAge: CONFIG.EXPIRED_TIME_COOKIE,
            sameSite: true,
          })
          setResultCode(code)
        }
      }
    } catch {
      // swallow — fall through to the graceful onward route below
    }

    if (code !== '') {
      goToMatchingWithCode(code)
    } else {
      // Backfill failed/empty: do NOT route a logged-in user to /login. Send them
      // home instead so they can retry without entering the old refresh=2 loop.
      router.replace(PageRouter.HOME)
    }
  }

  const gotoMatching = () => {
    const isAuthed = authStatus === 'authed' || !!cookies[CookieKey.MEMBER_ID]
    const target = resolveMatchingTarget(isAuthed, resultCode)

    switch (target.kind) {
      case 'go-matching':
        goToMatchingWithCode(target.code)
        break
      case 'needs-backfill':
        void backfillAndRoute()
        break
      case 'go-login':
        router.replace(PageRouter.LOGIN_WITH)
        break
    }
  }

  const handleLogout = () => {
    // Clear auth cookies (the app's identity source) then end the NextAuth session.
    removeCookie(CookieKey.MEMBER_ID, { path: '/' })
    removeCookie(CookieKey.MEMBER_NAME, { path: '/' })
    removeCookie(CookieKey.MEMBER_SURNAME, { path: '/' })
    removeCookie(CookieKey.MEMBER_REFER_CODE, { path: '/' })
    removeCookie(CookieKey.MEMBER_IMAGE, { path: '/' })
    removeCookie(CookieKey.REFCODE_FGF, { path: '/' })
    removeCookie(CookieKey.LOGIN_PROVIDER, { path: '/' })
    signOut({ callbackUrl: PageRouter.LOGIN })
  }

  return (
          <div className=' w-full flex flex-wrap bg-white fixed top-0 left-0  z-50 mt-[60px] rounded-b-lg shadow-sm'>

       
              <div 
              onClick={() => { router.replace(menus[0].to) }}
              className={
                ' border-b border-gray-200  w-full  py-4 cursor-pointer px-2'}>
                  <span className={' w-full text-moumate_blue'}>{menus[0].title}</span>
              </div>
               <div
               
                  onClick={ () => { setIsOpen(!isOpen) }}
               className={ (isOpen ? '  border-b ' : '   border-b-0 ' ) + 
                ' border-gray-200  w-full  py-4 cursor-pointer px-2'}>

                  <div 
                  
                  className='w-full flex flex-nowrap cursor-pointer'>
                    <span className={' w-full grow text-moumate_blue'}>{menus[1].title}</span>
                    <div className=' w-fit flex flex-none '>
                          <Image
                          alt="mootech-icon"
                          src={ isOpen ? '/images/icons/chevron-up.svg' : '/images/icons/chevron-down.svg'}
                          width={24}
                          height={24}
                        />
                    </div>
                  </div>
              </div>
              {
                isOpen ?
                  <div className='w-full flex flex-wrap'>

                      <div 
                      onClick={() => { gotoMatching() }}
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[0].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[0].title}</span>
                      </div> 
                      {/* <div 
                      onClick={() => { router.replace(menus[1].items[1].to)}}
                      
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[1].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[1].title}</span>
                      </div> 
                      <div 
                      
                      onClick={() => { router.replace(menus[1].items[2].to)}}
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[2].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[2].title}</span>
                      </div>  */}
                      <div 
                      
                      onClick={() => { router.replace(menus[1].items[3].to)}}
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[3].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[3].title}</span>
                      </div> 
                      <div 
                      
                      onClick={() => { router.replace(menus[1].items[4].to)}}
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[4].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[4].title}</span>
                      </div>
                      <div 
                      onClick={() => { router.replace(menus[1].items[5].to)}}
                      
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[5].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[5].title}</span>
                      </div> 
                      {/* <div 
                      onClick={() => { router.replace(menus[1].items[6].to)}}
                      
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[6].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[6].title}</span>
                      </div>  */}
                      <div 
                      onClick={() => { router.replace(menus[1].items[7].to)}}
                      
                      className={
                          ' border-b-0 border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[7].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[7].title}</span>
                      </div> 
                      {/* <div 
                      
                      onClick={() => { router.replace(menus[1].items[8].to)}}
                      className={
                          ' border-b border-gray-200  w-full flex  flex-nowrap py-4 cursor-pointer px-4 '}>
                            <div className=' w-fit flex flex-none '>
                              <Image
                                className="  "
                                alt="meu-icon"
                                src={menus[1].items[8].image}
                                width={24}
                                height={24}
                              />
                            </div>
                            <span className={' w-full flex grow text-moumate_blue ml-2'}>{menus[1].items[8].title}</span>
                      </div>  */}
                  </div>
                :
                null
              }
              {/* <div className={
                '  w-full  py-4 cursor-pointer px-2'}>
                  <span className={' w-full text-moumate_blue'}>{menus[4].title}</span>
              </div> */}

              <div
              onClick={handleLogout}
              className={' w-full  py-4 cursor-pointer px-2'}>
                  <span className={' w-full text-red-500'}>ออกจากระบบ</span>
              </div>

          </div>
  )
}

export default Menu
