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

type ComponentProps = {
  isShowMenu: boolean,
  isLogin: boolean,
  image: string,
  isShowProfile?: boolean

}
const HeaderMuMate = ({
  isShowMenu,
  isLogin,
  image,
  isShowProfile = true
}: ComponentProps) => {


  const router = useRouter();

  const [isShow, setIsShow] = useState<boolean>(isShowMenu)
  const [isShowUpgrade, setIsShowUpgrade] = useState<boolean>(false)

  const fallback = '/images/mumate/ic_logo.svg'
  const [imgSrc, setImgSrc] = useState(image || fallback)

  const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
  ])

  useEffect(() => {
    const dataId = cookies[CookieKey.MEMBER_ID]
 
    if (dataId) {
 
      callApiGetUser(dataId)
    }
  
  },  [
        cookies[CookieKey.MEMBER_ID]
      ]
  )




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
    if (image) {
        setImgSrc(image)
    }
  }, [image])


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
            <div className='w-fit flex flex-none'>
              <Image
                src={isShow ? '/images/icons/x.svg' : '/images/mumate/ic_menu.svg'}
                width={32}
                height={32}
                onClick={() => { onClickMenu()}}
                className=' cursor-pointer '
                alt='icon-menu' />
            </div>

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
                isLogin && isShowProfile == true? 
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
              isShow ?
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
