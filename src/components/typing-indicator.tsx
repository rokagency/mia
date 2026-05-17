/**
 * Intercom-style typing indicator: three dots pulsing in sequence
 * inside an assistant bubble. Replaces the bland "…" placeholder while
 * the model's first token is in flight.
 */
export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
        <Dot delay="0ms" />
        <Dot delay="180ms" />
        <Dot delay="360ms" />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="block h-2 w-2 animate-pulse rounded-full bg-neutral-400"
      style={{ animationDelay: delay, animationDuration: "1.2s" }}
    />
  );
}
