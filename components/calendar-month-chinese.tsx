import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatDateAndTime } from '@/utils/formate-date-thai'
import { ChineseCalendarGetDairyAPI } from '@/constants/api/api-chinese-calendar-get-dairy'
import BoxInfo from './box-info'
import { ChineseCalendarGetMonthAPI } from '@/constants/api/api-chinese-calendar-get-month'
import CalendarChineseCard from './calendar-chinese'


type ComponentProps = {
  userId: string,
  initMonth: number
  initYear: number,
  onChangeDate: any

}

const CalendarChineseMonthCard = ({
  userId,
  initMonth,
  initYear,
  onChangeDate
} : ComponentProps) => {


  const today = new Date()
  const [month, setMonth] = useState<number>(initMonth) 
  const [year, setYear] = useState<number>(initYear)
  const [calendarInfo, setCalendarInfo] = useState<any>(null)

  
  

  const onChangeDateMonth = (day: number, month: number, year: number) => {
    
    setMonth(month)
    setYear(year)

    onChangeDate(1, month, year)
  }



  return (
    <div className='w-full flex flex-wrap'>

                 <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
  
       
                <div className='w-full flex flex-wrap bg-[#F2F7FD] pt-6 pb-[60px] px-[24px]'>

               

                   {/* CALENDAR */}
                   <div className='w-full flex flex-wrap '>
                   <CalendarChineseCard userId={userId} initMonth={month} initYear={year} onChangeDate={onChangeDateMonth} />
                   </div>




                </div>



              </div>



            </div>

    </div>
        
  )
}

export default CalendarChineseMonthCard
