import { X } from "lucide-react";

export type ToastVariant = "info" | "success" | "warning" | "private";

export interface ToastMessage {
  id: number;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastProps {
  toast: ToastMessage | null;
  onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  if (!toast) return null;

  return (
    <div
      className={["toast", `toast--${toast.variant ?? "info"}`].join(" ")}
      role="status"
      aria-live="polite"
    >
      <div>
        <strong>{toast.title}</strong>
        {toast.description ? <p>{toast.description}</p> : null}
      </div>

      <button
        className="toast__close"
        onClick={onDismiss}
        title="Dismiss notification"
        aria-label="Dismiss notification"
      >
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}