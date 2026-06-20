import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatDateAndTime } from '@/utils/formate-date-thai'
import { ChineseCalendarGetMonthAPI } from '@/constants/api/api-chinese-calendar-get-month'
import { useRouter } from 'next/router'
import { PageRouter } from '@/constants/router'

type ComponentProps = {
  userId: string,
  initMonth: number
  initYear: number,
  onChangeDate: any

}
type CalendarExtra = {
  month?: number
  year?: number
  is_thai_buddhist_day?: boolean
  is_chinese_buddhist_day?: boolean
  is_doctor_day?: boolean
  is_good_day?: boolean
  is_thian_chai?: boolean
}

type GridItem = {
  date: string
  day: string
} & CalendarExtra

const CalendarChineseCard = ({
  userId,
  initMonth,
  initYear,
  onChangeDate
} : ComponentProps) => {

  const router = useRouter();

const [listCalendars, setListCalendars] = useState<GridItem[]>(
  Array.from({ length: 35 }, () => ({ date: "", day: "" }))
)

  const today = new Date()
  const [month, setMonth] = useState<number>(initMonth) 
  const [year, setYear] = useState<number>(initYear)
  const [calendarInfo, setCalendarInfo] = useState<any>(null)


  const [isAllow, setIsAllow] = useState<boolean>(false)
  // Don't show the lock overlay until the membership check has returned,
  // otherwise members see a false "locked" flash before is_allow resolves.
  const [allowChecked, setAllowChecked] = useState<boolean>(false)
  // Loading indicator while the calendar data is being fetched.
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const gotoPayment = () => {
    router.replace(PageRouter.PACKAGE_PRICE)
  }


useEffect(() => {
  if (!calendarInfo?.calendars) return


   const newArray=  mergeCalendarWithGrid(calendarInfo.calendars, listCalendars)

    setListCalendars(newArray)
  
}, [calendarInfo])
  
  function mergeCalendarWithGrid(
  calendars: any[],
  grid: any[]
) {
 
  const calendarMap = new Map(
    calendars.map(c => [Number(c.day), c])
  )

  return grid.map(item => {
    if (!item.day) return item

    const calendarData = calendarMap.get(Number(item.day))
    if (!calendarData) return item

    return {
      ...item,
      ...calendarData // merge ลงไป
    }
  })
}

const callApiCalendar = async (month: number, year: number) => {
  setIsLoading(true)
  try {
    const result = await ChineseCalendarGetMonthAPI(userId, month, year);
    if (result) {
      setIsAllow(result.is_allow)
      setCalendarInfo(result)
      setAllowChecked(true)
    }
  } finally {
    setIsLoading(false)
  }
}

useEffect(() => {
      if (userId) {
  callApiCalendar(initMonth, initYear)
      }
}, [initMonth, initYear, userId])

 

  useEffect(() => {

    const firstIndex = getFirstDay(month, year)
    const total = getTotalDay(month, year)

    const arr: any[] = initArray(firstIndex, total, month, year)

    setListCalendars(arr)

  }, [month, year])


const getFirstDay = (month: number, year: number) => {
  const date = new Date(year, month - 1, 1)
  return date.getDay()
}

  const getTotalDay = (month: number, year: number) => {
    return new Date(year, month, 0).getDate()
  }

const initArray = (
  start_index: number,
  total: number,
  month: number,   // 1-12
  year: number
) => {
  const length = 35

  return Array.from({ length }, (_, index) => {
    const isInRange =
      index >= start_index && index < start_index + total

    if (!isInRange) {
      return { date: "" }
    }

    const day = index - start_index + 1

    const formattedMonth = String(month).padStart(2, "0")
    const formattedDay = String(day).padStart(2, "0")

    return {
      date: `${year}-${formattedMonth}-${formattedDay}`,
      day: `${day}`,
    }
  })
}

  const getWeek = (indexWeek: number) => {
    const start = (indexWeek - 1) * 7
    const end = start + 7

    return listCalendars.slice(start, end)

  } 
const nextMonth = () => {
  let newMonth = month
  let newYear = year

  if (month === 12) {
    newMonth = 1
    newYear = year + 1
  } else {
    newMonth = month + 1
  }

  setMonth(newMonth)
  setYear(newYear)

  onChangeDate(1, newMonth, newYear)
}

const prevMonth = () => {
  let newMonth = month
  let newYear = year

  if (month === 1) {
    newMonth = 12
    newYear = year - 1
  } else {
    newMonth = month - 1
  }

  setMonth(newMonth)
  setYear(newYear)
  onChangeDate(1, newMonth, newYear)
}
const getThaiMonthDisplay = (month: number, year: number) => {
  const thaiMonths = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ]

  const buddhistYear = year + 543

  return `${thaiMonths[month - 1]} ${buddhistYear}`
}


const getStateDay = (item: any) => {
  if (item.date == '') {
    return null
  }

  if (item.is_good_day == true) {
      return (
        <span className=' flex justify-center items-center font-bold text-white text-[12px] w-[26px] h-[26px] bg-[#FCA8BA] border-[#FF8DA4] rounded-full'>{(item.day)}</span>
      )
  }

  if (item.is_doctor_day == true) {
      return (
        <span className=' flex justify-center items-center font-bold text-white text-[12px] w-[26px] h-[26px] bg-[#94CFAF] border-[#72C598] rounded-full'>{(item.day)}</span>
      )
  }

  if (item.is_thian_chai == true) {
      return (
        <span className=' flex justify-center items-center font-bold text-white text-[12px] w-[26px] h-[26px] bg-[#C0E1FF] border-[#A4CCF0] rounded-full'>{(item.day)}</span>
      )
  }


  return (
    <span className=' flex justify-center items-center  text-black text-[12px] w-[26px] h-[26px]  rounded-full'>{item.day}</span>
  )
}



const getStateDayBackground = (item: any) => {
  if (item.date == '') {
    return null
  }
  if (item.is_thai_buddhist_day == true || item.is_chinese_buddhist_day  == true ) {
    return ' bg-[#FFF7D2] border border-[#FFEABA] '
  }

}

const getStateDayBuddhistDay = (item: any) => {
  if (item.date == '') {
    return null
  }

  if (item.is_thai_buddhist_day == true || item.is_chinese_buddhist_day  == true ) {
    return (
      <div className='w-full flex flex-wrap justify-center gap-1'>
        {
            item.is_chinese_buddhist_day == true ?

                     <Image
                        alt="mootech-icon"
                        src={'/images/mumate/ic_calendar_ch.svg'}
                        width={12}
                        height={16}
                      />
                      :
                      null
        }
        
           {
            item.is_thai_buddhist_day == true ?     
        <Image
                        alt="mootech-icon"
                        src={'/images/mumate/ic_calendar_th.svg'}
                        width={12}
                        height={16}
                      />
                      :
                      null
           }
                  </div>

    )
  }

  return null

}

  return (
    <div
      className=' w-full flex  flex-wrap'
    >
      <div className={
        " w-full flex flex-wrap " +
        "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom px-[12px] py-[16px] "
      }>

          <div className='w-full flex flex-wrap justify-center'>
            <div className='w-[327px] gap-[2px] flex flex-nowrap justify-center'>

              <div className='w-fit grow flex'>
                <Image
                  alt="mootech-icon"
                  src={'/images/mumate/ic_arrow_back_black.svg'}
                  onClick={() => { prevMonth() }}
                  className=' cursor-pointer '
                  width={16}
                  height={16}
                />
              </div>
              <span className='w-full flex justify-center grow text-[#1B9AAF] font-medium text-[16px]'>{getThaiMonthDisplay(month, year)}</span>
              <div className='w-fit  grow flex'>
                <Image
                  alt="mootech-icon"
                  onClick={() => { nextMonth() }}
                  className=' cursor-pointer '
                  src={'/images/mumate/ic_arrow_next_black.svg'}
                  width={16}
                  height={16}
                />
              </div>

            </div>
            <div className='w-[327px] gap-[2px] flex flex-wrap justify-center mt-4'>
              {
                ['อา','จ','อ','พ','พฤ','ศ','ส'].map(function(item, index){
                  return (
                    <div className='w-[45px]  h-[45px] flex flex-wrap px-[2px] py-[4px]'>
                      <div className='w-full flex justify-center'>
                        <span className=' flex justify-center items-center  text-black font-bold text-[14px] w-[26px] h-[26px] '>{item}</span>
                      </div>
                    
                    </div>
                  )
                })
              }
              </div>
            <div className='w-[327px] gap-[2px] flex flex-wrap justify-center'>
              {
                getWeek(1).map(function(item, index){
                  return (
                    <div className={(getStateDayBackground(item)) + ' w-[45px]   rounded-[5px] h-[60px] flex flex-wrap px-[2px] py-[4px]'}>
                      <div className='w-full flex justify-center'>
                        {getStateDay(item)}
                      </div>
                      {getStateDayBuddhistDay(item)}
                    
                    </div>
                  )
                })
              }
              </div>
              <div className='w-[327px] gap-[2px] flex flex-wrap justify-center mt-2'>
              {
                getWeek(2).map(function(item, index){
                  return (
                    <div className={(getStateDayBackground(item)) + ' w-[45px]   rounded-[5px] h-[60px] flex flex-wrap px-[2px] py-[4px]'}>
                      <div className='w-full flex justify-center'>
                        {getStateDay(item)}
                      </div>
                      {getStateDayBuddhistDay(item)}
                    
                    </div>
                  )
                })
              }   
              </div>  
              <div className='w-[327px] gap-[2px] flex flex-wrap justify-center mt-2'>
              {
                getWeek(3).map(function(item, index){
                  return (
                    <div className={(getStateDayBackground(item)) + ' w-[45px]   rounded-[5px] h-[60px] flex flex-wrap px-[2px] py-[4px]'}>
                      <div className='w-full flex justify-center'>
                        {getStateDay(item)}
                      </div>

                      {getStateDayBuddhistDay(item)}
                    
                    </div>
                  )
                })
              }      
              </div>  
              <div className='w-[327px] gap-[2px] flex flex-wrap justify-center mt-2'>
              {
                getWeek(4).map(function(item, index){
                  return (
                    <div className={(getStateDayBackground(item)) + ' w-[45px]   rounded-[5px] h-[60px] flex flex-wrap px-[2px] py-[4px]'}>
                      <div className='w-full flex justify-center'>
                        {getStateDay(item)}
                      </div>
                      {getStateDayBuddhistDay(item)}
                    
                    </div>
                  )
                })
              }  
              </div>  
              <div className='w-[327px] gap-[2px] flex flex-wrap justify-center mt-2'>
              {
                getWeek(5).map(function(item, index){
                  return (
                    <div className={(getStateDayBackground(item)) + ' w-[45px]   rounded-[5px] h-[60px] flex flex-wrap px-[2px] py-[4px]'}>
                      <div className='w-full flex justify-center'>
                        {getStateDay(item)}
                      </div>
                      {getStateDayBuddhistDay(item)}
                    
                    </div>
                  )
                })
              }   
              </div>  
          </div>

      </div>

      <div className='w-full flex flex-wrap relative'>

          <div className='w-full flex flex-wrap'>
            {/* วันพระ */}
            <div 
            className={
                " w-full flex flex-wrap p-[24px] " +
                "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
              }>
                  <div className='w-full flex flex-nowrap items-center'>
          
                    <div className='w-full grow pl-[8px]'>
                      <span className='  text-moumate_blue text-[16px] font-bold'>{'วันพระไทย'}</span>
                    </div>
                  </div>
                  <div className='w-full flex flex-wrap  gap-2  mt-2'>
                      {
                        calendarInfo?.groups?.is_thai_buddhist_day.map(function(item: any, index: any) {
                          return (
                            <span className=' border border-[#FFEABA]  bg-[#FFF7D2] text-black rounded-full text-[16px] w-[36px] h-[36px] flex items-center justify-center '>{item}</span>
                          )
                        })
                      }
                  </div>


                  <div className='w-full flex flex-nowrap items-center mt-6'>
          
                    <div className='w-full grow pl-[8px]'>
                      <span className='  text-moumate_blue text-[16px] font-bold'>{'วันพระจีน'}</span>
                    </div>
                  </div>
                  <div className='w-full flex flex-wrap  gap-2  mt-2'>
                      {
                        calendarInfo?.groups?.is_chinese_buddhist_day.map(function(item: any, index: any) {
                          return (
                            <span className=' border border-[#FFE0AF]  bg-[#FFECCE] text-black rounded-full text-[16px] w-[36px] h-[36px] flex items-center justify-center '>{item}</span>
                          )
                        })
                      }
                  </div>
            </div>
          

            {/* วันหมอเทพ */}
            <div 
            className={
                " w-full flex flex-wrap p-[24px] " +
                "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
              }>
                  <div className='w-full flex flex-nowrap items-center'>
          
                    <div className='w-full grow pl-[8px]'>
                      <span className='  text-moumate_blue text-[16px] font-bold'>{'วันหมอเทพ'}</span>
                    </div>
                  </div>
                  <div className='w-full flex flex-wrap  gap-2  mt-2'>
                      {
                        calendarInfo?.groups?.is_doctor_day.map(function(item: any, index: any) {
                          return (
                            <span className=' border border-[#72C598]  bg-[#94CFAF] text-white rounded-full text-[16px] w-[36px] h-[36px] flex items-center justify-center '>{item}</span>
                          )
                        })
                      }
                  </div>
            </div>


            {/* วันมงคล */}
            <div 
            className={
                " w-full flex flex-wrap p-[24px] " +
                "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
              }>
                  <div className='w-full flex flex-nowrap items-center'>
          
                    <div className='w-full grow pl-[8px]'>
                      <span className='  text-moumate_blue text-[16px] font-bold'>{'วันมงคล'}</span>
                    </div>
                  </div>
                  <div className='w-full flex flex-wrap  gap-2  mt-2'>
                      {
                        calendarInfo?.groups?.is_good_day.map(function(item: any, index: any) {
                          return (
                            <span className=' border border-[#FF8DA4]  bg-[#FCA8BA] text-white rounded-full text-[16px] w-[36px] h-[36px] flex items-center justify-center '>{item}</span>
                          )
                        })
                      }
                  </div>
            </div>


            {/* เทียนไช้ */}
            <div 
            className={
                " w-full flex flex-wrap p-[24px] " +
                "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
              }>
                  <div className='w-full flex flex-nowrap items-center'>
          
                    <div className='w-full grow pl-[8px]'>
                      <span className='  text-moumate_blue text-[16px] font-bold'>{'เทียนไช้'}</span>
                    </div>
                  </div>
                  <div className='w-full flex flex-wrap  gap-2  mt-2'>
                      {
                        calendarInfo?.groups?.is_thian_chai.map(function(item: any, index: any) {
                          return (
                            <span className=' border border-[#A4CCF0]  bg-[#C0E1FF] text-white rounded-full text-[16px] w-[36px] h-[36px] flex items-center justify-center '>{item}</span>
                          )
                        })
                      }
                  </div>
                  <div className='w-full flex flex-wrap  mt-2'>
                      {
                        calendarInfo?.holidays?.map(function(item: any, index: any) {
                          return (
                            <span className=' text-[#888888] text-[12px]  flex w-full '>* {item.day} {item.description}</span>
                          )
                        })
                      }
                  </div>
            </div>
          </div>

                    {
                        isLoading && (
                          <div className="absolute inset-0 z-50 flex items-center justify-center
                                          backdrop-blur-sm bg-white/50 rounded-[16px]">
                            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-moumate_blue" />
                          </div>
                        )
                      }

                    {
                        !isLoading && allowChecked && isAllow == false && (
                          <div className="absolute inset-0 z-50 flex items-center justify-center
                                          backdrop-blur-md bg-white/40 rounded-[16px]">
                            
                            <div className="bg-white shadow-xl rounded-2xl px-8 py-6 text-center">
                              <h3 className="text-lg font-bold text-moumate_blue">
                                ปลดล็อคดวงวันนี้ 🔮
                              </h3>
                              <p className="text-sm text-gray-500 mt-2">
                                สมัครสมาชิกเพื่อดูข้อมูลทั้งหมด
                              </p>

                              <button
                                onClick={ () => { gotoPayment() }}
                                className="mt-4 px-6 py-2 rounded-full
                                          bg-moumate_blue text-white
                                          hover:scale-105 transition-all duration-300"
                              >
                                ปลดล็อค
                              </button>
                            </div>
                          </div>
                        )
                      }

    </div>
 
    </div>
  )
}

export default CalendarChineseCard
