import { AI_CODE_RESPONSE, AI_CODE_RESPONSE_MESSAGE } from '@/constants/ai-code-response'
import { AICardAPI } from '@/constants/api/api-ai-card'
import { AIGeneralAPI } from '@/constants/api/api-ai-general'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'

type ComponentProps = {
  user_id: string,
  onClose: any,
}
const ModalAIChatGeneral = ({
  user_id,
  onClose
}: ComponentProps) => {
    function randomString(length = 5) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = ""
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  function getYMD() {
    const d = new Date()
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${y}${m}${day}`
  }


  const [sessionId, setSessionId] = useState<string>(`${user_id}_${getYMD()}_${randomString(5)}`)

  const [historyChat, setHistoryChat] = useState<any[]>([])

  const [chatMessage, setChatMessage] = useState<string>('')

  const [isCallAI, setIsCallAI] = useState<boolean>(false)

  const [categoryChat, setCategoryChat] = useState<string>('')

    const bottomRef = useRef<any>(null)

useEffect(() => {
  if (!isCallAI) return

  const run = async () => {
    const msg = chatMessage;
    setChatMessage('')
    const result: any = await callAPIChat(msg)


    if (result?.code == 200) {
      setHistoryChat(prev => [
        ...prev,
        {
          id: 0,
          message: result.message,
          is_ai: true,
        },
      ])
    } else {
      let message = '....';
      if (result.code === AI_CODE_RESPONSE.EXPIRED) message = AI_CODE_RESPONSE_MESSAGE.EXPIRED
      else if (result.code === AI_CODE_RESPONSE.NO_PLAN) message = AI_CODE_RESPONSE_MESSAGE.NO_PLAN
      else if (result.code === AI_CODE_RESPONSE.OUT_OF_LIMIT) message = AI_CODE_RESPONSE_MESSAGE.OUT_OF_LIMIT

        setHistoryChat(prev => [
        ...prev,
        {
          id: 0,
          message: message,
          is_ai: true,
        },
      ])
    }

    setIsCallAI(false)
  }

  run()
}, [isCallAI])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [historyChat])

  // useEffect( () => {

  //   if (start_message) {
  //     const prev = []
  //       prev.push({
  //         id: 0,
  //         message: start_message,
  //         is_ai: true,
  //       })
  //     setHistoryChat(prev)
  //   } 

  // }, [start_message])


  const onChangeChatMessage = (value: string) => {
    setChatMessage(value)
  }

  const onSubmitChat = async () => {
    if (chatMessage != '') {
        const prev = [...historyChat]
        prev.push({
          id: 0,
          message: chatMessage,
          is_ai: false,
        })
        setHistoryChat(prev)
  

        setIsCallAI(true)  
    }

  }

  const callAPIChat = async (chatMessage: string) => {
    const result = await AIGeneralAPI(
      user_id,
      chatMessage,
      categoryChat,
      sessionId

    )
    return result;
  }

  function renderBold(text: string) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <b key={index}>{part.slice(2, -2)}</b>;
      }
      return part;
    });
  }

  const onChangeCategory = (cat: string) => {
    setCategoryChat(cat)
      const prev = []
        prev.push({
          id: 0,
          message: 'คุณสามารถถามคำถามที่คุณต้องการได้เลยค่ะ',
          is_ai: true,
        })
      setHistoryChat(prev)
  }

  return (
    <div
      style={{
        'background': "linear-gradient(180deg, rgba(37, 153, 174, 0.8) 0%, rgba(58, 120, 169, 0.8) 100%)"
      }}
      className={'  fixed z-[9999]  bottom-0 left-0 overflow-y-auto h-[410px] w-full rounded-t-[24px]   '}
    >
        <div className='w-full flex flex-nowrap p-[24px] items-center '>

          <div className='w-fit flex-none flex flex-wrap'>

            <Image
              src={'/images/mumate/ic_mumate_chat.svg'}
              width={43}
              height={10}
              alt='icon-mumate'
            />

            <span className=' bg-[#4B4F88CC] text-white text-[8px]  py-[3px] px-[6px] rounded-[2px] ml-2'>Beta V5.0</span>
          </div>

          <div className='w-full grow flex justify-center'>
            <span className=' h-[3px] bg-white w-[50px] rounded-[100px] -ml-[50px]'></span>
          </div>

          
                    <div className='w-fit flex-none flex flex-wrap'>
          
                      <Image
                        src={'/images/mumate/x-mark.svg'}
                        width={30}
                        height={30}
                        alt='icon-close'
                        className=' cursor-pointer '
                        onClick={() => { onClose() }}
                      />
          
                    </div>

        </div>
        <div className='w-full h-fit flex  flex-wrap'>
          {
            categoryChat   ?
                <div 
                className='h-[264px] grow  overflow-y-auto w-full py-[20px] '>
                  <div 
                  className='w-full flex flex-wrap px-[24px]'>
                      {
                        historyChat.map(function(item, index){
                          return (
                            <div className={ (item.is_ai ? '  justify-start  ' : ' justify-end ' ) + ' w-full flex flex-wrap '}>
                              <div className={
                                (item.is_ai ? '  justify-start  ' : ' justify-end ' ) + 
                                'w-3/4 flex flex-wrap my-2 text-white whitespace-pre-line '}>
                                <span 
                                className={
                                  (item.is_ai ? '  justify-start bg-moumate_blue rounded-[8px]  py-[8px] px-[12px] ' : ' bg-[#4B4F88CC] rounded-[8px] justify-end py-[8px] px-[12px]' ) + 
                                  '  flex-wrap '}>
                                  {renderBold(item.message)}
                                </span>
                              </div>
                            </div>
                          )
                        })
                      }
                  </div>
                        <div ref={bottomRef} />
                </div>
                :
                null 
          }
          {
            categoryChat   ?
            <div className='h-[80px] w-full flex items-center px-[24px]'>

              <div
              style={{
                "background": "linear-gradient(268.72deg, rgba(174, 240, 243, 0.2) 1.75%, rgba(159, 184, 232, 0.2) 49.8%, rgba(251, 217, 226, 0.2) 97.85%)"
              }}
              className='w-full p-[16px] rounded-[100px] border-white border-[2px] relative '
              
              >
                <input
                  type='text'
                  disabled={isCallAI}
                  value={chatMessage} onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      onSubmitChat()
                    }
                  }}
                  onChange={(e) => { onChangeChatMessage(e.target.value) }}
                  className='w-full  text-white  text-[16px] bg-transparent border-none outline-none focus:outline-none focus:ring-0'
                />

                <Image
                  src={'/images/mumate/ic_button_chat.svg'}
                  width={30}
                  height={30}
                  onClick={()=> { if (!isCallAI) { onSubmitChat()} }}
                  className={(isCallAI ? '': ' cursor-pointer  ' ) + ' absolute z-30 right-0 bottom-0 mx-[24px] mb-[12px]  '}
                  alt='icon-chat'/>
              </div>
            </div>
            :
            <div className='h-[80px] w-full flex flex-wrap items-center'>
              <span  className='w-full py-3 px-4  text-white font-medium text-[18px] mb-4 '>คุณอยากรู้เรื่องอะไรบ้าง</span>
              <span onClick={() => { onChangeCategory('personality') }} className='w-full py-3 px-4 cursor-pointer text-white font-medium text-[18px] border-b border-t '>ลักษณะทั่วไป</span>
              <span onClick={() => { onChangeCategory('health') }} className='w-full py-3 px-4 cursor-pointer text-white font-medium text-[18px] border-b '>สุขภาพ</span>
              <span onClick={() => { onChangeCategory('wealth') }} className='w-full py-3 px-4 cursor-pointer text-white font-medium text-[18px] border-b '>การเงิน</span>
              <span onClick={() => { onChangeCategory('relationship') }} className='w-full py-3 px-4 cursor-pointer text-white font-medium text-[18px] border-b '>ความรัก</span>
              <span onClick={() => { onChangeCategory('career') }} className='w-full py-3 px-4 cursor-pointer text-white font-medium text-[18px]  '>อาชีพ</span>
            </div>
          }

        </div>


    </div>
  )
}

export default ModalAIChatGeneral
