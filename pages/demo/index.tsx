
import { ChineseHoroscopeCalculate } from "@/constants/api/api-chinese-horoscope";
import Image from "next/image";
import { useState } from "react";

export default function Home() {


  const [isShowTimeBOD, setIsShowTimeBOD] = useState<boolean>(false);

  const [name, setName] = useState<string>('');
  const [hour, setHour] = useState<string>('');
  const [minute, setMinute] = useState<string>('');

  const [date, setDate] = useState<string>(new Date().getDate()+'');
  const [month, setMonth] = useState<string>(new Date().getMonth()+'');
  const [year, setYear] = useState<string>(new Date().getFullYear()+'');

  const [gender, setGender] = useState<string>('');

  const [resultHoroscope, setResultHoroscope] = useState<any>(null);

  const getDayList = () => {
    const maxDate = 31
    const result = Array.from({ length: maxDate }, (_, i) => i + 1);
    return result; 
  } 

  const getMonthList = () => {
    const result = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม',
      'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน',
      'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',   
    ]
    return result; 
  } 

  const getYearList = () => {
    const currentYear = new Date().getFullYear();
    const result = Array.from({ length: 101 }, (_, i) => currentYear - i);
    return result; 
  } 

  const getHoursList = () => {
    const maxDate = 24
    const result = Array.from({ length: maxDate }, (_, i) => i );
    return result; 
  } 


  const getMinuteList = () => {
    const maxDate = 60
    const result = Array.from({ length: maxDate }, (_, i) => i);
    return result; 
  } 


  const onChangeName = (e: any) => {
    setName(e.target.value)
  }

  const onChangeGender = (e: any) => {
    setGender(e.target.value)
  }
  

  const onChangeTimeDOB = (e: any) => {
    setIsShowTimeBOD(!isShowTimeBOD) 
    if (!e.target.checked) {
      setHour('')
      setMinute('')
    }

  }

  const onChangeDate = (e: any) => {
    setDate(e.target.value)
  }

  const onChangeMonth = (e: any) => {
    setMonth(e.target.value)
  }

  const onChangeYear = (e: any) => {
    setYear(e.target.value)
  }

  const onChangeHour = (e: any) => {
    setHour(e.target.value)
  }

  const onChangeMinute = (e: any) => {
    setMinute(e.target.value)
  }


  const isValid = () => {

    if (name == '') {
      return false
    }

    if (date == '') {
      return false
    }


    if (month == '') {
      return false
    }


    if (year == '') {
      return false
    }



    if (isShowTimeBOD ) {

      if (hour == '') {
        return false
      }


      if (minute == '') {
        return false
      }
    }

    return true;

  }


  const submit = async () =>{
    setResultHoroscope(null)
    const dob = `${year}-${((parseInt(month) + 1) < 10 ? `0${(parseInt(month) + 1)}` : `${(parseInt(month) + 1)}`)}-${(parseInt(date) < 10 ? `0${date}` : `${date}`)}`
    let time = ''
    if (isShowTimeBOD) {
      let min  = minute
      let hr  = hour
      if (min == '') {
        min = '00'
      } else {
        min = parseInt(minute) < 10 ? `0${minute}` : minute 
      }
      if (hr == '') {
        hr = '00'
      } else {
        hr = parseInt(hour) < 10 ? `0${hour}` : hour 
      }
      time = `${hr}:${min}`
    }

    // const result = await ChineseHoroscopeCalculate('', name, dob, time, gender, '')
    // if (result && result.summary) {
    //   setResultHoroscope(result);
    // }
  }

  const getDisplayName = (data: any) => {
    if (data) {
      return `${data.power} ${data.element} ` 
    }

    return ''
  }


  const getDisplayNameBelow = (data: any) => {
    if (data) {
      return `${data.power} ${data.element} ${data.constellation} ` 
    }

    return ''
  }

  const getDisplayGender = (data: any) => {
    if (data && data.gender) {
      if (data.gender == 'MALE') {
        return 'ชาย'
      } else if (data.gender == 'FEMALE') {
        return 'หญิง'
      }
    }
    return '-'
  }

  const getDisplayDOB = (data: any) => {
    let result = ''
    if (data && data.dobThai) {
      result +=  data.dobThai
    }
    if (data && data.time && data.time != '') {
      result +=  ' เวลาเกิด ' + data.time + ' น.'
    }

    if (result.length > 0) {
      return result;
    }

    return '-'
  }

  const getDisplayResult = (data: any, is_above: boolean) => {

    if(data && data != '') {
      return is_above ? data.above :  data.below
    }
    
    return ''
  }

  const getDisplayResultSubDescription = (data: any) => {

    if(data && data.belowHiddenZodiac != '') {
      return data.belowHiddenZodiac
    }
    
    return ''
  }


  const getDisplayResultBackground = (data: any) => {

    if(data && data != '') {
      if (data.element == 'WOOD') {
        return ' bg-emerald-500 '
      } else if (data.element == 'WATER') {
        return ' bg-sky-400 '
      } else if (data.element == 'EARTH') {
        return ' bg-yellow-300 '
      } else if (data.element == 'FIRE') {
        return ' bg-rose-400 '
      } else if (data.element == 'METAL') {
        return ' bg-white '
      }
    }
    
    return ' bg-gray-50 '
  }


  const getDisplayResultCycle = (raws: any, is_above: boolean) => {

    const result = []
    const display = []
    if (raws) {
      if (raws.length <= 0) {
        return [];
      }
      for (let i = 0; i < 18; i++) {
        result.push(raws[i])
      }

      for (let i = result.length - 1; i >= 0; i--) {
        if (is_above == true) {
          if (i%2 == 0) {
            display.push(result[i]);
          }
        } else {
          if (i%2 == 1) {
            display.push(result[i]);
          }
        }
      }
      

    }
    return display
  }

  const getInitBirthdayCH = (cycleLife: any, ageChinese: any, index: number) => {
    if (index == 8) {
      return `${cycleLife?.birthdayYear}.${parseInt(cycleLife?.birthdayMonth)/10}`
    } else {
      return `${ageChinese}`
    }
    return ''

  }

  const getResultPower = () => {
     const result: any[] = []

    if (resultHoroscope) {
      const power = resultHoroscope.power
      if (power) {
        const customer = power.customer
        if (customer && customer.result && customer.result.score) {
          result.push(<div className="w-full flex flex-wrap">
            <span className="w-1/2 flex font-bold flex-wrap">ค่าพลัง ลูกค้า</span>
            <span className="w-1/2 flex flex-wrap">{customer.result.score * 100} %</span>
          </div>)
        }

        const education = power.education
        if (education && education.result && education.result.score) {
          result.push(<div className="w-full flex flex-wrap">
            <span className="w-1/2 flex font-bold flex-wrap">ค่าพลัง การศึกษา</span>
            <span className="w-1/2 flex flex-wrap">{education.result.score * 100} %</span>
          </div>)
        }


        const finance = power.finance
        if (finance &&  finance.score) {
          result.push(<div className="w-full flex flex-wrap">
            <span className="w-1/2 flex font-bold flex-wrap">ค่าพลัง การเงิน</span>
            <span className="w-1/2 flex flex-wrap">{finance.score * 100} %</span>
          </div>)
        }


        const friendly = power.friendly
        if (friendly &&  friendly.score) {
          result.push(<div className="w-full flex flex-wrap">
            <span className="w-1/2 flex font-bold flex-wrap">ค่าพลัง เพื่อน</span>
            <span className="w-1/2 flex flex-wrap">{friendly.score * 100} %</span>
          </div>)
        }

        const knowledge = power.knowledge
        if (knowledge &&  knowledge.result && knowledge.result.score) {
          result.push(<div className="w-full flex flex-wrap">
            <span className="w-1/2 flex font-bold flex-wrap">ค่าพลัง ความเข้าใจ</span>
            <span className="w-1/2 flex flex-wrap">{knowledge.result.score * 100} %</span>
          </div>)
        }
      }

      return result;
    }

    return '-'

  }

  const getResultAnalyticBase = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.base
        if (data) {
          return data.description
        }
      }
    }

    return '-'
  }

    const getResultAnalyticBeCareful = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.be_careful
        if (data) {
          return data.description
        }
      }
    }

    return '-'
  }

  


  const getResultAnalyticStrong = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.elemental_characteristics
        const data2 = analytic.habit
        if (data && data2) {
          return <div className="w-full flex flex-wrap">
            <span className="w-full flex font-bold flex-wrap">{data.remark}</span>
            <span className="w-full flex flex-wrap">{data2.note}</span>
          </div>
        }
      }
    }

    return '-'
  }

  const getResultAnalyticHabit = () => {
    const result: any[] = []
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

      if (analytic) {
        const raw = analytic.behaviors
        if (raw) {
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            result.push( <div className="w-full flex flex-wrap mb-2">
              <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
              <span className="w-full flex flex-wrap">{data.behavior}</span>
            </div>
            )
          }
        }
      }
    }

    return result
  }

  
  const getResultAnalyticOccupations = () => {
    const result: any[] = []
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

      if (analytic) {
        const raw = analytic.occupations
        if (raw) {
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            result.push( <div className="w-full flex flex-wrap mb-2">
              <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
              <span className="w-full flex flex-wrap">{data.occupation}</span>
            </div>
            )
          }
        }
      }
    }

    return result
  }

  const getResultAnalyticColors = () => {
    const result: any[] = []
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

      if (analytic) {
        const raw = analytic.lucky_colors 
        if (raw) {
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            const colors = data.colors

            // 
            const colorElement:any[] = []

            for (let j = 0; j < colors.length; j++) {
              colorElement.push( 
                <div className=" w-fit flex flex-wrap items-center">
                  <div className={"w-[20px] h-[20px] rounded-full flex flex-wrap   bg-[" + (colors[j].hex).toLowerCase()+ "] mr-4   "}>
                  </div>

                  {colors[j].name}
                </div>
              )
            }

            result.push( <div className="w-full flex flex-wrap mb-2">
              <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
              <div className="w-full  flex-wrap grid">
                {colorElement}
              </div>
            </div>
            )
          }
        }
      }
    }

    return result
  }
    const getResultAnalyticSacredThings = () => {
    const result: any[] = []
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic

       if (analytic) {
        const raw = analytic.sacred_things 
        if (raw) {
          for (let i = 0; i < raw.length; i++) {
            const data = raw[i]
            const sacred_things = data.sacred_things

            // 
            const sacredThingslement:any[] = []

            for (let j = 0; j < sacred_things.length; j++) {
              sacredThingslement.push( 
                <div className=" w-fit flex flex-wrap items-center">
                         <Image
                                  className=""
                                  alt="mootech-badge"
                                  src={sacred_things[j].url}
                                  width={100}
                                  height={200}
                                />

                  {sacred_things[j].name}
                </div>
              )
            }

            result.push( <div className="w-full flex flex-wrap mb-2">
              <span className="w-full flex text-sm font-bold flex-wrap">{data.element}</span>
              <div className="w-full  flex-wrap grid">
                {sacredThingslement}
              </div>
            </div>
            )
          }
        }
      }
    }

    return result
  }
  
    const getResultAnalyticLove = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.love
        if (data) {
          return <div className="w-full flex flex-wrap">
            <span className="w-full flex flex-wrap">{data.note}</span>
          </div>
        }
      }
    }

    return '-'
  }

    const getResultAnalyticLife = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.analytic
      if (analytic) {
        const data = analytic.life
        const lifelement:any[] = []
        if (data) {
          for (let n = 0; n < data.length; n++) {
            lifelement.push(<div className="w-full flex flex-wrap">
              <span className="w-1/4 flex flex-wrap">{data[n].ageStart} - {data[n].ageEnd}</span>
              <span className="w-1/4 flex flex-wrap">คะแนน {data[n].score}</span>
              <span className="w-2/4 flex flex-wrap">{data[n].note}</span>
            </div>
            )
          }
        }

        return lifelement
      }
    }

    return '-'
  }


  


  return (
    <div
    className='w-full bg-white min-h-screen h-fit font-prompt'
    >
      <div 
      className="w-full flex justify-center py-6">
        <div 
        className='w-full md:w-[480px] flex flex-wrap px-4 md:px-0'>

          <span className="w-full flex justify-center font-bold text-xl">คำนวณดวงจีน (24/06/2025)</span>

          <div 
          className="w-full flex flex-wrap mt-4">
            <span>ชื่อ นามสกุล</span>
            <div
            className="w-full flex flex-wrap">

              <input 
              className="w-full border border-gray-300 rounded-lg p-3"
              onChange={ (e) => {  onChangeName(e) }}
              value={name}
              />

            </div>
          </div>

          <div 
          className="w-full flex flex-wrap mt-4">
            <span>เพศ</span>
            <div
            className="w-full flex flex-wrap">

                <select 
                className="w-full border border-gray-300 rounded-lg py-3"
                onChange={ (e) => {  onChangeGender(e) }}
                defaultValue={''}
                value={gender}
                >
                  <option key={1} value={''}>ไม่ระบุ</option>
                  <option key={2} value={'MALE'}>เพศชาย</option>
                  <option key={3} value={'FEMALE'}>เพศหญิง</option>
                  
                </select>

            </div>
          </div>

          <div 
          className="w-full flex flex-wrap mt-4">
            <span className="w-full">วันเกิด</span>

            <div
            className="w-full gap-1 grid  grid-cols-3 ">
              <div
              className="w-full flex flex-wrap">

                <select 
                className="w-full border border-gray-300 rounded-lg px-3 max-h-[200px]"
                onChange={ (e) => {  onChangeDate(e) }}
                defaultValue={''}
                value={date}
                >
                  {
                    getDayList().map(function(item, index){
                      return <option key={index} value={item}>{item}</option>
                    })
                  }
                  
                </select>

              </div>
              <div
              className="w-full flex flex-wrap">

                <select 
                className="w-full border border-gray-300 rounded-lg p-3"
                onChange={ (e) => {  onChangeMonth(e) }}
                value={month}
                defaultValue={''}
                >
                   {
                    getMonthList().map(function(item, index){
                      return <option key={index} value={index}>{item}</option>
                    })
                  }
                                   
                </select>

              </div>
              <div
              className="w-full flex flex-wrap">

                <select 
                className="w-full border border-gray-300 rounded-lg p-3"
                onChange={ (e) => {  onChangeYear(e) }}
                value={year}
                defaultValue={''}
                >
                  {
                    getYearList().map(function(item, index){
                      return <option key={index} value={item}>{item} {' (พ.ศ.' + (item + 543) + ')'}</option>
                    })
                  }
                  
                </select>

              </div>
            </div>
            
            
          </div>

          <div 
          className="w-full flex flex-wrap mt-4">
            <div
            className="w-full flex flex-wrap">

              <input 
              className="w-fit border border-gray-300 rounded-lg p-3"
              type='checkbox'
              onChange={ (e) => {  onChangeTimeDOB(e) }}
              checked={isShowTimeBOD}
              />
              <span className="ml-3">ทราบเวลาเกิด</span>

            </div>
          </div>

          <div 
          className={ (isShowTimeBOD ? '' : ' hidden ' )+ "w-full flex flex-wrap mt-4"}>
            <span className="w-full">เวลาเกิด</span>

            <div
            className="w-full gap-1 grid  grid-cols-3 ">
              <div
              className="w-full flex flex-wrap">

                <select 
                className="w-full border border-gray-300 rounded-lg p-3"
                onChange={ (e) => {  onChangeHour(e) }}
                value={hour}
                >
                  
                  {
                    getHoursList().map(function(item: any, index){
                      return <option key={index} value={item}>{item < 10 ? `0${item}` : item}</option>
                    })
                  }
                  
                </select>

              </div>
              <div
              className="w-full flex flex-wrap">

                <select 
                className="w-full border border-gray-300 rounded-lg p-3"
                onChange={ (e) => {  onChangeMinute(e) }}
                value={minute}
                >
                  
                  {
                    getMinuteList().map(function(item: any, index){
                      return <option key={index} value={item}>{item < 10? `0${item}` : item}</option>
                    })
                  }
                  
                </select>

              </div>
            </div>
            
            
          </div>      


          <div 
          className="w-full flex flex-wrap mt-4">    

              <button
              onClick={submit}
              className={( isValid() ? ' bg-green-600 ' : ' bg-gray-300 ') + "w-full bg-green-600 py-3 px-4 rounded-md text-white"}
              
              >คำนวณ</button>

          </div>
          
          <div 
          className={ (resultHoroscope ? ' flex ' : ' hidden ' ) + "w-full  flex-wrap"}>
            <span className="w-full flex justify-center font-bold text-xl mt-4">ผลลัพธ์</span>

            <div className=" w-full flex flex-wrap mt-4">

              <span className="text-lg font-medium w-full">เพศ : { getDisplayGender(resultHoroscope) }</span>
              <span className="text-lg font-medium w-full">วันเกิด : { getDisplayDOB(resultHoroscope) }</span>

            </div>
            
            {/* ตาราง 8 ช่อง */}
            <div className=" grid w-full grid-cols-5 mt-4">
              <div className="w-full border-r border-b flex flex-wrap bg-gray-400 border-white">
                <span className="text-xs font-bold w-full flex justify-center">ลัคนา</span>
              </div>
              <div className="w-full border-r border-b flex flex-wrap bg-gray-400 border-white ">
                <span className="text-xs font-bold w-full flex justify-center">ยาม</span>
              </div>
              <div className="w-full border-r border-b  bg-gray-400 border-white">
                <span className="text-xs font-bold w-full flex justify-center">วัน</span>
            
              </div>
              <div className="w-full  border-r border-b  bg-gray-400 border-white">
                <span className="text-xs font-bold w-full flex justify-center">เดือน</span>
              
              </div>
              <div className="w-full  border-r border-b  bg-gray-400 border-white">
                <span className="text-xs font-bold w-full flex justify-center">ปี</span>
  
              </div>

              {/* ROW ABOVE */}

              <div className={"w-full px-4 py-6 border-r border-b flex flex-wrap border-white" + getDisplayResultBackground(resultHoroscope?.summary?.ascendant) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.ascendant, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.ascendantAbove) : ''}</span>
              </div>

              <div className={"w-full px-4 py-6 border-r border-b flex flex-wrap border-white" + getDisplayResultBackground(resultHoroscope?.summary?.time) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.time, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.timeAbove) : ''}</span>
              </div>
              <div className={"w-full px-4 py-6 border-r border-b  border-white" + getDisplayResultBackground(resultHoroscope?.summary?.day) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.day, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.dayAbove) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6 border-r border-b border-white" + getDisplayResultBackground(resultHoroscope?.summary?.month) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.month, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.monthAbove) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6  border-b border-white" + getDisplayResultBackground(resultHoroscope?.summary?.year) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.year, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.yearAbove) : ''}</span>

              </div>

              {/* ROW BELOW */}
              <div className={"w-full px-4 py-6 border-r  border-white" + getDisplayResultBackground(resultHoroscope?.summary?.ascendant) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.ascendant, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.ascendant)}</span>
                <span className="text-xs  w-full flex mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.ascendantBelow) : ''}</span>
              </div>
              <div className={"w-full px-4 py-6 border-r  border-white" + getDisplayResultBackground(resultHoroscope?.summary?.time) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.time, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.time)}</span>
                <span className="text-xs  w-full flex  mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.timeBelow) : ''}</span>
              </div>
              <div className={"w-full px-4 py-6 border-r  border-white" + getDisplayResultBackground(resultHoroscope?.summary?.day) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.day, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.day)}</span>
                <span className="text-xs  w-full flex   mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.dayBelow) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6 border-r  border-white" + getDisplayResultBackground(resultHoroscope?.summary?.month) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.month, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.month)}</span>
                <span className="text-xs  w-full flex   mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.monthBelow) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6   border-white" + getDisplayResultBackground(resultHoroscope?.summary?.year) }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.year, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.year)}</span>
                <span className="text-xs  w-full flex   mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.yearBelow) : ''}</span>

              </div>

            </div>

            <span className="w-full flex justify-center font-bold text-2xl mt-6">วัยจร</span>
            <span className="w-full flex justify-center font-bold text-xl mt-2">อายุ(จีน) {resultHoroscope?.cycleLife?.age}</span>
            <div className="w-full flex flex-wrap mt-4">


            <div className=" w-full flex flex-wrap">
              <div className={ " w-[100px] border-r  border-l  border-gray-400 flex flex-wrap bg-white "}>
                <span className=" w-full text-2xl p-2  border-b bg-gray-400 border-gray-400 flex justify-center">ปีจร</span>
                  <span className=" w-full text-2xl p-2  border-b  border-gray-400 flex justify-center">{resultHoroscope?.yearOfZodiac?.above}</span>
                  <span className=" w-full text-2xl p-2  border-b  border-gray-400 flex justify-center ">{resultHoroscope?.yearOfZodiac?.below}</span>
                </div>
        

                <div className={ " w-[100px] ml-4 border-r  border-l  border-gray-400 flex flex-wrap bg-white "}>
                  <span className=" w-full text-2xl p-2  border-b bg-gray-400 border-gray-400 flex justify-center">วัยจร</span>
                  <span className=" w-full text-2xl p-2  border-b  border-gray-400 flex justify-center">{resultHoroscope?.cycleLife?.ageZodiac}</span>
                </div>
              </div>
            </div>
   
            <div className=" grid w-full grid-cols-9 mt-2">
           
                  {
                    getDisplayResultCycle(resultHoroscope?.cycleLife?.life, true).map(function(item: any, index: number){
                      return (
                        <div className={ (index == 0 ? ' border-l ' : '' ) +  (item?.isAge ? ' bg-red-300 ' : '' ) + " w-full border-r border-b flex flex-wrap  border-gray-400"}>
                          <span className=" w-full text-xs p-2  flex justify-center bg-gray-400">{  getInitBirthdayCH(resultHoroscope?.cycleLife, item?.ageChinese, index) }</span>
                          <span className=" w-full text-lg flex py-4 font-medium justify-center ">{item?.id}</span>
                        </div>
                      )
                    })
                  }
             


            </div>
            <div className=" grid w-full grid-cols-9 ">
           
                {
                  getDisplayResultCycle(resultHoroscope?.cycleLife?.life, false).map(function(item: any, index: number){
                    return (
                      <div className={ (index == 0 ? ' border-l ' : '' ) +  ( item?.isAge ? ' bg-red-300 ' : '' ) + " w-full border-r border-b flex flex-wrap  border-gray-400"}>
                        <span className=" w-full text-lg flex font-medium py-4 justify-center">{item?.id}</span>
                        <span className=" w-full text-xs p-2 flex justify-center bg-gray-400">{item?.ageChinese}</span>
                      </div>
                    )
                  })
                }
            


            </div>


            <span className="w-full flex justify-center font-bold text-2xl mt-6">วิเคราะห์</span>


            <span className="w-full flex justify-center font-bold text-xl mt-2">ค่าพลัง</span>
            <span className="w-full flex flex-wrap justify-center  text-lg mt-2">{ getResultPower() }</span>



            <span className="w-full flex justify-center font-bold text-xl mt-2">พื้นฐาน</span>
            <span className="w-full flex justify-center  text-lg mt-2">{ getResultAnalyticBase() }</span>


            
            <span className="w-full flex justify-center font-bold text-xl mt-4">พึงระวัง</span>
            <span className="w-full flex justify-center  text-lg mt-2">{ getResultAnalyticBeCareful() }</span>


            
            <span className="w-full flex justify-center font-bold text-xl mt-4">ธาตุแข็ง / อ่อน</span>
            <span className="w-full flex justify-center  text-lg mt-2">{ getResultAnalyticStrong() }</span>

            <span className="w-full flex justify-center font-bold text-xl mt-4">นิสัย พฤติกรรม</span>
            <div className="w-full flex flex-wrap justify-center  text-lg mt-2">
                {
                  getResultAnalyticHabit().map(function(item, index) {
                    return item
                  })
                }

            </div>

            <span className="w-full flex justify-center font-bold text-xl mt-4">อาชีพ</span>
            <div className="w-full flex flex-wrap justify-center  text-lg mt-2">
                {
                  getResultAnalyticOccupations().map(function(item, index) {
                    return item
                  })
                }

            </div>


            <span className="w-full flex justify-center font-bold text-xl mt-4">สีมงคล</span>
            <div className="w-full flex flex-wrap justify-center  text-lg mt-2">
                {
                  getResultAnalyticColors().map(function(item, index) {
                    return item
                  })
                }

            </div>



            <span className="w-full flex justify-center font-bold text-xl mt-4">สิ่งศักดิ์สิทธิ์</span>
            <div className="w-full flex flex-wrap justify-center  text-lg mt-2">
                {
                  getResultAnalyticSacredThings().map(function(item, index) {
                    return item
                  })
                }

            </div>



            <span className="w-full flex justify-center font-bold text-xl mt-4">ความรัก</span>
            <span className="w-full flex justify-center  text-lg mt-2">{ getResultAnalyticLove() }</span>




            <span className="w-full flex justify-center font-bold text-xl mt-4">กราฟชีวิต</span>
            <span className="w-full flex justify-center  flex-wrap text-lg mt-2">{ getResultAnalyticLife() }</span>




          </div>

        </div>


      </div>      
    </div>
  );
}
