interface ErrorToastProps {
  message: string;
  onClose: () => void;
}

export default function ErrorToast({ message, onClose }: ErrorToastProps) {
  if (!message) {
    return null;
  }

  return (
    <div
      className="fixed z-[9999] left-1/2 -translate-x-1/2 bottom-6 w-[92%] max-w-[420px] bg-white border border-moumate_red shadow-custom rounded-xl px-4 py-3 flex items-start gap-3"
      role="alert"
    >
      <span className="text-[14px] text-black leading-relaxed flex-1">{message}</span>
      <button
        onClick={onClose}
        className="text-[13px] text-moumate_blue font-semibold shrink-0"
      >
        ปิด
      </button>
    </div>
  );
}
