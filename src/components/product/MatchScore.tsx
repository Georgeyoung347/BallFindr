/**
 * Marketing-only animated match score ring for the homepage preview.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Animated circular match score. Purely presentational. */
export function MatchScore({
  score,
  size = 96,
  label = "match",
  className,
}: {
  score: number;
  size?: number;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setValue(score);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        const start = performance.now();
        const duration = 1100;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          setValue(Math.round(score * eased));
          if (t < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [score]);

  const radius = size / 2 - 6;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      ref={ref}
      className={cn("relative grid shrink-0 place-items-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${score}% ${label}`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={5}
          className="stroke-border"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={5}
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-150"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * value) / 100}
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-xl font-extrabold text-primary tabular-nums">
          {value}%
        </div>
        <div className="text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {label}
        </div>
      </div>
    </div>
  );
}
