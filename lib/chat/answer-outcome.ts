// Did a chat stream from bazi deliver a real answer? The chat route charges QI only when it did
// (mumate-chat-failed-answer-001). Bazi marks a failed answer with one `mumate.answer.failed`
// frame before its fallback text, so "some bytes arrived" is not an answer: the fallback text is
// content too. An answer counts only when the stream reached [DONE], carried non-empty
// choices[0].delta.content, and had no failure frame. Frames may be split across network chunks.

export const ANSWER_FAILED_OBJECT = "mumate.answer.failed"

export type AnswerOutcome = {
  /** true only for a completed stream with answer content and no failure frame */
  answered: boolean
  done: boolean
  failed: boolean
  content: boolean
}

export function createAnswerOutcome() {
  let buffer = ""
  let done = false
  let failed = false
  let content = false

  const readFrame = (frame: string) => {
    for (const line of frame.split("\n")) {
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") {
        done = true
        continue
      }
      try {
        const j = JSON.parse(data) as { object?: unknown; choices?: Array<{ delta?: { content?: unknown } }> }
        if (j?.object === ANSWER_FAILED_OBJECT) {
          failed = true
          continue
        }
        const tok = j?.choices?.[0]?.delta?.content
        if (typeof tok === "string" && tok.trim()) content = true
      } catch {
        // keep-alives and non-JSON lines carry no answer
      }
    }
  }

  return {
    push(text: string) {
      buffer += text
      const frames = buffer.split("\n\n")
      buffer = frames.pop() ?? ""
      for (const frame of frames) readFrame(frame)
    },
    finish(): AnswerOutcome {
      if (buffer) readFrame(buffer)
      buffer = ""
      return { answered: done && content && !failed, done, failed, content }
    },
  }
}
