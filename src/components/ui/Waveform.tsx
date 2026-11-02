/** Five bars that dance while read-aloud is playing. Decorative; the buttons carry the meaning. */
export function Waveform({ active }: { active: boolean }) {
  return (
    <span className="inline-flex h-6 items-center gap-1" aria-hidden="true">
      {[0, 0.15, 0.3, 0.1, 0.25].map((delay, i) => (
        <span key={i} className={`w-1 rounded-full bg-accent ${active ? "wave-bar" : ""}`} style={{ height: active ? "100%" : "35%", animationDelay: `${delay}s` }} />
      ))}
    </span>
  );
}
