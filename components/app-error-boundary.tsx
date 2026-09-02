// components/app-error-boundary.tsx — app-wide render-error boundary (#399).
//
// Before this existed, one render throw anywhere under _app unmounted the whole tree to a
// blank white page with no recovery path (a console trace nobody sees). This boundary catches
// render/lifecycle errors of the page subtree and offers a real way out: reload (full-document,
// re-arms the identity self-heal) or retreat home. It does NOT catch event-handler/async errors
// (React limitation — those stay console/log-tail territory) and it does not swallow the error:
// it still reports to the console for the log tail.
import React from "react"
import Link from "next/link"

type Props = { children: React.ReactNode }
type State = { error: Error | null }

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // keep the trace in the console/log tail — the UI alone is not the report
    console.error("[error-boundary] render error", error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-v3-ghost-white px-6 text-center font-ibm">
          <p className="text-lg font-bold text-v3-navy">มีอะไรผิดพลาดในหน้านี้</p>
          <p className="text-sm leading-6 text-v3-text-body">
            ขออภัยด้วยนะ ลองโหลดหน้าใหม่ หรือกลับไปที่หน้าหลักก่อนได้เลย
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-v3-sapphire px-6 py-3 font-poppins-v3 font-semibold text-v3-lime"
            data-testid="error-boundary-reload"
          >
            โหลดหน้าใหม่
          </button>
          <Link href="/v2" className="text-sm text-v3-sapphire underline" data-testid="error-boundary-home">
            กลับหน้าหลัก
          </Link>
        </div>
      )
    }
    return this.props.children
  }
}

export default AppErrorBoundary
