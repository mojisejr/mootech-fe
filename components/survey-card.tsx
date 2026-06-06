import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatDateAndTime } from '@/utils/formate-date-thai'
import { PageRouter } from '@/constants/router'
type ComponentProps = {
  create_at: string
  url: string,
  title: string
  emoji: string,
  description: string,
  code: string,
  refer_code: string,
  gotoSurvey: any,
}

const SurveyCard = ({ 
  create_at,
  url,
  title,
  emoji,
  description,
  code,
  refer_code,
  gotoSurvey,
}: ComponentProps) => {
 


  return (
      <div className=" w-full  flex flex-wrap font-ibm ">
        <div className=" w-full flex flex-wrap  backdrop-blur-sm bg-white/45 p-[24px] rounded-[16px]    ">

          <div className='w-full flex '>
                <div className="flex w-[107px]  items-center  ">
  
                    <Image
                      className=" rounded-xl "
                      alt="mootech-icon"
                      src={url}
                      width={107}
                      height={160}
                    />
              </div>

              <div className={
               
                " flex-grow min-w-0 px-4 "
                }>
                  <div className=' w-full flex-wrap'>
                    <div className='w-full flex flex-wrap'>
                      <span className='w-fit text-[16px] '>{emoji}</span>
                      <span className='w-fit pl-4 text-[16px] font-bold '>{title}</span>
                    </div>

                    <span className='w-full flex text-[16px] text-[#888888] my-4 '>{description}</span>


                    <span 
                    onClick={() => { gotoSurvey() }}
                    className='w-full  flex text-[16px] text-moumate_blue underline cursor-pointer '>ลองทำอีกครั้ง</span>
                  </div>
              </div>

              <div className={
               
                "flex flex-none w-[100px] pl-4 items-start justify-end"
                }>
                    <a 
                      href={PageRouter.SHARE_TYPE.replaceAll(':code', code) + '?callback=' + refer_code}
                      className='w-fit'
                      rel="noopener noreferrer"
                      target='_blank'
                    >
                    <Image
                      className=" rounded-xl cursor-pointer "
                      alt="mootech-icon"
                      src={'/images/mumate/ic_share_small.svg'}
                      width={40}
                      height={40}
                    />
                  </a>
              </div>
          </div>



          
        </div>
      </div>
  )
}

export default SurveyCard
