import { OTPGet } from '@/constants/api/api-otp-get'
import { OTPVerify } from '@/constants/api/api-otp-verify'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/router';
import { PageRouter } from '@/constants/router';

type ComponentProps = {
  displayImage: string,
  displayName: string,
  displaySurname: string

}
const Header = ({
  displayImage,
  displayName,
  displaySurname,
}: ComponentProps) => {


  const fallback = '/images/mumate/user-circle.svg'
  const [imgSrc, setImgSrc] = useState(displayImage || fallback)

  const router = useRouter();

  const onClickProfile = () => {
    router.replace(PageRouter.PROFILE)
  }

  const signOutFromLine = () => {
     signOut();
  }


  return (
   <div className="w-full bg-moumate_blue h-[72px] z-50 flex justify-center  items-center fixed top-0 left-0">

                <div 
                className=" flex flex-nowrap w-full md:w-[800px] lg:w-[1050px]  justify-center px-4 ">
                  <div className=" flex grow items-center  w-full">
                    <div className="flex   w-[110px]">
                      <Image
                        className=""
                        alt="mootech-icon"
                        src={'/images/mumate/ic_logo.svg'}
                        width={110}
                        height={26}
                      />
                    </div>
                  </div>
                  {
              

                    <div 
                    
                onClick={onClickProfile}
                    className=" cursor-pointer   flex  flex-none flex-nowrap  w-fit  py-2 px-4 border border-white rounded-[16px]">
                      <div className="w-fit flex flex-none items-center">
                        <Image
                          className=" rounded-full "
                          alt="mootech-icon"
                          src={imgSrc}
                          width={24}
                          height={24}
                          onError={() => setImgSrc(fallback)}
                        />
                      </div>
                      <div className="w-full grow items-center pl-2">
                          <span className=" text-white">{displayName} {displaySurname}</span>
                      </div>

                    </div>
                  }
                </div>
          </div>
  )
}

export default Header
