import { useEffect, useState } from 'react'
import Image from 'next/image'
type ComponentProps = {
  left_label: string
  left_value: number
  right_label: string
  right_value: number,
  data: any,
  type: string,
  isShowToolTip: boolean,
  onClickToolTip: any,
  description: string
}

const HologramScale = ({ 
  left_label,
  left_value,
  right_label,
  right_value,
  data,
  type,
  isShowToolTip,
  onClickToolTip,
  description
}: ComponentProps) => {
 

  const getDisplayLeft = (type: string) => {
    const percentage = getPercentage(type)
    return Math.round(percentage);;
    // return Math.round(percentage * 100) / 100;;
  }

  const getDisplayRight = (type: string) => {
    const percentage = getDisplayLeft(type)
    return 100  - percentage
  }

  const getPercentage = (type: string) => {

    if (data) {

      if (type == 'knowledge') {
        const info = data.knowledge
        if (!info) return 0
        const result = info.result
        if (!result) return 0
        const score = result.score

        if (!score) return 0
        return parseFloat(score) *  100
      } else if (type == 'friendly') {
        const info = data.friendly
        if (!info) return 0
        const score = info.score
        if (!score) return 0
        return parseFloat(score) *  100
      } else if (type == 'customer') {
        const info = data.customer
        if (!info) return 0
        const result = info.result
        if (!result) return 0
        const score = result.score
        if (!score) return 0
        return parseFloat(score) *  100
      } else if (type == 'education') {
        const info = data.education
        if (!info) return 0
        const result = info.result
        if (!result) return 0
        const score = result.score
        if (!score) return 0
        return parseFloat(score) *  100
      } else if (type == 'finance') {
        const info = data.finance
        if (!info) return 0
        const score = info.score
        if (!score) return 0
        return parseFloat(score) *  100
      } 

    }

    return 0
  }


  return (
      <div className=" w-full flex flex-wrap ">
        <div className=" w-full flex flex-wrap mb-2 ">
          <div className="w-1/2 flex flex-wrap items-center">
  
            <span className="w-fit font-poppins text-[14px] text-moumate_blue ">
            {left_label}
            </span>

              <div className="flex ml-2  w-fit">
                <div className=' relative w-full '>
                  <div className='w-fit flex flex-wrap'>
                    <Image
                      className=" cursor-pointer "
                      alt="mootech-icon"
                      src={'/images/mumate/Info.svg'}
                      width={16}
                      height={16}
                      onClick={onClickToolTip}
                    />
                  </div>
                  {
                    isShowToolTip ?
                      <div className='w-[200px] lg:w-[335px] z-50 absolute bottom-0 left-0 rounded-lg p-4 bg-white shadow-sm  ml-0 lg:ml-4  mb-[20px] flex flex-wrap'>
                        <span className="w-full font-poppins text-[14px] font-bold text-moumate_blue ">
                          {left_label}
                        </span>
                        <span className="w-full font-poppins text-[14px] text-black ">
                          {description}
                        </span>
                        
                      </div>
                    :
                    null

                  }

                </div>
            </div>
          </div>
          {/* <div className="w-1/2 flex flex-wrap">
            <span className="w-full text-right font-poppins font-bold text-[14px] text-moumate_blue_dark">
              {getDisplayRight(type)}%
            </span>
            <span className="w-full text-right font-poppins text-[14px] text-moumate_blue_dark">
            {right_label}
            </span>
          </div> */}
        </div>

        <div className='w-full h-[8px] bg-gray-200 rounded overflow-hidden'>
  <div
    className="h-full transition-all duration-500"
    style={{
      width: `${getPercentage(type)}%`,
      background: 'linear-gradient(90deg, #1AB1C0 0%, #FBD9E2 51.44%, #4B96E5 100%)'
    }}
  ></div>
        </div>
      </div>
  )
}

export default HologramScale
