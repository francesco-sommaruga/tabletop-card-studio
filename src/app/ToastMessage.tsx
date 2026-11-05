import { Check } from 'lucide-react'
import type { Toast } from '../hooks/useToast'

/** Bottom toast; an optional action button runs the action and dismisses the toast. */
export function ToastMessage({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { action } = toast
  return (
    <div className="toast" role="status">
      <Check size={15} />
      {toast.message}
      {action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            onDismiss()
            action.run()
          }}
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
