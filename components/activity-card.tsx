import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatDateAndTime } from '@/utils/formate-date-thai'
type ComponentProps = {
  create_at: string
  point: number
  description: string
}

const ActivityCard = ({ 
  create_at,
  point,
  description,
}: ComponentProps) => {
 


  return (
      <div className=" w-full flex flex-wrap font-ibm ">
        <div className=" w-full flex flex-wrap bg-white rounded-[16px] p-[24px]  ">

          <div className='w-full flex flex-nowrap'>
                <div className="flex  w-full items-center flex-wrap grow">
                  <div className="flex  w-fit">
                    <Image
                      className=""
                      alt="mootech-icon"
                      src={'/images/mumate/ic_calendar.svg'}
                      width={16}
                      height={16}
                    />
                </div>

                <span className=' pl-4 text-[14px] text-[#444444]'>{formatDateAndTime(create_at)}</span>
              </div>

              <div className={
                ( point < 0 ? ' text-[#D22C69] ' : ' text-moumate_blue ') + 
                " flex  w-fit items-center flex-none"
                }>
                  <span className='w-fit text-[14px] '>{ point > 0 ? '+' : '-' }</span>
                  <span className='w-[90px] pl-4 text-[14px] '>{Math.abs(point)} Points</span>
              </div>
          </div>

          <div className='w-full flex flex-wrap'>

                <span className='  mt-4 text-[16px]  text-black font-bold'>{description}</span>
          </div>
          


          
        </div>
      </div>
  )
}

export default ActivityCard
