import { useEffect, useState } from 'react'
import Image from "next/image";

import dynamic from 'next/dynamic';
import { CompatibilityWorkCheck } from '@/constants/api/api-check-compatibility-work';
import { CompatibilityLoveCheck } from '@/constants/api/api-check-compatibility-love';
import GraphLifeV2 from './graph-life-v2';
import { ChineseElement } from '@/constants/chinese-element';

const GraphLife = dynamic(() => import('./graph-life'), {
  ssr: false,
});


type ComponentProps = {
  user_id?: any,
  icon: any,
  topic: any,
  note: any,
  current?: any,
  max?: any,
  type?: string
  colors?: any[]
  elements?: any
  scared_things?: any[]
  lifes?: any[];
  onActionMore?: any,
  onClickSurvey?: any,
  onActionToCalculate?: any,
}

const BoxInfo = ({ 
  user_id,
  icon,
  topic,
  note,
  type = '',
  colors,
  current = '0',
  max = '0',
  scared_things,
  lifes,
  onActionMore,
  onClickSurvey,
  onActionToCalculate,
  elements
}: ComponentProps) => {
 

  const onClickActionButton = () => {
    if (onActionMore) {
      onActionMore()
    }
  }

  const onClickActionCalculateWorkButton = async () => {
    // if (onActionToCalculate) {
    //   const result = await CompatibilityWorkCheck(user_id)
    //   if (result && result.status == 200) {
    //     onActionToCalculate(true)
    //   } else {
    //     onActionToCalculate(false)
    //   }
    // }
       onActionToCalculate(true)
  }

  
  const onClickActionCalculateLoveButton = async () => {
    // if (onActionToCalculate) {
    //   const result = await CompatibilityLoveCheck(user_id)
    //   if (result && result.status == 200) {
    //     onActionToCalculate(true)
    //   } else {
    //     onActionToCalculate(false)
    //   }
    // }
     onActionToCalculate(true)
  }



  const onClickActionSurvey = () => {
    if (onClickSurvey) {
      onClickSurvey()
    }
  }


  const generateBoxUi = (type: string) => {

    if (type == 'JOB') {
      return getBoxUiJob()
    } else if (type == 'COLOR') {
      return getBoxUiColor()
    } else if (type == 'SCARED_THING') {
      return getBoxUiScaredThing()
    } else if (type == 'LOVE') {
      return getBoxUiLove()
    } else if (type == 'WORK') {
      return getBoxUiWork()
    } else if (type == 'GRAPH') {
      return getBoxUiGraph()
    } else if (type == 'ELEMENT') {
      return getBoxUiElement()
    }



    return getBoxUi()
  }

  const getBoxUi = () => {
    return (
        <span className=' text-[14px] text-black font-ibm'>
          {note}
        </span>
    )
  }

  const getBoxUiGraph = () => {
    return (
        <div className=' w-full flex flex-wrap'>
          <div className='w-full flex flex-wrap my-4 gap-3'>
            <span 
            className='px-4 cursor-pointer flex items-center py-2 text-moumate_white font-medium bg-moumate_blue rounded-[24px]'>ทั้งหมด</span>
            <span 
            onClick={onClickActionButton}
            className='px-4 cursor-pointer flex items-center py-2 text-moumate_blue font-medium border-2 border-moumate_blue rounded-[24px]'>ราย 5 ปี</span>
            <span 
            onClick={onClickActionButton}
            className='px-4 cursor-pointer flex items-center  py-2 text-moumate_blue font-medium border-2 border-moumate_blue rounded-[24px]'>ราย 1 ปี</span>
            <span 
            onClick={onClickActionButton}
            className='px-4 cursor-pointer flex items-center  py-2 text-moumate_blue font-medium border-2 border-moumate_blue rounded-[24px]'>ราย 1 เดือน</span>
          </div>

          <GraphLifeV2 
            data={lifes}
          />

          <div className='w-full flex flex-wrap mt-4'>
            <ul className='w-full list-disc text-moumate_gray'>
              {
                lifes?.map(function(item, index){
                  if (item.ageEnd < 100) {

                    return  (
                        <li key={item.ageStart} className=' text-black mt-2 '><span className=' text-black  font-semibold'>ช่วงอายุ {item.ageStart} - {item.ageEnd}</span> : <br/>{item.note}</li>
                    )
                  } else {
                    return null
                  }
                  
                })
              }
            
            </ul>
          </div>
        </div>
    )
  }

  const getBoxUiColor = () => {
    return (
       <div className='w-full grid grid-cols-3 gap-3'>

          {
            colors?.map(function(item, index){
              return (item)
            })
          }


        </div>
    )
  }



  const getDisplayElement = (element: string) => {

    let name = '';
    if (element == 'WOOD') {
      name = ChineseElement.WOOD
    } else if (element == 'WATER') {
      name = ChineseElement.WATER
    } else if (element == 'EARTH') {
      name = ChineseElement.EARTH
    } else if (element == 'FIRE') {
      name = ChineseElement.FIRE
    } else if (element == 'METAL') {
      name = ChineseElement.METAL
    }

    let icon = '';
    if (element == 'WOOD') {
      icon = '/images/mumate/ic_elelment_wood.png'
    } else if (element == 'WATER') {
      icon = '/images/mumate/ic_elelment_water.png'
    } else if (element == 'EARTH') {
      icon = '/images/mumate/ic_elelment_earth.png'
    } else if (element == 'FIRE') {
      icon = '/images/mumate/ic_elelment_fire.png'
    } else if (element == 'METAL') {
      icon = '/images/mumate/ic_elelment_metal.png'
    }


    if (name != '' && icon != '') {
      return (
        <div className='flex w-fit flex-wrap'>

          <div className='w-fit flex flex-wrap'>
            <Image
              src={icon}
              width={20}
              height={20}
              alt='element'/>
          </div>

          <div className='w-[80px] justify-start flex flex-wrap ml-4'>
            <span className='text-black'>ธาตุ{name}</span>
          </div>

        </div>
      )
    }

    return null

  }

  const getBoxUiElement = () => {
    if (!elements) {
      return null
    }

    const topics = [

      { topic: 'เพื่อน/พี่น้อง/หุ้นส่วน', element: elements.element_friend}, 
      { topic: 'เรียน/ทำงาน/ลงทุน', element: elements.element_work}, 
      { topic: 'หน้าที่การงาน', element: elements.element_career}, 
      { topic: 'โชคลาภ', element: elements.element_fortune}, 
      { topic: 'คู่ครอง', element: elements.element_spouse}, 
      { topic: 'ผู้สนับสนุน/ส่งเสริม', element: elements.element_supporter},   
    ]

    return (
       <div className='w-full grid  grid-cols-1 lg:grid-cols-2 gap-3'>

          {
            topics.map(function(item, index){
              return (


                <div
                  key={index}
                  className=' flex flex-nowrap py-1'
                >
                  <span className='grow flex w-full'>{item.topic}</span>
                  <div className='flex flex-wrap flex-none w-fit'>

                    { getDisplayElement(item.element)}
                  
                  </div>

                </div>
              )
            })
          }

        </div>
    )
  }

  

  const getBoxUiJob = () => {
    return (
      <div className=' w-full flex flex-wrap   '>

                  <div className=' w-full flex flex-wrap'>

                      <span className=' text-[14px] text-black font-ibm'>
                        {note}
                      </span>

                      <div
                      className='w-full flex flex-wrap bg-moumate_blue p-[16px] rounded-[16px] mt-4'
                      >


                        <span className=" text-white w-full text-[15px] font-medium font-ibm">
                          ทำแบบทดสอบหาจุดแข็ง
                        </span>

                        <span className=" text-white w-full   text-[14px] font-normal">
                          ทุกคนมีจุดเเข็งเเละจุดอ่อนในตัว ทำแบบทดสอบเพื่อหาสิ่งที่เหมาะกับคุณ
ไม่ว่าเรื่องประเภทงาน หรืองานที่ทำอยู่
                        </span>

                      <div 
                      onClick={onClickActionSurvey}
                      className="w-full mt-4 cursor-pointer flex flex-nowrap justify-center border border-white py-[12px] px-[24px] rounded-[16px] items-center ">

                        <span className="mr-2 text-white w-full grow font-medium">
                          ทดสอบเลย
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

                  </div>
              </div>
    )
  }

  const getBoxUiScaredThing = () => {
    return (
       <div className='w-full flex  overflow-y-auto   gap-4'>

          {
            scared_things ?
            scared_things.map(function(item, index){
              return (item)
            })
            :
            null
          }
        

        </div>
    )
  }

  const getBoxUiLove = () => {
    return (
      <div className=' w-full flex flex-wrap   '>

                  <div className=' w-full flex flex-wrap'>

                      <span className=' text-[14px] text-black font-ibm'>
                        {note}
                      </span>

                      <div
                      className='w-full flex flex-wrap bg-moumate_blue p-[16px] rounded-[16px] mt-4'
                      >


                        <span className=" text-white w-full text-[15px] font-medium font-ibm">
                          มาเช็คเคมีรักกัน (Love Mate)
                        </span>

                        <span className=" text-white w-full   text-[14px] font-normal">
อยากรู้ไหมว่าคุณกับเขาเข้ากันได้ กี่เปอร์เซ็นต์?
                        </span>

                      <div 
                      onClick={onClickActionCalculateLoveButton}
                      className="w-full mt-4 cursor-pointer flex flex-nowrap justify-center border border-white py-[12px] px-[24px] rounded-[16px] items-center ">

                        <span className="mr-2 text-white w-full grow font-medium">
                          เช็คเลย
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

                  </div>
              </div>
    )
  }


    const getBoxUiWork = () => {
    return (
      <div className=' w-full flex flex-wrap   '>

                  <div className=' w-full flex flex-wrap'>

                      <span className=' text-[14px] text-black font-ibm'>
                        {note}
                      </span>

                      <div
                      className='w-full flex flex-wrap bg-moumate_blue p-[16px] rounded-[16px] mt-4'
                      >


                        <span className=" text-white w-full text-[15px] font-medium font-ibm">
                      มาเช็คดวงการทำงานกัน (Work Vibe)
                        </span>

                        <span className=" text-white w-full   text-[14px] font-normal">
เช็คดวงการทำงานกับคนในออฟฟิศ รู้ไว้จัดการได้ ทำงานกับใครง่าย ใครยาก ใครต้องระวัง
                        </span>

                      <div 
                      onClick={onClickActionCalculateWorkButton}
                      className="w-full  cursor-pointer mt-4 flex flex-nowrap justify-center border border-white py-[12px] px-[24px] rounded-[16px] items-center ">

                        <span className="mr-2 text-white w-full grow font-medium">
                          เช็คเลย
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

                  </div>
              </div>
    )
  }
  return (
      <div className={
        " w-full flex flex-wrap p-[24px] " +
        "rounded-[16px] border border-[rgba(255,255,255,0)] backdrop-blur-sm bg-white/45  shadow-custom"
      }>
        <div className='w-full  flex-wrap'>
          <div className='w-full flex flex-nowrap items-center'>
            <div className='w-fit flex-none'>
                <Image
                  className=""
                  alt="mootech-box"
                  src={icon}
                  width={32}
                  height={32}
                />
            </div>
            <div className='w-full grow pl-[8px]'>
              <span className='  text-moumate_blue text-[16px] font-bold'>{topic}</span>
            </div>
          </div>
          <div className='w-full flex flex-nowrap items-center mt-[12px]'>

            {
              generateBoxUi(type)
            }
          </div>
        </div>
       
      </div>
  )
}

export default BoxInfo
