export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-[spin_0.9s_linear_infinite] ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        strokeOpacity="0.2"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SuccessCheck() {
  return (
    <div className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full bg-brand">
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" aria-hidden>
        <path
          d="M5 13l4 4L19 7"
          stroke="#F2EFE9"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="48"
          className="animate-draw-check"
        />
      </svg>
    </div>
  );
}
