import { useEffect, useState } from 'react'
import Image from "next/image";
import BoxYearInfo from './box-year-info';
type ComponentProps = {
  summary: any,
  data: any
}

const BoxChineseTable = ({ 
  summary,
  data
}: ComponentProps) => {
 
  const [resultHoroscope, setResultHoroscope] = useState<any>(null)

  const [isShow, setIsShow] = useState<boolean>(false)
  const [selectedAge, setSelectedAge] = useState<number | null>(null);

  useEffect(() => {
    if (data) {
       setResultHoroscope(data)
    }
  }, [data])

  const getDisplayDependColor = (info: any, element: string) => {
    const rawElement = { element: element };
    
    if(info && info != '') {
      const symbol  =    info
      return (
        <span className={getDisplayColor(rawElement)}>{symbol}</span>
     
      )
    }
    
    return ''
  }


  const getDisplayResult = (info: any , data: any, is_above: boolean) => {
    if(info && info != '') {
      const symbol  =    is_above ? info.above :  info.below
      return (
        <span className={getDisplayColor(data)}>{symbol}</span>
     
      )
    }
    
    return ''
  }

  const getDisplayResultSubDescription = (data: any) => {

    if(data && data.belowHiddenZodiac != '') {
      return (
        <div className='w-full flex-wrap'>
          <span  className={getDisplayColor(data) + '  w-full flex justify-center ' }></span>
          <span className=' w-full text-center flex justify-center'>{data.belowHiddenZodiac}</span>
        </div>
      )
    }
    
    return ''
  }


  const getDisplayName = (data: any) => {
    if (data) {
      return (
        <div className='w-full flex flex-wrap'>
          <span className='w-full text-center'>{data.power}</span>
          <span className='w-full text-center'>{data.element}</span>
        </div>
      )
    }

    return ''
  }


  const getDisplayNameBelow = (data: any) => {
    if (data) {
      return (
        <div className='w-full flex flex-wrap'>
          <span className='w-full text-center'>{data.power}</span>
          <span className='w-full text-center'>{data.constellation}</span>
        </div>
      )
    }

    return ''
  }

  const getDisplayGender = () => {
    if (data && data.gender) {
      if (data.gender == 'MALE') {
        return 'ชาย'
      } else if (data.gender == 'FEMALE') {
        return 'หญิง'
      }
    }
    return '-'
  }

  const getDisplayBirthDay = () => {
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

  const getDisplayAge = () => {
    if (resultHoroscope) {
        const cycleLife = resultHoroscope.cycleLife
        if (resultHoroscope) {
          const age = cycleLife.age
          if (age) {
            return age
          }
        }
    }
    return '-'
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

  const onShow = () => {
    setIsShow(!isShow)
  }

    const getResultAnalyticYearCycle = () => {
    if (resultHoroscope) {
      const analytic = resultHoroscope.cycleYearLife
      if (analytic) {
        return analytic;
      }
    }

    return []
  }



  return (
          <div className='w-full flex flex-wrap'>
            <div 
            onClick={() => { onShow()}}
            className={
              (isShow ? ' ' : ' rounded-b-[16px]  ') + 
              " cursor-pointer w-full h-fit bg-moumate_blue rounded-t-[16px] py-[16px] pl-[24px] pr-[16px]  flex flex-nowrap mt-[24px] "}>

              <div className="w-full grow ">

                <span className=" text-white font-ibm font-semibold  text-[16px] ">
                  ดูดวงจีนตาราง 8 ช่อง
                </span>

              </div>

              <div className="w-fit flex-none ">

                    <Image
                    src={isShow ? '/images/mumate/chevron-up.svg' : '/images/mumate/chevron-down.svg'}
                    width={24}
                    height={24}
                    alt="icon-result"/>

              </div>

            </div>

            <div className={
              ( isShow ? ' flex ' : ' hidden ') + 
              " w-full  flex-wrap bg-white rounded-b-[16px]  p-[24px]"}>

              <div className='w-full flex flex-wrap'>
                <span className='w-full'>เพศ: {getDisplayGender()}</span>
                <span className='w-full'>วันเกิด: {getDisplayBirthDay()}</span>

              </div>

              <div className='w-full flex flex-wrap'>
            {/* ตาราง 8 ช่อง */}
            <div className=" grid w-full grid-cols-5 mt-4">
              <div className="w-full py-2 border-r border-l border-b border-t flex flex-wrap rounded-tl bg-bg_gray border-border_gray">
                <span className="text-xs  font-ibm font-bold w-full flex justify-center">ลัคนา</span>
              </div>
              <div className="w-full py-2 border-r border-b border-t flex flex-wrap  bg-bg_gray border-border_gray ">
                <span className="text-xs font-ibm font-bold w-full flex justify-center">ยาม</span>
              </div>
              <div className="w-full py-2 border-r border-b  border-t   bg-bg_gray border-border_gray">
                <span className="text-xs  font-ibm font-bold w-full flex justify-center">ดิถี</span>
            
              </div>
              <div className="w-full  py-2 border-r border-b  border-t   bg-bg_gray border-border_gray">
                <span className="text-xs  font-ibm font-bold w-full flex justify-center">เดือน</span>
              
              </div>
              <div className="w-full py-2  border-r border-b   border-t rounded-tr bg-bg_gray border-border_gray">
                <span className="text-xs  font-ibm font-bold w-full flex justify-center">ปี</span>
  
              </div>

              {/* ROW ABOVE */}

              <div className={"w-full px-4 py-6 border-r border-l border-b flex flex-wrap border-border_gray" }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.ascendant, resultHoroscope?.detail?.ascendantAbove, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.ascendantAbove) : ''}</span>
              </div>

              <div className={"w-full px-4 py-6 border-r border-b flex flex-wrap border-border_gray" }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.time, resultHoroscope?.detail?.timeAbove, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail?.timeAbove) : ''}</span>
              </div>
              <div className={"w-full px-4 py-6 border-r border-b  border-border_gray"}>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.day, resultHoroscope?.detail?.dayAbove, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.dayAbove) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6 border-r border-b border-border_gray" }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.month,  resultHoroscope?.detail?.monthAbove, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.monthAbove) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6 border-r border-b border-border_gray"  }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.year, resultHoroscope?.detail?.yearAbove, true)}</span>
                <span className="text-xs  w-full flex justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayName(resultHoroscope.detail.yearAbove) : ''}</span>

              </div>

              {/* ROW BELOW */}
              <div className={"w-full px-4 py-6 border-r   border-l border-b border-border_gray"  }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.ascendant, resultHoroscope?.detail?.ascendantBelow, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.ascendant)}</span>
                <span className="text-xs  w-full flex mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.ascendantBelow) : ''}</span>
              </div>
              <div className={"w-full px-4 py-6 border-r   border-b border-border_gray" }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.time, resultHoroscope?.detail?.timeBelow, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.time)}</span>
                <span className="text-xs  w-full flex  mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.timeBelow) : ''}</span>
              </div>
              <div className={"w-full px-4 py-6 border-r   border-b border-border_gray"  }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.day,resultHoroscope?.detail?.dayBelow,  false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.day)}</span>
                <span className="text-xs  w-full flex   mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.dayBelow) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6 border-r   border-b border-border_gray" }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.month, resultHoroscope?.detail?.monthBelow, false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.month)}</span>
                <span className="text-xs  w-full flex   mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.monthBelow) : ''}</span>

              </div>
              <div className={"w-full px-4 py-6    border-r   border-b border-border_gray" }>
                <span className="text-2xl font-bold w-full flex justify-center">{getDisplayResult(resultHoroscope?.summary?.year, resultHoroscope?.detail?.yearBelow ,false)}</span>
                <span className="text-sm font-bold w-full flex justify-center">{getDisplayResultSubDescription(resultHoroscope?.summary?.year)}</span>
                <span className="text-xs  w-full flex   mt-2 justify-center">{resultHoroscope && resultHoroscope.detail ? getDisplayNameBelow(resultHoroscope.detail.yearBelow) : ''}</span>

              </div>



              { /* นับอิม */}
              <div className={
                getDisplayColorBG(resultHoroscope?.summary?.ascendant?.element) + " " +
                " w-full h-[20px] py-2 flex flex-wrap rounded-bl"}>
                <span className="text-xs  font-ibm font-bold w-full flex justify-center"></span>
              </div>
              <div className={
                 getDisplayColorBG(resultHoroscope?.summary?.time?.element) + " " +
                " w-full h-[20px] py-2  flex flex-wrap "}>
                <span className="text-xs font-ibm font-bold w-full flex justify-center"></span>
              </div>
              <div className={

                 getDisplayColorBG(resultHoroscope?.summary?.day?.element) + " " +
                "w-full h-[20px] py-2 "}>
                <span className="text-xs  font-ibm font-bold w-full flex justify-center"></span>
            
              </div>
              <div className={
                
                 getDisplayColorBG(resultHoroscope?.summary?.month?.element) + " " +
                "w-full  h-[20px] py-2 "}>
                <span className="text-xs  font-ibm font-bold w-full flex justify-center"></span>
              
              </div>
              <div className={
                
              
                 getDisplayColorBG(resultHoroscope?.summary?.year?.element) + " " +
                "w-full  h-[20px] py-2  rounded-br "}>
                <span className="text-xs  font-ibm font-bold w-full flex justify-center"></span>
  
              </div>

              

            </div>
              </div>


              <div className='w-full flex flex-wrap mt-4'>
                <span className='w-full font-semibold font-ibm'>วัยจร</span>
                <span className='w-full'>อายุ (จีน): {getDisplayAge()}</span>
                <span className='w-full  text-sm'>* อายุจีน = อายุไทย + 1</span>

              </div>

            <div className="w-full flex flex-wrap mt-4">


              <div className=" w-full flex flex-wrap">
                <div className={ " w-[100px]  flex flex-wrap bg-white "}>
                    <span className={
                      " text-xs  h-[30px] rounded-t font-ibm font-bold w-full flex justify-center  border-t border-r  border-l   border-border_gray " +
                      " w-full py-2   border-b  bg-bg_gray border-border_gray "
                      }>ปีจร</span>
                    <span className=" w-full text-2xl p-2  border-b border-l border-r  border-border_gray flex justify-center">{getDisplayDependColor(resultHoroscope?.yearOfZodiac?.above, resultHoroscope?.yearOfZodiac?.aboveElement)}</span>
                    <span className=" w-full text-2xl p-2  border-b  border-l border-r  rounded-b border-border_gray flex justify-center ">{getDisplayDependColor(resultHoroscope?.yearOfZodiac?.below, resultHoroscope?.yearOfZodiac?.belowElement)}</span>
                  </div>
          

                  <div className={ " w-[100px]  border-r  border-l border-b rounded-t rounded-b    ml-4   flex flex-wrap bg-white "}>      
                     <span className={
                      " text-xs h-[30px] border-b  rounded-t font-ibm font-bold w-full flex justify-center  border-border_gray " +
                      " w-full py-2  bg-bg_gray border-border_gray "
                      }>วัยจร</span>
                    <span className=" w-full text-2xl p-2  rounded-b  border-border_gray flex justify-center">{getDisplayDependColor(resultHoroscope?.cycleLife?.ageZodiac, resultHoroscope?.cycleLife?.ageElement)}</span>
                  </div>
              </div>
            </div>


              
            <div className=" grid w-full grid-cols-9 mt-4">
           
                  {
                    getDisplayResultCycle(resultHoroscope?.cycleLife?.life, true).map(function(item: any, index: number){
                      return (
                        <div
                        key={item?.ageStart}
                        onClick={() => {
                          setSelectedAge(item?.ageStart);
                        }}
                        className={ 
                          (index == 0 ? ' border-l rounded-tl  ' : '' ) +  
                          (index == 8 ? ' border-r rounded-tr  ' : '' ) +  
                          " cursor-pointer w-full border-t border-b border-r flex flex-wrap  border-border_gray"}
                           style={
                            item?.isAge
                              ? {
                                  background: 'linear-gradient(180deg, #D4F8F9 0%, #FFFFFF 100%)'
                                }
                              : {}
                          }
                          
                          >
                          <span className={ 
                            (index == 0 ? ' ' : '') + " w-full text-xs p-2  flex justify-center bg-bg_gray " 
                          
                            }>{  getInitBirthdayCH(resultHoroscope?.cycleLife, item?.ageStart, index) }</span>
                          <span className={
                            getDisplayColor({element: item?.element}) + 

                            " w-full text-lg flex py-4 font-medium justify-center "}>{item?.id}</span>
                        </div>
                      )
                    })
                  }
             


            </div>
            <div className=" grid w-full grid-cols-9 ">
           
                {
                  getDisplayResultCycle(resultHoroscope?.cycleLife?.life, false).map(function(item: any, index: number){
                    return (
                      <div
                      key={item?.ageStart}
                      onClick={() => {
                        setSelectedAge(item?.ageStart);
                      }}
                      className={ 
                        (index == 0 ? ' border-l rounded-bl ' : '' ) +  
                        (index == 8 ? ' border-r rounded-br ' : '' ) +  
                        ( item?.isAge ? ' bg-[#D4F8F9]  ' : '' ) + 
                        " cursor-pointer w-full border-r border-b border-t flex flex-wrap  border-border_gray"}>
                        <span className={
                          
                            getDisplayColor({element: item?.element}) + 
                          " w-full text-lg flex font-medium py-4 justify-center"}>{item?.id}</span>
                        <span className={
                          " w-full text-xs p-2 flex justify-center bg-bg_gray"}>{item?.ageStart}</span>
                      </div>
                    )
                  })
                }
            


            </div>



              <div className='w-full flex flex-wrap mt-6'>
                <span className='w-full font-semibold font-ibm'>ปีจร</span>
              </div>
              
              <div className=" grid grid-cols-1 w-full gap-5">


                            <div className="w-full flex flex-wrap">
                              <BoxYearInfo 
                                selectedAge={selectedAge}
                                is_show={isShow}
                                icon={'/images/mumate/ic_box_1.svg'}
                                topic={'ปีจร'}
                                cycleLife={resultHoroscope?.cycleLife}
                                startDOB={resultHoroscope?.dob}
                                years={getResultAnalyticYearCycle()}  
                                resultHoroscope={resultHoroscope}                         
                                />
                            </div>


                </div>

            </div>
        </div>
  )
}

export default BoxChineseTable
