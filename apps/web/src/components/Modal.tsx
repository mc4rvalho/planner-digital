import { useRef, useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
export default function Modal({
  children,
  onClose,
  label,
  closeLabel = "Close",
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={label}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button
        className="icon modal-close"
        onClick={onClose}
        aria-label={closeLabel}
      >
        <X size={20} />
      </button>
      {children}
    </dialog>
  );
}
