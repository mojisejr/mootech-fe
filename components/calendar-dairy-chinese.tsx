import { useEffect, useState } from 'react'
import Image from 'next/image'
import { formatDateAndTime } from '@/utils/formate-date-thai'
import { ChineseCalendarGetDairyAPI } from '@/constants/api/api-chinese-calendar-get-dairy'
import BoxInfo from './box-info'


type ComponentProps = {
  userId: string,
  initDay: number,
  initMonth: number
  initYear: number,
  onChangeDate: any
  gotoPayment: any,

}

const CalendarChineseDairyCard = ({
  userId,
  initDay,
  initMonth,
  initYear,
  onChangeDate,
  gotoPayment
} : ComponentProps) => {


  const today = new Date()
  const [day, setDay] = useState<number>(initDay)
  // const [month, setMonth] = useState<number>(today.getMonth() + 1) // 0-11 → 1-12
  const [month, setMonth] = useState<number>(initMonth) 
  const [year, setYear] = useState<number>(initYear)
  const [calendarInfo, setCalendarInfo] = useState<any>(null)

  const [isAllow, setIsAllow] = useState<boolean>(false)


  

const callApiCalendar = async (day: number, month: number, year: number) => {
  const result = await ChineseCalendarGetDairyAPI(userId, day, month, year);
  if (result) {
    setIsAllow(result.is_allow)
    setCalendarInfo(result)
  }
}

useEffect(() => {

    if (userId) {
  
      callApiCalendar(initDay, initMonth, initYear)

    }
}, [initDay, initMonth, initYear, userId])


    const getResultAnalyticColors = (info: any) => {
    if (info && info.colors && info.colors.length > 0) {
      const resultHoroscope = info.colors
      const colorElement:any[] = []
    if (resultHoroscope) {
      const colors = resultHoroscope

      

      for (let j = 0; j < colors.length; j++) {
          colorElement.push( 
          
                <div className='w-full flex flex-wrap items-center'>
                <div 
                    style={{ backgroundColor: `${colors[j].hex}` }}
                className={"w-[24px] h-[24px] bg-[" + (colors[j].hex).toUpperCase()+ "] rounded-full"}></div>
                <span className={'pl-2 text-[12px] text-moumate_gray'}>   {colors[j].name}</span>
              </div>

          )
        

      

        
      }
    
      return colorElement
      }
    }
   
    return []
  }

  const setFromDate = (d: Date) => {
    setDay(d.getDate())
    setMonth(d.getMonth() + 1)
    setYear(d.getFullYear())
    onChangeDate(d.getDate(), d.getMonth() + 1, d.getFullYear())
  }

  const nextDay = () => {
    const d = new Date(year, month - 1, day) // month ใน Date คือ 0-11
    d.setDate(d.getDate() + 1)
    setFromDate(d)
  }

  const prevDay = () => {
    const d = new Date(year, month - 1, day)
    d.setDate(d.getDate() - 1)
    setFromDate(d)


  }
const getDayOfWeekInt = (
  day: number,
  month: number,
  year: number
): string => {
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat("th-TH", {
    weekday: "long",
  }).format(date);
};

const geyMonthYear = (month: number, year: number) => {
  const THAI_MONTHS = [
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
];


  return `${THAI_MONTHS[month - 1]} ${year}`;

}

const getTime = (info: any) => {
  if (info && info.result && info.result.chinese_time_ranges) {
    const list: any[] = []
    const times = JSON.parse(info.result.chinese_time_ranges)
    for (let i = 0; i < times.length; i++) {
      list.push( <span className='w-full text-[14px]'>{times[i]} น.</span>)
    }

    return list;

  }

  return null
}

  return (
    <div className='w-full flex flex-wrap'>

                 <div className="w-full flex-wrap">


              <div className='w-full flex flex-wrap'>
  

                <div className='w-full flex flex-wrap bg-[#F2F7FD] pt-[40px] pb-[60px] px-[24px]'>

                  <div className='w-full flex flex-wrap justify-center'>
                    <span className='text-black font-bold text-[16px]'> {getDayOfWeekInt(day, month, year)}</span>
                  </div>


                  <div className='w-full flex flex-nowrap justify-center'>

                    <div className='w-fit justify-center flex flex-none'>
                          <div className='w-fit flex'>
                              <Image
                                  src={'/images/mumate/ic_date_prev.svg'}
                                  width={40}
                                  height={40}
                                  className=' cursor-pointer'
                                  onClick={() => { prevDay() }}
                                  alt="icon-result"/>
                          </div>
                    </div>

                    <span className='w-[320px] flex justify-center text-[#1455A4] font-semibold text-[75px]'>{day}</span>


                    <div className='w-fit justify-center flex flex-none'>
                          <div className='w-fit flex'>
                              <Image
                                  src={'/images/mumate/ic_date_next.svg'}
                                  width={40}
                                  height={40}
                                  className=' cursor-pointer'
                                  onClick={() => { nextDay() }}
                                  alt="icon-result"/>
                          </div>
                    </div>
                  </div>
{/* 
                   <div className='w-full  grid grid-cols-2 gap-4 justify-center mt-6'>

                    <div className='w-full  border-[#1B9AAF] border-[2px] justify-center rounded-[50px] py-[8px] px-[12px]'>
                      <span className=' font-bold text-[#1B9AAF] w-full flex justify-center '>ปฏิทินแบบทั่วไป</span>
                    </div>


                    <div className='w-full  border-[#1B9AAF] border-[2px] justify-center rounded-[50px] py-[8px] px-[12px]'>
                      <span className=' font-bold text-[#1B9AAF] w-full flex justify-center '>ปลดล็อคปฎิทินมงคล</span>
                    </div>


                   </div> */}

                    {/* วันพระ */}
                   <div className={
                        " w-full flex flex-wrap p-[24px] " +
                        "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
                      }>
                            <div className='w-full flex flex-nowrap items-center'>
                              <div className='w-fit flex-none'>
                                  <Image
                                    className=""
                                    alt="mootech-box"
                                    src={'/images/mumate/ic_box_7.svg'}
                                    width={32}
                                    height={32}
                                  />
                              </div>
                              <div className='w-full grow pl-[8px]'>
                                <span className='  text-moumate_blue text-[16px] font-bold'>{'วันพระ'}</span>
                              </div>
                            </div>
                       
                        <div className='w-full flex flex-wrap  gap-4 mt-4'>

                        {
                          calendarInfo && calendarInfo.result && calendarInfo.result.is_chinese_buddhist_day == true ?

                            <div className='w-[80px] flex-none'>
                              <div className='w-full flex justify-center'>
                                <Image
                                  className=""
                                  alt="mootech-box"
                                  src={'/images/mumate/img_ch_day.png'}
                                  width={80}
                                  height={120}
                                />
                              </div>
                              <span className=' text-[14px] w-full flex justify-center mt-2'>วันพระจีน</span>
                          </div>
                          :
                          null
                        }

                        {
                          calendarInfo && calendarInfo.result && calendarInfo.result.is_thai_buddhist_day == true ?

                            <div className='w-[80px] flex-none'>
                              <div className='w-full flex justify-center'>
                                <Image
                                  className=""
                                  alt="mootech-box"
                                  src={'/images/mumate/img_th_day.png'}
                                  width={80}
                                  height={120}
                                />
                              </div>
                              <span className=' text-[14px] w-full flex justify-center mt-2'>วันพระไทย</span>
                          </div>
                          :
                          null
                        }
                        </div>
                   </div>
                   

                   <div className='w-full flex flex-wrap relative'>

                    {/* CONTENT */}
                    <div className='w-full flex flex-wrap'>
                        {/* เวลามงคล */}
                        <div 
                        className={
                            " w-full flex flex-wrap p-[24px] " +
                            "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
                          }>
                                            <div className='w-full flex flex-nowrap items-center'>
                                <div className='w-fit flex-none'>
                                    <Image
                                      className=""
                                      alt="mootech-box"
                                      src={'/images/mumate/ic_box_clock.svg'}
                                      width={32}
                                      height={32}
                                    />
                                </div>
                                <div className='w-full grow pl-[8px]'>
                                  <span className='  text-moumate_blue text-[16px] font-bold'>{'เวลามงคล'}</span>
                                </div>
                              </div>
                              <div className='w-full grid grid-cols-2  gap-4 mt-4'>

                                {
                                  getTime(calendarInfo)
                                }

                              
                              </div>
                        </div>


                        <div className="w-full flex flex-wrap mt-5">
                          <BoxInfo 
                            icon={'/images/mumate/ic_box_6.svg'} 
                            topic={'สีมงคล'} 
                            type='COLOR'
                            note={''}
                            colors={getResultAnalyticColors(calendarInfo)} 
                          />
                        </div>

                        {/* เทพประจำวัน */}
                        <div className={
                              " w-full flex flex-wrap p-[24px] " +
                              "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
                            }>
                              <div className='w-full flex flex-nowrap items-center'>
                                <div className='w-fit flex-none'>
                                    <Image
                                      className=""
                                      alt="mootech-box"
                                      src={'/images/mumate/ic_box_7.svg'}
                                      width={32}
                                      height={32}
                                    />
                                </div>
                                <div className='w-full grow pl-[8px]'>
                                  <span className='  text-moumate_blue text-[16px] font-bold'>{'เทพประจำวัน'}</span>
                                </div>
                              </div>
                              {
                                calendarInfo && calendarInfo.scared_thing ?

                                  <div className='w-full flex flex-wrap  gap-4 mt-4'>
                                      <div className='w-[80px] flex-none'>
                                        <div className='w-full flex justify-center'>
                                          <Image
                                            className=" rounded-md "
                                            alt="mootech-box"
                                            src={calendarInfo.scared_thing.url}
                                            width={80}
                                            height={120}
                                          />
                                        </div>
                                        <span className=' text-[14px] w-full flex justify-center text-center  mt-2'>{calendarInfo.scared_thing.name}</span>
                                    </div>
                                  </div>
                                  :
                                  null
                              }
                        </div>



                        {/* ทิศโลคลาภ */}
                        <div 
                        className={
                            " w-full flex flex-wrap p-[24px] " +
                            "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
                          }>
                                            <div className='w-full flex flex-nowrap items-center'>
                                <div className='w-fit flex-none'>
                                    <Image
                                      className=""
                                      alt="mootech-box"
                                      src={'/images/mumate/ic_box_compass.svg'}
                                      width={32}
                                      height={32}
                                    />
                                </div>
                                <div className='w-full grow pl-[8px]'>
                                  <span className='  text-moumate_blue text-[16px] font-bold'>{'ทิศโชคลาภ'}</span>
                                </div>
                              </div>
                              <div className='w-full flex flex-wrap   mt-4'>

                                <span className='w-full text-[14px]'>{ calendarInfo && calendarInfo.direction_good ? calendarInfo.direction_good.description : null  }</span>

                              </div>
                        </div>



                        {/* ทิศอสูรวัน */}
                        <div 
                        className={
                            " w-full flex flex-wrap p-[24px] " +
                            "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom mt-6"
                          }>
                                            <div className='w-full flex flex-nowrap items-center'>
                                <div className='w-fit flex-none'>
                                    <Image
                                      className=""
                                      alt="mootech-box"
                                      src={'/images/mumate/ic_box_compass.svg'}
                                      width={32}
                                      height={32}
                                    />
                                </div>
                                <div className='w-full grow pl-[8px]'>
                                  <span className='  text-moumate_blue text-[16px] font-bold'>{'ทิศอสูรวัน'}</span>
                                </div>
                              </div>
                              <div className='w-full flex flex-wrap   mt-4'>

                                <span className='w-full text-[14px]'>{ calendarInfo && calendarInfo.direction_bad ? calendarInfo.direction_bad.description : null  }</span>

                              </div>
                        </div>
                    </div>

                    {
                        isAllow == false && (
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



              </div>



            </div>

    </div>
        
  )
}

export default CalendarChineseDairyCard
