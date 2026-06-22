import Image from 'next/image'
import { useEffect, useId, useRef, useState } from 'react'
import { PageRouter } from '@/constants/router'
import { CookieKey } from '@/constants/cookie-key'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useCookies } from 'react-cookie'
import { MemberWithFriendGetApi } from '@/constants/api/api-member-with-friend-get'
import SkeletonRow from '@/components/ui/skeleton-row'
import getConfig from 'next/config'

type ComponentProps = {
  isLimitation: boolean,
  userId: string,
  referCode: string,
  onClose: any,
  onClickAddFriend: any
  onClickMatching: any,
  onClickFriendDetail: any,
}
const ModalSelectFriend = ({
  isLimitation,
  userId,
  referCode,
  onClose,
  onClickAddFriend,
  onClickMatching,
  onClickFriendDetail
}: ComponentProps) => {
  const { publicRuntimeConfig } = getConfig()

 const [cookies, setCookie , removeCookie] = useCookies([
    CookieKey.MEMBER_ID, 
    CookieKey.MEMBER_NAME, 
    CookieKey.MEMBER_SURNAME, 
    CookieKey.MEMBER_REFER_CODE, 
    CookieKey.MEMBER_IMAGE, 
  ])

  const router = useRouter();
  const refresh = router.query.refresh as string;

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [hasLoaded, setHasLoaded] = useState<boolean>(false)

  const { data: session, status } = useSession();
  const [memberId, setMemberId] = useState<string>('')
  const [displayName, setDisplayName] = useState<string>('')
  const [displaySurname, setDisplaySurname] = useState<string>('')
  const [displayImage, setDisplayImage] = useState<string>('')


  const [listFriends, setListFriends] = useState<any[]>([])
  const [linkReferCode, setLinkReferCode] = useState<string>('')
  

  useEffect(() => {
    if (userId) {
      setMemberId(userId)
    }
  }, [userId])

  useEffect(() => {

    if (referCode) {
      const link = publicRuntimeConfig.NEXT_STATIC_NEXTAUTH_URL+'/login?callback=' + referCode
      setLinkReferCode(link)
    }

  }, [referCode])


  useEffect(() => {
    if (memberId) {
         callApiGet(memberId)
    }
  }, [memberId])


   const callApiGet = async ( userId: string ) => {
    setIsLoading(true)
    try {
      const result = await MemberWithFriendGetApi(userId);
      setListFriends(result)
    } finally {
      setIsLoading(false)
      setHasLoaded(true)
    }
  }


  const onCopyLink = async () => {
    const shareUrl = linkReferCode;
    try {
      // มือถือจะขึ้นเลือก LINE / Facebook / IG / อื่นๆ
      if (navigator.share) {
        await navigator.share({
          title: "MuMate",
          text: "Join me on MuMate 💫",
          url: shareUrl,
        });

        return;
      }

      // fallback desktop
      await navigator.clipboard.writeText(shareUrl);

      alert("navigator");
    } catch (error) {
    }
  };

  return (
    <div
      className={'   fixed z-[9999] inset-0 overflow-y-auto  '}
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex  items-center  justify-center h-full md:h-full  lg:max-h-screen pt-4 px-4 md:px-12 lg:px-4 pb-20 text-center sm:block sm:p-0">
        <div
          className="fixed  inset-0 bg-black backdrop-blur-[10px] bg-opacity-[0.48] transition-opacity"
          aria-hidden="true"
        ></div>

        <span className="hidden sm:inline-block align-middle h-screen" aria-hidden="true">
          &#8203;
        </span>

          <div className="
            fixed top-0 left-1/2
            -translate-x-1/2
            w-full lg:w-[460px]
            mt-5 overflow-hidden
            shadow-box transform transition-all
            align-middle
          ">

            <div 
                className="w-full bg-[#F2F7FD]  rounded-[32px]  h-full  justify-center font-prompt flex-wrap">

                  <div 
                
                  className="w-full flex flex-wrap">

                    

                    <div className="flex justify-center w-full flex-wrap pt-[20px] px-[32px]">
                      <div className="w-full lg:w-[400px] flex  flex-wrap">
                        <div className="w-full flex-wrap">


                          <div className='w-full flex flex-wrap'>
                            <div className='w-full flex flex-nowrap'>
                              
                              <div className='w-fit flex flex-none  items-center'>
                                <Image
                                  src={'/images/mumate/ic_back_modal_friend.svg'}
                                  width={40}
                                  onClick={() => { onClose() }}
                                  height={40}
                                  className=' cursor-pointer '
                                  alt='icon-sparkles' />
                              </div>

                              <div className='w-full justify-center flex grow items-center'>

                      
                              </div>
                            </div>

                            <div className='w-full flex flex-wrap mt-4'>
                              <span 
                              className='w-full  flex flex-wrap justify-center text-black text-[16px]'>สร้างเพื่อน คู่ค้า และอื่น ๆ</span>
                  
                            </div>



                          </div>



                        </div>
                      </div>

                    </div>


                  </div>


                  <div className=' w-full flex flex-wrap px-[32px] '>

                



                      <div className='w-full flex flex-wrap justify-center'>
                        <button
                        disabled={isLimitation}
                        onClick={() => { onClickAddFriend() }}
                          className={
                           ( isLimitation ? '  bg-gray-200 '  : '  bg-moumate_blue cursor-pointer '  ) + 
                            " w-full   rounded-[40px] py-[16px] px-[16px] mt-[24px] text-white justify-center"}
                        >
                          เพิ่มเพื่อนหรือคู่ค้าที่กำหนดเอง
                        </button>
                      </div>


                      <div className='w-full flex flex-wrap justify-center'>
                        <button
                        disabled={isLimitation}
                        onClick={() => { onCopyLink() }}
                          className={
                            ( isLimitation ? '  bg-gray-200 text-white  '  : '  bg-[#D4F8F9] cursor-pointer text-[#444444]  '  ) + 
                    
                            " w-full   rounded-[40px] py-[8px] px-[8px] mt-[24px] justify-center"}
                        >
                          <div className='w-full flex flex-nowrap'>

                            <div className='w-full flex grow items-center'>
                              <Image
                                src={'/images/mumate/ic_share_link.svg'}
                                width={40}
                                height={40}
                                className=' cursor-pointer mr-4 '
                                alt='icon-sparkles' />
                              <span className='  '>Invite Friends</span>
                            </div>

                             <div className='w-fit flex flex-none items-center'>
                                <Image
                                src={'/images/mumate/ic-chevron-down.svg'}
                                width={24}
                                height={24}
                                className='mr-4 '
                                alt='icon-sparkles' />
                             </div>

                          </div>
                       
                        </button>
                      </div>



                  </div>

                  <div className='w-full flex flex-wrap mt-6 justify-start  px-[32px] pb-[60px]'>

                    <span className=' w-full overflow-y-auto justify-start flex font-medium text-[#1B9AAF] mb-4'>Your Friends ( <span>{isLoading || !hasLoaded ? '...' : listFriends.length} คน</span> )</span>


                    <div className='w-full h-[200px] overflow-y-auto flex-wrap'>
                      {
                        (isLoading || !hasLoaded) ? (
                          <SkeletonRow count={3} />
                        ) : listFriends.length === 0 ? (
                          <div className='w-full flex justify-center text-moumate_gray font-prompt py-6'>
                            ยังไม่มีเพื่อน เพิ่มเพื่อนคนแรกได้เลย
                          </div>
                        ) : (
                        listFriends.map(function(item, index) {
                          return (
                            <div
                            key={index}
                            onClick={() => { onClickMatching(item.id, item.name, item.surname, item.picture_url, item.is_disable) }}
                            className={(item.is_disable == false ? ' cursor-pointer 0  ' : ' bg-gray-200 text-gray-50 ') + ' w-full flex flex-nowrap  border-b border-gray-300 py-2'}
                            >

                              <div className='w-full flex grow items-center'>
                                  {
                                    item.picture_url ?
                                        <div className=' flex flex-none rounded-full w-[40px] h-[40px] bg-black'>
                                          <Image
                                                alt="icon-next"
                                                src={item.picture_url}
                                                width={40}
                                                height={40}
                                                className=' rounded-full '
                                              />
                                        </div>    
                                    :

                                    <div className=' flex flex-none rounded-full w-[40px] h-[40px] bg-black'>
                                      
                                    </div>
                                

                                  }
                                
                                  <div className='w-full flex grow px-4'>
                                      <div className='w-full flex flex-nowrap  px-[12px]'>
              
                                        <span className=' w-full flex justify-start grow '>{item.name} {item.surname}</span>
              
                                        
              
                                      </div>
              
              
                                  </div>
                              </div>

                             {
                              item.is_disable == false && <div className='w-fit flex flex-none items-center'>
                                <Image
                                src={'/images/mumate/ic_edit.png'}
                                width={24}
                                height={24}

                                onClick={() => { onClickFriendDetail(item.id, item.name, item.surname, item.picture_url) }}
                                className=' cursor-pointer mr-4 '
                                alt='icon-sparkles' />
                             </div>
                            }


                            </div>
                          )
                        })
                        )
                      }
                    </div>

                  </div>

              
                </div>


        </div>
      </div>
    </div>
  )
}

export default ModalSelectFriend
