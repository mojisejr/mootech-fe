import { useEffect, useRef, useState } from 'react'
import Image from "next/image";


type ComponentProps = {
  user_id?: any,
  icon: any,
  topic: any,
  startDOB: string,
  cycleLife: any,
  years: any[],
  resultHoroscope: any,
  is_show: boolean,
  selectedAge: any,
}

const BoxYearInfo = ({ 
  user_id,
  icon,
  topic,
  cycleLife,
  startDOB,
  years,
  resultHoroscope,
  is_show,
  selectedAge
}: ComponentProps) => {

const [yearStart, setYearStart] = useState<number>(0)
const [targetIndex, setTargetIndex] = useState<number>(0)

const itemRefs = useRef<(any)[]>([]);

useEffect(() => {
  if (!is_show) return;

  const timer = setTimeout(() => {
    const el = itemRefs.current[targetIndex];

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, 100);

  return () => clearTimeout(timer);
}, [is_show, years, targetIndex]);

useEffect(() => {
  if (!is_show) return;
  if (selectedAge === null || selectedAge === undefined) return;

  const index = 100 - Number(selectedAge);
  setTargetIndex(index);

  const timer = setTimeout(() => {
    const el = itemRefs.current[index];

    if (el) {
      el.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, 100);

  return () => clearTimeout(timer);
}, [selectedAge, is_show]);


useEffect( () => {

  if (startDOB) {
    const arrayStartDOB = startDOB.split('-')
    if (arrayStartDOB.length == 3) {
      setYearStart(parseInt(arrayStartDOB[0]))
      targetIndex
    }
  }

  if (cycleLife) {
    const age = cycleLife.age;
    setTargetIndex(100 - parseInt(resultHoroscope.cycleLife.age) )
  }

}, [startDOB, cycleLife])

    const getDisplayColor = (data: any) => {



    if(data && data != '' && data.element && data.element) {
      if (data.element == 'WOOD') {
        return ' text-[#388659] '
      } else if (data.element == 'WATER') {
        return ' text-[#1455A4] '
      } else if (data.element == 'EARTH') {
        return ' text-[#F19953] '
      } else if (data.element == 'FIRE') {
        return ' text-[#CB2C2A] '
      } else if (data.element == 'METAL') {
        return ' text-[#5A5A5A] '
      }
    }
    
    return ' text-black '
  }
 

  const getDisplayColorBG = (element: any) => {


    if(element) {
      if (element == 'WOOD') {
        return ' bg-[#388659] '
      } else if (element == 'WATER') {
        return ' bg-[#1455A4] '
      } else if (element == 'EARTH') {
        return ' bg-[#F19953] '
      } else if (element == 'FIRE') {
        return ' bg-[#CB2C2A] '
      } else if (element == 'METAL') {
        return ' bg-white '
      }
    }
    
    return ' bg-white '
  }

    
  return (
      <div className={
        " w-full flex flex-wrap " +
        ""
      }>
        <div className='w-full  flex-wrap'>
  
          <div 
          
          className='w-full flex  overflow-x-auto items-center mt-[12px]'>

            {
              [...years].reverse().map(function(item, index) {
                return (
                  <div
                  key={item.year}
                  ref={(el: any) => (itemRefs.current[index] = el)}

                  className={'min-w-[70px] flex flex-wrap'}>
                    <div className={
                      (index == 0 ? ' border-l rounded-tl  ' : '' ) +  
                      (index == 99 ? ' border-r rounded-tr  ' : '' ) +  
                      'w-full  border-border_gray border-t  border-b border-r  justify-center flex flex-wrap'}
                      
                      
                           style={
                            targetIndex == index
                              ? {
                                  background: 'linear-gradient(180deg, #D4F8F9 0%, #FFFFFF 100%)'
                                }
                              : {}
                          }
                      
                      >
                      <span className='w-full text-xs p-2  flex justify-center text-center bg-bg_gray'>{parseInt(resultHoroscope.dob.split("-")[0]) + item.year} ({parseInt(resultHoroscope.dob.split("-")[0]) + item.year + 543 - 1})</span>

                      <span className={
                        getDisplayColor({element: item.yearAbove.element}) + 

                        " w-full text-lg flex py-4 font-medium justify-center "}>{item?.yearAbove.chinese_symbol}</span>
                    </div>
                    <div className={
                      (index == 0 ? ' border-l rounded-bl  ' : '' ) +  
                      (index == 99 ? ' border-r rounded-br  ' : '' ) +  
                      'w-full  border-border_gray border-b   border-r  justify-center flex flex-wrap'}
                      
                      
                           style={
                            targetIndex == index
                              ? {
                                  background: 'linear-gradient(180deg, #D4F8F9 0%, #FFFFFF 100%)'
                                }
                              : {}
                          }
                      
                      >
                      <span className={
                        getDisplayColor({element: item.yearBelow.element}) + 

                        " w-full text-lg flex py-4 font-medium justify-center "}>{item?.yearBelow.chinese_symbol}</span>
                      <span className='w-full text-xs p-2  flex justify-center bg-bg_gray'>{item.year}</span>

                    </div>
                  </div>
                )
              })
            }

            
          </div>
        </div>
       
      </div>
  )
}

export default BoxYearInfo
