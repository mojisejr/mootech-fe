import { API } from "./endpoint"

export type AIGeneralStreamingOptions = {
  onToken?: (token: string) => void
  onError?: (err: any) => void
  onConversationId?: (conversationId: string) => void
  signal?: AbortSignal
}

export type ApiResult<T = any> =
  | { ok: true; code: number; data: T }
  | { ok: false; code: number; message?: string; error?: any }

export const AIGeneralStreamingAPI = async (
  user_id: string,
  message: string,
  category: string,
  conversation_id: string,
  options?: AIGeneralStreamingOptions,
): Promise<ApiResult<null>> => {
  try {
    const response = await fetch(API.ai.general_streaming, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      signal: options?.signal,
      body: JSON.stringify({
        user_id,
        message,
        category,
        conversation_id: conversation_id || "",
      }),
    })

    if (!response.ok) {
      let messageText: string | undefined
      try {
        messageText = await response.text()
      } catch {}

      const err: ApiResult<null> = {
        ok: false,
        code: response.status,
        message: messageText || response.statusText,
      }
      options?.onError?.(err)
      return err
    }

    const reader = response.body?.getReader()
    if (!reader) {
      const err: ApiResult<null> = {
        ok: false,
        code: 500,
        message: "No response body (stream not supported)",
      }
      options?.onError?.(err)
      return err
    }

    const decoder = new TextDecoder("utf-8")
    let buffer = ""
    let latestConversationId = conversation_id || ""

    // fallback สำหรับกรณีไม่มี event: message จริง ๆ
    let fallbackText = ""
    let hasMessageStream = false
    const emittedFallbackSet = new Set<string>()

    const emitConversationId = (json: any) => {
      const cid = json?.conversation_id
      if (typeof cid === "string" && cid.trim() && cid !== latestConversationId) {
        latestConversationId = cid
        options?.onConversationId?.(cid)
      }
    }

    const tryEmitFallback = () => {
      if (hasMessageStream) return
      const text = fallbackText.trim()
      if (!text) return
      if (emittedFallbackSet.has(text)) return

      emittedFallbackSet.add(text)
      options?.onToken?.(text)
    }

    const handleDataLine = (raw: string): boolean => {
      const line = raw.trim()
      if (!line) return false
      if (line === "[DONE]") return true

      try {
        const json: any = JSON.parse(line)

        emitConversationId(json)

        const eventName = json?.event

        // event ที่ไม่ต้องแสดง
        if (
          eventName === "workflow_started" ||
          eventName === "workflow_finished" ||
          eventName === "node_started" ||
          eventName === "message_start" ||
          eventName === "tts_message" ||
          eventName === "tts_message_end" ||
          eventName === "ping" ||
          eventName === "agent_message"
        ) {
          return false
        }

        // แสดงเฉพาะข้อความ final stream
        if (eventName === "message") {
          const answer = json?.answer
          if (typeof answer === "string" && answer.length > 0) {
            hasMessageStream = true
            options?.onToken?.(answer)
          }
          return false
        }

        // เก็บ node_finished.outputs.text ไว้เป็น fallback เท่านั้น
        if (eventName === "node_finished") {
          const text =
            json?.data?.outputs?.text ??
            json?.outputs?.text ??
            ""

          if (typeof text === "string" && text.trim() && !hasMessageStream) {
            // กัน JSON pack ไม่ให้เอามาแสดงใน chat
            const trimmed = text.trim()
            const looksLikeJsonPack =
              trimmed.startsWith("{") ||
              trimmed.startsWith("[") ||
              trimmed.includes(`"pack_version"`) ||
              trimmed.includes(`"personality_core"`) ||
              trimmed.includes(`"facts_used"`)

            if (!looksLikeJsonPack) {
              fallbackText += trimmed
            }
          }

          return false
        }

        return false
      } catch {
        return false
      }
    }

    const parseBuffer = (buf: string): { rest: string; done: boolean } => {
      const normalized = buf.replace(/\r\n/g, "\n")
      const parts = normalized.split("\n\n")
      const rest = parts.pop() ?? ""

      for (const evt of parts) {
        const lines = evt.split("\n").map((l) => l.trimEnd())

        const eventHeader = lines.find((l) => l.startsWith("event:"))
        if (eventHeader?.replace(/^event:\s?/, "").trim() === "ping") {
          continue
        }

        const dataLines = lines
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.replace(/^data:\s?/, ""))

        for (const dl of dataLines) {
          const done = handleDataLine(dl)
          if (done) return { rest: "", done: true }
        }
      }

      return { rest, done: false }
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      const parsed = parseBuffer(buffer)
      if (parsed.done) {
        tryEmitFallback()
        return { ok: true, code: 200, data: null }
      }
      buffer = parsed.rest
    }

    if (buffer.trim()) {
      const parsed = parseBuffer(buffer)
      if (parsed.done) {
        tryEmitFallback()
        return { ok: true, code: 200, data: null }
      }

      const normalized = buffer.replace(/\r\n/g, "\n")
      const maybeData = normalized
        .split("\n")
        .map((l) => l.trimEnd())
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.replace(/^data:\s?/, ""))

      for (const dl of maybeData) {
        const done = handleDataLine(dl)
        if (done) {
          tryEmitFallback()
          return { ok: true, code: 200, data: null }
        }
      }
    }

    tryEmitFallback()

    return { ok: true, code: 200, data: null }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      const err: ApiResult<null> = {
        ok: false,
        code: 499,
        message: "Request aborted",
        error,
      }
      options?.onError?.(err)
      return err
    }

    const err: ApiResult<null> = {
      ok: false,
      code: 500,
      message: "Unexpected error",
      error,
    }
    options?.onError?.(err)
    return err
  }
}