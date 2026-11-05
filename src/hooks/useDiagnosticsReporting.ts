import { useEffect } from 'react'

/** Forwards uncaught renderer errors and unhandled promise rejections to the diagnostic log. */
export function useDiagnosticsReporting() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      void window.cardCms.writeDiagnostic('uncaught-error', {
        message: event.message,
        filename: event.filename,
        line: event.lineno,
        column: event.colno,
        stack: event.error instanceof Error ? event.error.stack : '',
      })
    }
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason
      void window.cardCms.writeDiagnostic('unhandled-rejection', {
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : '',
      })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
}
