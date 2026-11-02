/** A tick that draws itself inside a green circle. Used to confirm an action. Static for reduced motion. */
export function Tick({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`tick-draw inline-block shrink-0 ${className}`} aria-hidden="true">
      <circle cx="12" cy="12" r="11" className="fill-ok-soft stroke-ok" strokeWidth="1.5" fill="none" />
      <path d="m7 12.5 3.2 3.2L17 8.8" fill="none" className="stroke-ok" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
