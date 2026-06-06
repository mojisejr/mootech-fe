"use client"

import { AI_CODE_RESPONSE, AI_CODE_RESPONSE_MESSAGE } from "@/constants/ai-code-response"
import { AIGeneralStreamingAPI } from "@/constants/api/api-ai-general-streaming"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type ComponentProps = {
  user_id: string
  onClose: () => void
}

type ChatItem = {
  id: string
  message: string
  is_ai: boolean
  is_loading?: boolean
  loading_text?: string
}

const SUBSCRIBE_MESSAGE =
  "กรุณาสมัครสมาชิกรายเดือน รายปี เพื่อพูดคุยกับซินแสต่อ"

const FIRST_LOADING_MESSAGE =
  "ซินแสกำลังวิเคราะห์ดวงของคุณโดยรวมอยู่ อาจใช้เวลาสักครู่ กรุณารอสักนิดนะคะ"

const DEFAULT_LOADING_MESSAGE = "ซินแสกำลังตอบ..."

const FIRST_AUTO_QUESTION = "ดวงฉันเป็นอย่างไรบ้าง"

const TypingDots = ({ text = DEFAULT_LOADING_MESSAGE }: { text?: string }) => {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.2s]" />
      <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.1s]" />
      <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce" />
      <span className="ml-2 text-white/90 text-[12px]">{text}</span>
    </span>
  )
}

const ModalAIChatStreamingGeneral = ({ user_id, onClose }: ComponentProps) => {
  const [sessionId, setSessionId] = useState<string>("")
  const sessionIdRef = useRef<string>("")
  const abortRef = useRef<AbortController | null>(null)

  const [historyChat, setHistoryChat] = useState<ChatItem[]>([])
  const [chatMessage, setChatMessage] = useState("")
  const [isCallAI, setIsCallAI] = useState(false)
  const [categoryChat, setCategoryChat] = useState("")
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const isFirstRequestRef = useRef<boolean>(true)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [historyChat])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const renderBold = (text: string) => {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <b key={index}>{part.slice(2, -2)}</b>
      }
      return part
    })
  }

  const mapErrorToMessage = (errOrResult: any) => {
    const code = errOrResult?.code
    const status = errOrResult?.status
    const statusCode = errOrResult?.statusCode

    if (code === 410 || status === 410 || statusCode === 410) return SUBSCRIBE_MESSAGE
    if (code === 404 || status === 404 || statusCode === 404) return SUBSCRIBE_MESSAGE
    if (code === AI_CODE_RESPONSE.OUT_OF_LIMIT) return SUBSCRIBE_MESSAGE

    const msg = String(errOrResult?.message ?? "")
    if (msg.includes("เกิน Limit")) return SUBSCRIBE_MESSAGE
    if (msg === "Request aborted") return "ยกเลิกการสนทนาแล้ว"

    return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"
  }

  const updateAiMessage = (
    aiMsgId: string,
    updater: (oldItem: ChatItem) => ChatItem,
  ) => {
    setHistoryChat((prev) =>
      prev.map((m) => (m.id === aiMsgId ? updater(m) : m)),
    )
  }

const submitChat = async (overrideMessage?: string, overrideCategory?: string) => {
  const msg = (overrideMessage ?? chatMessage).trim()
  const targetCategory = overrideCategory ?? categoryChat

  if (!msg || isCallAI || !targetCategory) return

  abortRef.current?.abort()
  const controller = new AbortController()
  abortRef.current = controller

  if (!overrideMessage) {
    setChatMessage("")
  }

  setIsCallAI(true)

  const userMsgId = crypto.randomUUID()
  const aiMsgId = crypto.randomUUID()

  const loadingText = isFirstRequestRef.current
    ? FIRST_LOADING_MESSAGE
    : DEFAULT_LOADING_MESSAGE

  setHistoryChat((prev) => [
    ...prev,
    { id: userMsgId, message: msg, is_ai: false },
    {
      id: aiMsgId,
      message: "",
      is_ai: true,
      is_loading: true,
      loading_text: loadingText,
    },
  ])

  let pendingText = ""
  let rafId: number | null = null
  let finished = false
  let started = false

  const flush = () => {
    rafId = null
    if (!pendingText) return

    const chunk = pendingText
    pendingText = ""

    updateAiMessage(aiMsgId, (oldItem) => ({
      ...oldItem,
      message: (oldItem.message ?? "") + chunk,
    }))
  }

  const scheduleFlush = () => {
    if (rafId != null) return
    rafId = window.requestAnimationFrame(flush)
  }

  try {
    const result = await AIGeneralStreamingAPI(
      user_id,
      msg,
      targetCategory,
      sessionIdRef.current,
      {
        signal: controller.signal,

        onConversationId: (conversationId) => {
          if (conversationId && sessionIdRef.current !== conversationId) {
            sessionIdRef.current = conversationId
            setSessionId(conversationId)
          }
        },

        onToken: (token) => {
          if (finished) return

          const t = String(token ?? "")
          if (!t) return

          if (!started) {
            started = true
            isFirstRequestRef.current = false

            updateAiMessage(aiMsgId, (oldItem) => ({
              ...oldItem,
              is_loading: false,
              loading_text: undefined,
            }))
          }

          pendingText += t
          scheduleFlush()
        },

        onError: (err: any) => {
          if (finished) return
          finished = true

          if (rafId != null) {
            cancelAnimationFrame(rafId)
            rafId = null
          }

          flush()

          const message = mapErrorToMessage(err)

          updateAiMessage(aiMsgId, (oldItem) => ({
            ...oldItem,
            is_loading: false,
            loading_text: undefined,
            message: oldItem.message ? oldItem.message : message,
          }))
        },
      },
    )

    finished = true

    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    flush()

    if (!result.ok) {
      if (result.code === 410 || result.code === 404) {
        updateAiMessage(aiMsgId, (oldItem) => ({
          ...oldItem,
          is_loading: false,
          loading_text: undefined,
          message: oldItem.message ? oldItem.message : SUBSCRIBE_MESSAGE,
        }))
        return
      }

      let message = "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"

      if (result.code === AI_CODE_RESPONSE.EXPIRED) {
        message = AI_CODE_RESPONSE_MESSAGE.EXPIRED
      } else if (result.code === AI_CODE_RESPONSE.NO_PLAN) {
        message = AI_CODE_RESPONSE_MESSAGE.NO_PLAN
      } else if (result.code === AI_CODE_RESPONSE.OUT_OF_LIMIT) {
        message = SUBSCRIBE_MESSAGE
      }

      if (String(result?.message ?? "").includes("เกิน Limit")) {
        message = SUBSCRIBE_MESSAGE
      }

      updateAiMessage(aiMsgId, (oldItem) => ({
        ...oldItem,
        is_loading: false,
        loading_text: undefined,
        message: oldItem.message ? oldItem.message : message,
      }))
    }
  } catch (e: any) {
    finished = true

    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    flush()

    const status = e?.response?.status
    const message = mapErrorToMessage({ ...e, status })

    updateAiMessage(aiMsgId, (oldItem) => ({
      ...oldItem,
      is_loading: false,
      loading_text: undefined,
      message: oldItem.message ? oldItem.message : message,
    }))
  } finally {
    setIsCallAI(false)
  }
}

  const onSubmitChat = async () => {
    await submitChat()
  }

const onChangeCategory = (cat: string) => {
  if (cat === "relationship" || cat === "personality") {
    setCategoryChat(cat)
    setHistoryChat([])
    setChatMessage("")
    isFirstRequestRef.current = true

    setTimeout(() => {
      submitChat(FIRST_AUTO_QUESTION, cat)
    }, 0)

    return
  }

  setCategoryChat("")
  setHistoryChat([
    {
      id: crypto.randomUUID(),
      message: "ซินแสเซียนปลาน้อยกำลังพัฒนาคำถาม พร้อมให้บริการเร็ว ๆ นี้",
      is_ai: true,
    },
  ])
}

  return (
    <div
      className="fixed z-[9999] bottom-0 left-0 overflow-y-auto  bg-[#44588B] h-[410px] w-full rounded-t-[24px]"
    >
      <div 
      
      style={{
        background: 
        "linear-gradient(180deg, rgba(37, 153, 174, 1) 0%, rgba(58, 120, 169, 1) 100%)"
,
      }}
      className="w-full flex flex-nowrap p-[24px] items-center">
        <div className="w-fit flex-none flex flex-wrap">
          <Image
            src="/images/mumate/ic_mumate_chat.svg"
            width={43}
            height={10}
            alt="icon-mumate"
          />
          <span className="bg-[#4B4F88CC] text-white text-[8px] py-[3px] px-[6px] rounded-[2px] ml-2">
            Beta V5.0
          </span>
        </div>

        <div className="w-full grow flex justify-center">
          <span className="h-[3px] bg-white w-[50px] rounded-[100px] -ml-[50px]"></span>
        </div>

        <div className="w-fit flex-none flex flex-wrap">
          <Image
            src="/images/mumate/x-mark.svg"
            width={30}
            height={30}
            alt="icon-close"
            className="cursor-pointer"
            onClick={onClose}
          />
        </div>
      </div>

      <div 
      className="w-full h-fit flex flex-wrap bg-[#44588B]">
        {categoryChat ? (
          <div className="h-[264px] grow overflow-y-auto w-full py-[20px] bg-[#44588B]">
            <div className="w-full flex flex-wrap px-[24px]">
              {historyChat.map((item) => (
                <div
                  key={item.id}
                  className={
                    (item.is_ai ? "justify-start" : "justify-end") +
                    " w-full flex flex-wrap"
                  }
                >
                  <div
                    className={
                      (item.is_ai ? "justify-start" : "justify-end") +
                      " w-3/4 flex flex-wrap my-2 text-white whitespace-pre-line"
                    }
                  >
                    <span
                      className={
                        (item.is_ai
                          ? "justify-start bg-moumate_blue rounded-[8px] py-[8px] px-[12px]"
                          : "bg-[#4B4F88CC] rounded-[8px] justify-end py-[8px] px-[12px]") +
                        " flex-wrap"
                      }
                    >
                      {item.is_ai && item.is_loading ? (
                        <TypingDots text={item.loading_text} />
                      ) : (
                        renderBold(item.message)
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div ref={bottomRef} />
          </div>
        ) : null}

        {categoryChat ? (
          <div className="h-[80px] w-full flex items-center px-[24px]  bg-[#44588B]">
            <div
              style={{
                background:
                  "linear-gradient(268.72deg, rgba(174, 240, 243, 0.2) 1.75%, rgba(159, 184, 232, 0.2) 49.8%, rgba(251, 217, 226, 0.2) 97.85%)",
              }}
              className="w-full p-[16px] rounded-[100px] border-white border-[2px] relative"
            >
              <input
                type="text"
                disabled={isCallAI}
                value={chatMessage}
                placeholder={isCallAI ? "กำลังรอคำตอบ..." : ""}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    onSubmitChat()
                  }
                }}
                onChange={(e) => setChatMessage(e.target.value)}
                className="w-full text-white text-[16px] bg-transparent border-none outline-none focus:outline-none focus:ring-0 placeholder:text-white/70"
              />

              <Image
                src="/images/mumate/ic_button_chat.svg"
                width={30}
                height={30}
                onClick={() => {
                  if (!isCallAI) onSubmitChat()
                }}
                className={
                  (isCallAI ? "" : "cursor-pointer ") +
                  " absolute z-30 right-0 bottom-0 mx-[24px] mb-[12px]"
                }
                alt="icon-chat"
              />
            </div>
          </div>
        ) : (
          <div className="h-[80px] w-full flex flex-wrap items-center  bg-[#44588B]">

            <span
              onClick={() => onChangeCategory("personality")}
              className="w-full py-3 px-4 cursor-pointer text-white font-medium text-[18px] border-b border-t"
            >
              ถาม Mate AI ทุกเรื่อง
            </span>

            <span
              onClick={() => onChangeCategory("relationship")}
              className="w-full py-3 px-4 cursor-pointer text-white font-medium text-[18px] border-b"
            >
              ถามเรื่องความรักอย่างเดียว
            </span>
          </div>
        )}
      </div>

      {sessionId ? <div className="hidden">{sessionId}</div> : null}
    </div>
  )
}

export default ModalAIChatStreamingGeneral