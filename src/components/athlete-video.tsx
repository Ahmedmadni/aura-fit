/**
 * Exact exercise motion preview.
 *
 * Verified hasaneyldrm GIFs are preferred when a sourceId match exists.
 * The three Workout Guide frames remain the deterministic fallback for
 * exercises without a verified GIF mapping.
 */
import { useEffect, useMemo, useState } from "react";

import { getExercise } from "@/lib/exercise-db";
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
  const exercise = exerciseId ? getExercise(exerciseId) : undefined;
  const frames = exercise?.media.frames;
  const preferredGif = exercise?.media.preferredGifUrl;
  const preferredImage = exercise?.media.preferredImageUrl;
  const [frameIndex, setFrameIndex] = useState(0);

  const intervalMs = useMemo(
    () => Math.max(280, Math.round((tempo * 1000) / 3)),
    [tempo],
  );

  useEffect(() => {
    setFrameIndex(0);
    if (!running || !frames?.length) return;
    const timer = window.setInterval(
      () => setFrameIndex((current) => (current + 1) % frames.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [exerciseId, frames, intervalMs, running]);

  useEffect(() => {
    if (preferredImage) {
      const poster = new Image();
      poster.src = preferredImage;
    }
    if (preferredGif) {
      const motion = new Image();
      motion.src = preferredGif;
    }
    if (!frames) return;
    frames.forEach((src) => {
      const image = new Image();
      image.src = src;
    });
  }, [frames, preferredGif, preferredImage]);

  if (preferredGif) {
    const source = running ? preferredGif : preferredImage ?? preferredGif;
    return (
      <div
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background"
        style={{ width: size, height: size }}
      >
        <img
          key={running ? "gif" : "poster"}
          src={source}
          alt={"حركة مطابقة لتمرين " + (exercise?.latin ?? "")}
          className="size-full object-contain"
          style={{ filter: running ? "none" : "grayscale(0.15) brightness(0.92)" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 90% at 50% 100%, rgba(204,255,0,0.09), transparent 62%)",
          }}
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2 text-[9px] font-semibold tracking-wide text-primary/90">
          <span>{running ? "◉ فيديو الحركة" : "⏸ صورة البداية"}</span>
          <span>{exercise?.media.preferredSourceId}</span>
        </div>
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-border bg-background/85 px-2 py-1 text-center text-[8px] text-muted-foreground backdrop-blur">
          hasaneyldrm/exercises-dataset · {exercise?.media.preferredSourceName}
        </div>
      </div>
    );
  }

  if (!frames?.length) {
    return <AnimatedAthlete pose={pose} running={running} tempo={tempo} size={size} />;
  }

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background"
      style={{ width: size, height: size }}
    >
      <img
        key={frames[frameIndex]}
        src={frames[frameIndex]}
        alt={"إطار توضيحي مطابق لتمرين " + (exercise?.latin ?? "")}
        className="size-full object-contain p-3 transition-opacity duration-200"
        style={{ filter: running ? "none" : "grayscale(0.25) brightness(0.9)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 100%, rgba(204,255,0,0.12), transparent 62%)",
        }}
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-primary/80">
        <span>{running ? "◉ حركة مطابقة" : "⏸ الإطار 1"}</span>
        <span>إطار {frameIndex + 1}/3</span>
      </div>
      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-border bg-background/85 px-2 py-1 text-center text-[8px] text-muted-foreground backdrop-blur">
        Bryl Lim / Everkinetic · ترخيص CC BY-SA 4.0
      </div>
    </div>
  );
}
