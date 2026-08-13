/**
 * Real-human motion demos: photoreal looping clips per movement pattern.
 * Plays when the timer is running, freezes on the first frame when paused.
 * Falls back to the 2D animated athlete if a clip is unavailable.
 */
import { useEffect, useRef } from "react";

import pushup from "../../public/motion/pushup.mp4.asset.json";
import squat from "../../public/motion/squat.mp4.asset.json";
import plank from "../../public/motion/plank.mp4.asset.json";
import warmup from "../../public/motion/warmup.mp4.asset.json";
import cooldown from "../../public/motion/cooldown.mp4.asset.json";
import burpee from "../../public/motion/burpee.mp4.asset.json";
import { AnimatedAthlete } from "./athlete-animated";

type Pose =
  | "push-up"
  | "squat"
  | "plank"
  | "burpee"
  | "warmup"
  | "cooldown"
  | "default";

const CLIPS: Record<Pose, string | null> = {
  "push-up": pushup.url,
  squat: squat.url,
  plank: plank.url,
  burpee: burpee.url,
  warmup: warmup.url,
  cooldown: cooldown.url,
  default: squat.url,
};

export function AthleteVideo({
  pose,
  running,
  tempo = 3,
  size = 260,
}: {
  pose: Pose;
  running: boolean;
  tempo?: number;
  size?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const src = CLIPS[pose] ?? null;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (running) void el.play().catch(() => {});
    else el.pause();
  }, [running, src]);

  if (!src) {
    return <AnimatedAthlete pose={pose} running={running} tempo={tempo} size={size} />;
  }

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-black/40"
      style={{ width: size, height: size }}
    >
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="auto"
        className="size-full object-cover"
        style={{ filter: running ? "none" : "grayscale(0.35) brightness(0.8)" }}
        aria-label="عرض توضيحي بشخصية حقيقية للحركة"
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 100%, rgba(204,255,0,0.16), transparent 60%)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-primary/80">
        <span>{running ? "◉ motion · live" : "⏸ standby"}</span>
        <span>{tempo.toFixed(1)}s/rep</span>
      </div>
    </div>
  );
}
