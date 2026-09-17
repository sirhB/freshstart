export function HeroDeskArt() {
  return (
    <div className="animate-drift relative mx-auto aspect-[4/3] w-full max-w-xl lg:max-w-none">
      <div className="absolute inset-0 rounded-[2px] bg-gradient-to-br from-white/10 to-transparent" />

      <div className="absolute left-[8%] top-[18%] w-[54%] rotate-[-7deg] rounded-[2px] bg-[#f3f6f5] p-4 shadow-[0_20px_50px_rgba(0,0,0,0.35)]">
        <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink/50">
          <span>Equifax</span>
          <span>Your file</span>
        </div>
        <div className="h-px bg-line" />
        <p className="mt-3 font-display text-lg text-ink">Dispute letter</p>
        <p className="mt-1 text-xs text-muted">Prepared for you</p>
        <div className="mt-4 space-y-2">
          <div className="h-1.5 w-[80%] bg-fog" />
          <div className="h-1.5 w-[60%] bg-fog" />
          <div className="h-1.5 w-[66%] bg-fog" />
        </div>
      </div>

      <div className="absolute right-[6%] top-[28%] w-[52%] rotate-[5deg] rounded-[2px] bg-paper p-4 shadow-[0_24px_55px_rgba(0,0,0,0.4)]">
        <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-ink/50">
          <span>Experian</span>
          <span>Round 1</span>
        </div>
        <div className="h-px bg-line" />
        <p className="mt-3 font-display text-lg text-ink">Items challenged</p>
        <p className="mt-1 text-xs text-muted">3 accounts · FCRA protected</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="h-10 bg-mist" />
          <div className="h-10 bg-mist" />
          <div className="h-10 bg-signal/20" />
        </div>
      </div>

      <div className="absolute bottom-[10%] left-[18%] w-[58%] rotate-[-2deg] rounded-[2px] border border-white/20 bg-ink-soft/90 p-4 text-paper shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-fog/70">
          <span>Your plan</span>
          <span className="text-brass">In progress</span>
        </div>
        <p className="mt-3 font-display text-xl">Letters ready to send</p>
        <p className="mt-1 text-sm text-fog/75">
          Download them yourself — or we mail them for you.
        </p>
      </div>

      <svg
        className="pointer-events-none absolute -right-2 top-6 h-24 w-24 text-brass/70"
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="36"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="240"
          className="origin-center"
          style={{ animation: "ink-draw 2.4s ease forwards" }}
        />
      </svg>
    </div>
  );
}
