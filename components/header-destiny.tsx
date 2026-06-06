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
  displaySurname: string,
  onClickWorkSection: any,
  onClickLoveSection: any,
  onClickCheckSection: any,
  openMenu: any,
  isOpen: any,
}
const HeaderDestiny = ({
  displayImage,
  displayName,
  displaySurname,
  onClickWorkSection,
  onClickLoveSection,
  onClickCheckSection,
  openMenu,
  isOpen,
}: ComponentProps) => {

  const router = useRouter();

  const [isOpenMenu, setIsOpenMenu] = useState<boolean>(false)

  const onClickOpenMenu = () => {
    openMenu(!isOpenMenu)
  }

  useEffect(() => {
    setIsOpenMenu(isOpen)
  }, [isOpen])



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
                  <div className=" flex grow lg:flex-none items-center  w-full lg:w-fit">

                      <Image
                        className=" mr-3 cursor-pointer flex lg:hidden "
                        alt="mootech-icon"
                        src={isOpenMenu ? '/images/mumate/Close.svg' :  '/images/mumate/Bars.svg' }
                        onClick={onClickOpenMenu}
                        width={24}
                        height={24}
                      />
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


                  <div
                  className="hidden lg:flex flex-nowrap w-full gap-x-6 justify-center px-4 "
                  >

                    <div 
                    onClick={onClickLoveSection}
                    className="w-fit flex cursor-pointer flex-none items-center">
                      <Image
                        className=" rounded-full "
                        alt="mootech-icon"
                        src={ '/images/mumate/Pink-heart.svg'}
                        width={24}
                        height={24}
                      />

                      <span className=' ml-2 text-white'>เช็คเรื่องความรัก</span>

                    
                    </div>

                    <div 
                    onClick={onClickWorkSection}
                    className="w-fit flex cursor-pointer  flex-none items-center">
                      <Image
                        className=" rounded-full "
                        alt="mootech-icon"
                        src={ '/images/mumate/Money-with-wings.svg'}
                        width={24}
                        height={24}
                      />

                      <span className=' ml-2 text-white'>เช็คเรื่องการงาน</span>

                    
                    </div>
                    <a 
                    className=' w-fit flex   cursor-pointer flex-none items-center'
                    target="_blank" 

                    href="https://lin.ee/D9XSKGo" 
                    rel="noopener noreferrer">       
                    <div 
                    onClick={onClickCheckSection}
                    className="w-fit flex   cursor-pointer flex-none items-center">
                      <Image
                        className=" rounded-full "
                        alt="mootech-icon"
                        src={ '/images/mumate/Crystal-ball.svg'}
                        width={24}
                        height={24}
                      />

                      <span className=' ml-2 text-white'>ดูดวงกับซินแส</span>

                    
                    </div>
                    </a>

                  </div>


                  
                  <div 
                  onClick={onClickProfile}
                  className=" cursor-pointer   flex  flex-none flex-nowrap  w-fit  py-2 px-4 border border-white rounded-[16px]">
                    <div className="w-fit flex flex-none items-center">
                      <Image
                        className=" rounded-full "
                        alt="mootech-icon"
                        src={ displayImage ? displayImage : '/images/mumate/user-circle.svg'}
                        width={24}
                        height={24}
                      />
                    </div>
                    <div className="w-full grow items-center pl-2">
                        <span className=" text-white">{displayName} {displaySurname}</span>
                    </div>

                  </div>
                  
                </div>
          </div>
  )
}

export default HeaderDestiny
