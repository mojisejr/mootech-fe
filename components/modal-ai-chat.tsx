"use client"

import { AI_CODE_RESPONSE, AI_CODE_RESPONSE_MESSAGE } from "@/constants/ai-code-response"
import { AICardAPI } from "@/constants/api/api-ai-card"
import Image from "next/image"
import { useEffect, useRef, useState } from "react"

type ComponentProps = {
  user_id: string
  card_no: string
  start_message: string
  onClose: any
}

const SUBSCRIBE_MESSAGE =
  "กรุณาสมัครสมาชิกรายเดือน รายปี เพื่อพูดคุยกับซินแสต่อ"

const TypingDots = () => {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.2s]" />
      <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce [animation-delay:-0.1s]" />
      <span className="w-[6px] h-[6px] rounded-full bg-white/80 animate-bounce" />
      <span className="ml-2 text-white/90 text-[12px]">ซินแสกำลังตอบ...</span>
    </span>
  )
}

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

const ModalAIChat = ({ user_id, card_no, start_message, onClose }: ComponentProps) => {
  const [sessionId] = useState<string>(`${user_id}_${getYMD()}_${randomString(5)}`)

  const [historyChat, setHistoryChat] = useState<any[]>([])
  const [chatMessage, setChatMessage] = useState<string>("")
  const [isCallAI, setIsCallAI] = useState<boolean>(false)

  // ✅ ใช้ ref เก็บข้อความที่จะส่ง ป้องกัน race
  const pendingMsgRef = useRef<string>("")
  const bottomRef = useRef<any>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [historyChat])

  // (optional) start message
  useEffect(() => {
    if (!start_message) return
    setHistoryChat([
      {
        id: crypto.randomUUID(),
        message: start_message,
        is_ai: true,
      },
    ])
  }, [start_message])

  const callAPIChat = async (msg: string) => {
    const result = await AICardAPI(user_id, sessionId, card_no, msg)
    return result
  }

  function renderBold(text: string) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <b key={index}>{part.slice(2, -2)}</b>
      }
      return part
    })
  }

  // ✅ helper: map error/result -> message
  const mapErrorToMessage = (errOrResult: any) => {
    const code = errOrResult?.code
    const status = errOrResult?.status
    const statusCode = errOrResult?.statusCode

    // ✅ รองรับ 410 Gone (และเผื่อ 404)
    if (code === 410 || status === 410 || statusCode === 410) return SUBSCRIBE_MESSAGE
    if (code === 404 || status === 404 || statusCode === 404) return SUBSCRIBE_MESSAGE

    // ✅ รองรับ enum เดิม
    if (code === AI_CODE_RESPONSE.OUT_OF_LIMIT) return SUBSCRIBE_MESSAGE
    if (code === AI_CODE_RESPONSE.NO_PLAN) return AI_CODE_RESPONSE_MESSAGE.NO_PLAN
    if (code === AI_CODE_RESPONSE.EXPIRED) return AI_CODE_RESPONSE_MESSAGE.EXPIRED

    // ✅ เผื่อส่ง message มาตรง ๆ
    const msg = String(errOrResult?.message ?? "")
    if (msg.includes("เกิน Limit")) return SUBSCRIBE_MESSAGE

    return "เกิดข้อผิดพลาด ลองใหม่อีกครั้ง"
  }

  // ✅ effect ยิง API เมื่อ isCallAI เป็น true
  useEffect(() => {
    if (!isCallAI) return

    const run = async () => {
      const msg = pendingMsgRef.current || ""
      const aiMsgId = crypto.randomUUID()

      // ✅ ใส่ bubble "กำลังตอบ..." ก่อน
      setHistoryChat((prev) => [
        ...prev,
        { id: aiMsgId, message: "", is_ai: true, is_loading: true },
      ])

      try {
        const result: any = await callAPIChat(msg)

        // ✅ success
        if (result?.code === 200) {
          setHistoryChat((prev) =>
            prev.map((m) =>
              m.id === aiMsgId
                ? { ...m, is_loading: false, message: result.message }
                : m,
            ),
          )
          return
        }

        // ✅ error (business code)
        const message = mapErrorToMessage(result)

        setHistoryChat((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, is_loading: false, message } : m,
          ),
        )
      } catch (e: any) {
        // ✅ error (http status เช่น 410) มักมาอยู่ใน e.response.status (axios)
        const status = e?.response?.status
        const message = mapErrorToMessage({ ...e, status })

        setHistoryChat((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, is_loading: false, message } : m,
          ),
        )
      } finally {
        pendingMsgRef.current = ""
        setIsCallAI(false)
      }
    }

    run()
  }, [isCallAI]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmitChat = () => {
    const msg = chatMessage.trim()
    if (!msg || isCallAI) return

    setChatMessage("")

    // ✅ push user message ก่อน
    setHistoryChat((prev) => [
      ...prev,
      { id: crypto.randomUUID(), message: msg, is_ai: false },
    ])

    // ✅ set ข้อความที่จะส่ง + trigger call
    pendingMsgRef.current = msg
    setIsCallAI(true)
  }

  return (
    <div
      style={{
        background:
          "linear-gradient(180deg, rgba(37, 153, 174, 0.8) 0%, rgba(58, 120, 169, 0.8) 100%)",
      }}
      className="fixed z-[9999] bottom-0 left-0 overflow-y-auto h-[410px] w-full rounded-t-[24px]"
    >
      <div className="w-full flex flex-nowrap p-[24px] items-center">
        <div className="w-fit flex-none flex flex-wrap">
          <Image
            src={"/images/mumate/ic_mumate_chat.svg"}
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
            src={"/images/mumate/x-mark.svg"}
            width={30}
            height={30}
            alt="icon-close"
            className="cursor-pointer"
            onClick={() => onClose()}
          />
        </div>
      </div>

      <div className="w-full h-fit flex flex-wrap">
        <div className="h-[264px] grow overflow-y-auto w-full py-[20px]">
          <div className="w-full flex flex-wrap px-[24px]">
            {historyChat.map((item) => (
              <div
                key={item.id}
                className={(item.is_ai ? "justify-start" : "justify-end") + " w-full flex flex-wrap"}
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
                    {item.is_ai && item.is_loading ? <TypingDots /> : renderBold(item.message)}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div ref={bottomRef} />
        </div>

        <div className="h-[80px] w-full flex items-center px-[24px]">
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
              className="w-full text-white text-[16px] bg-transparent border-none outline-none focus:outline-none focus:ring-0"
            />

            <Image
              src={"/images/mumate/ic_button_chat.svg"}
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
      </div>
    </div>
  )
}

export default ModalAIChat