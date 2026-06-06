import { useEffect, useState } from 'react'
import Image from "next/image";
type ComponentProps = {
onSubmit: any,
}

const BoxFriendGetFriendInfo = ({ 
onSubmit
}: ComponentProps) => {
 

  return (
               <div 
               className="flex w-full mt-4  justify-center flex-wrap   rounded-[16px] p-[24px]"
               style={{
                background: 'linear-gradient(141.39deg, rgba(138, 185, 239, 0.65) 22.2%, rgba(251, 217, 226, 0.65) 77.8%)'

               }}
               >

                              <Image
                                  src={'/images/mumate/ic_gift.svg'}
                                  width={56}
                                  height={56}
                                  alt="icon-result"/>

                              <span className="ml-2">
                                เพียงแค่ชวนเพื่อนมา<br/>สมัครสมาชิกกับ Mumate <br/><span className=" font-medium text-moumate_blue_dark">รับสิทธิ์เช็คดวงเพิ่ม!</span>
                              </span>

                              <div>

                          
                             </div>

                                  <div 
                                  
                                  onClick={onSubmit}
                                  className="
                                  cursor-pointer
                                  w-full mt-4 flex flex-nowrap justify-center bg-moumate_blue_dark  py-[12px] px-[24px] rounded-[16px] items-center ">

                                    <span className="mr-2 text-white w-full grow font-medium">
                                      ดูรายละเอียด
                                    </span>

                                    <div className="flex  flex-none w-fit">
                                      <Image
                                          src={'/images/mumate/ic_next.svg'}
                                          width={32}
                                          height={32}
                                          alt="icon-result"/>
                                    </div>
                                  </div>
                              </div>
  )
}

export default BoxFriendGetFriendInfo
