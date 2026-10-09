/**
 * GIF-first exercise media player.
 *
 * Exact/high-confidence hasaneyldrm GIFs are preferred. Static posters are
 * used while paused, and the three Workout Guide frames remain the runtime
 * fallback when no verified GIF exists or a preferred asset fails to load.
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

type ExerciseMediaPlayerProps = {
  exerciseId?: string;
  pose: Pose;
  running: boolean;
  tempo?: number;
  size?: number;
  fluid?: boolean;
  allowFrameReview?: boolean;
};

export function ExerciseMediaPlayer({
  exerciseId,
  pose,
  running,
  tempo = 3,
  size = 260,
  fluid = false,
  allowFrameReview = false,
}: ExerciseMediaPlayerProps) {
  const exercise = exerciseId ? getExercise(exerciseId) : undefined;
  const frames = exercise?.media.frames;
  const preferredGif =
    exercise?.media.preferred === "gif" ? exercise.media.gif : undefined;
  const poster = exercise?.media.poster;
  const [frameIndex, setFrameIndex] = useState(0);
  const [preferredFailed, setPreferredFailed] = useState(false);
  const [frameReviewPaused, setFrameReviewPaused] = useState(false);

  const intervalMs = useMemo(
    () => Math.max(280, Math.round((tempo * 1000) / 3)),
    [tempo],
  );

  useEffect(() => {
    setFrameIndex(0);
    setPreferredFailed(false);
    setFrameReviewPaused(false);
  }, [exerciseId, preferredGif, poster]);

  const usingFallback = !preferredGif || preferredFailed;
  const autoAdvanceFrames = running && !(allowFrameReview && frameReviewPaused);

  useEffect(() => {
    if (!autoAdvanceFrames || !usingFallback || !frames?.length) return;
    const timer = window.setInterval(
      () => setFrameIndex((current) => (current + 1) % frames.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [autoAdvanceFrames, frames, intervalMs, usingFallback]);

  useEffect(() => {
    if (!autoAdvanceFrames || !usingFallback || !frames?.length) return;
    const nextFrame = frames[(frameIndex + 1) % frames.length];
    if (!nextFrame || nextFrame === frames[frameIndex]) return;

    const image = new Image();
    image.src = nextFrame;
  }, [autoAdvanceFrames, frameIndex, frames, usingFallback]);

  const containerStyle = fluid
    ? { width: "100%", aspectRatio: "1 / 1" }
    : { width: size, height: size };

  if (preferredGif && !preferredFailed) {
    const source = running ? preferredGif : poster ?? frames?.[0] ?? preferredGif;
    return (
      <div
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background"
        style={containerStyle}
      >
        <img
          key={running ? "gif" : "poster"}
          src={source}
          alt={"حركة مطابقة لتمرين " + (exercise?.latin ?? "")}
          loading="lazy"
          decoding="async"
          onError={() => setPreferredFailed(true)}
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
          <span>{exercise?.media.sourceExerciseId}</span>
        </div>
        <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-border bg-background/85 px-2 py-1 text-center text-[8px] text-muted-foreground backdrop-blur">
          hasaneyldrm/exercises-dataset · {exercise?.media.sourceName}
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
      data-fallback-frame-index={allowFrameReview ? frameIndex + 1 : undefined}
      style={containerStyle}
    >
      <img
        key={frames[frameIndex]}
        src={frames[frameIndex]}
        alt={"إطار توضيحي مطابق لتمرين " + (exercise?.latin ?? "")}
        loading="lazy"
        decoding="async"
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
        <span>{preferredFailed ? "↺ إطارات بديلة" : autoAdvanceFrames ? "◉ عرض الإطارات" : "⏸ مراجعة الوضعيات"}</span>
        <span>إطار {frameIndex + 1}/3</span>
      </div>
      {allowFrameReview && (
        <div className="absolute inset-x-2 bottom-9 z-10 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/90 p-1.5 shadow-lg backdrop-blur" dir="rtl">
          <button
            type="button"
            aria-label="الإطار السابق"
            onClick={() => {
              setFrameReviewPaused(true);
              setFrameIndex((current) => (current + frames.length - 1) % frames.length);
            }}
            className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold text-foreground"
          >
            السابق
          </button>
          <button
            type="button"
            aria-label={frameReviewPaused ? "تشغيل عرض الإطارات التلقائي" : "إيقاف عرض الإطارات التلقائي"}
            onClick={() => setFrameReviewPaused((paused) => !paused)}
            className="min-h-9 flex-1 rounded-lg bg-primary/15 px-2 text-xs font-bold text-primary"
          >
            {frameReviewPaused ? "▶ تشغيل" : "⏸ إيقاف"}
          </button>
          <button
            type="button"
            aria-label="الإطار التالي"
            onClick={() => {
              setFrameReviewPaused(true);
              setFrameIndex((current) => (current + 1) % frames.length);
            }}
            className="min-h-9 rounded-lg border border-border px-3 text-xs font-bold text-foreground"
          >
            التالي
          </button>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-border bg-background/85 px-2 py-1 text-center text-[8px] text-muted-foreground backdrop-blur">
        Bryl Lim / Everkinetic · ترخيص CC BY-SA 4.0
      </div>
    </div>
  );
}

export const AthleteVideo = ExerciseMediaPlayer;
