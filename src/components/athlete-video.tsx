/**
 * Real-human motion demos: photoreal looping clips per movement pattern.
 * Plays when the timer is running, freezes on the first frame when paused.
 * Falls back to the 2D animated athlete if a clip is unavailable.
 */
import { useEffect, useRef } from "react";

import { resolveExerciseVideo } from "@/lib/exercise-videos";
import { AnimatedAthlete } from "./athlete-animated";

type Pose =
  | "push-up"
  | "squat"
  | "plank"
  | "burpee"
  | "warmup"
  | "cooldown"
  | "default";

export function AthleteVideo({
  exerciseId,
  pose,
  running,
  tempo = 3,
  size = 260,
}: {
  exerciseId?: string;
  pose: Pose;
  running: boolean;
  tempo?: number;
  size?: number;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const video = resolveExerciseVideo(exerciseId, pose);
  const src = video.src;

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
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background"
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
      {video.status === "temporary" && (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded-md border border-border bg-background/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground">
          عرض مؤقت
        </span>
      )}
    </div>
  );
}
