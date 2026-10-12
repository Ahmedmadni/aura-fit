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
  const [posterFailed, setPosterFailed] = useState(false);
  const [framesFailed, setFramesFailed] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [frameReviewPaused, setFrameReviewPaused] = useState(false);

  const intervalMs = useMemo(
    () => Math.max(280, Math.round((tempo * 1000) / 3)),
    [tempo],
  );

  useEffect(() => {
    setFrameIndex(0);
    setPreferredFailed(false);
    setPosterFailed(false);
    setFramesFailed(false);
    setRetryVersion(0);
    setFrameReviewPaused(false);
  }, [exerciseId, preferredGif, poster]);

  function retryMedia() {
    setFrameIndex(0);
    setPreferredFailed(false);
    setPosterFailed(false);
    setFramesFailed(false);
    setFrameReviewPaused(false);
    // Force the exact same external URL to be requested again.
    setRetryVersion((version) => version + 1);
  }

  useEffect(() => {
    // A failed request while disconnected should become retryable as soon as
    // the browser goes back online. No polling / network request when offline.
    const reconnect = () => retryMedia();
    window.addEventListener("online", reconnect);
    return () => window.removeEventListener("online", reconnect);
  }, []);

  // A failed static poster must NOT disable the approved animated GIF.
  const usingFallback =
    !preferredGif || preferredFailed || (!running && (!poster || posterFailed));
  const autoAdvanceFrames = running && !(allowFrameReview && frameReviewPaused);

  useEffect(() => {
    if (!autoAdvanceFrames || !usingFallback || !frames?.length || framesFailed) return;
    const timer = window.setInterval(
      () => setFrameIndex((current) => (current + 1) % frames.length),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [autoAdvanceFrames, frames, intervalMs, usingFallback, framesFailed]);

  useEffect(() => {
    if (!autoAdvanceFrames || !usingFallback || !frames?.length || framesFailed) return;
    const nextFrame = frames[(frameIndex + 1) % frames.length];
    if (!nextFrame || nextFrame === frames[frameIndex]) return;

    const image = new Image();
    image.src = nextFrame;
  }, [autoAdvanceFrames, frameIndex, frames, usingFallback, framesFailed]);

  const containerStyle = fluid
    ? { width: "100%", aspectRatio: "1 / 1" }
    : { width: size, height: size };

  if (!usingFallback && preferredGif) {
    const source = running ? preferredGif : poster;
    return (
      <div
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background"
        style={containerStyle}
        data-exercise-media-mode={running ? "approved-gif" : "approved-poster"}
      >
        <img
          key={(running ? "gif" : "poster") + retryVersion}
          src={source}
          alt={"حركة مطابقة لتمرين " + (exercise?.latin ?? "")}
          loading="lazy"
          decoding="async"
          onError={() => {
            if (running) setPreferredFailed(true);
            else setPosterFailed(true);
          }}
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

  if (!frames?.length || framesFailed) {
    // A generic pose is not a verified demonstration of this specific
    // exercise. State that clearly instead of leaving a broken image.
    return (
      <div
        data-exercise-media-mode="generic"
        data-media-retry={retryVersion}
        role="status"
        className="relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border border-amber-400/30 bg-background p-3 text-center"
        style={containerStyle}
      >
        <div className="min-h-0 w-full flex-1 overflow-hidden" aria-hidden="true">
          <AnimatedAthlete pose={pose} running={running} tempo={tempo} size={fluid ? 220 : Math.min(size, 260)} />
        </div>
        <p className="text-[11px] font-semibold leading-5 text-amber-300">
          تعذر تحميل صور التمرين الأصلية. هذا رسم توضيحي عام، وليس عرضًا دقيقًا للحركة.
        </p>
        <button
          type="button"
          onClick={retryMedia}
          aria-label="إعادة محاولة تحميل صور التمرين"
          className="min-h-9 rounded-lg border border-amber-400/40 px-3 text-xs font-bold text-foreground"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-primary/20 bg-background"
      data-fallback-frame-index={allowFrameReview ? frameIndex + 1 : undefined}
      data-exercise-media-mode="frame"
      data-media-retry={retryVersion}
      style={containerStyle}
    >
      <img
        key={frames[frameIndex] + ":" + retryVersion}
        src={frames[frameIndex]}
        alt={"إطار توضيحي مطابق لتمرين " + (exercise?.latin ?? "")}
        loading="lazy"
        decoding="async"
        onError={() => setFramesFailed(true)}
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
      {preferredFailed && (
        <button
          type="button"
          aria-label="إعادة محاولة فيديو التمرين"
          onClick={retryMedia}
          className="absolute inset-x-2 top-10 z-10 min-h-9 rounded-lg border border-amber-400/40 bg-background/90 px-3 text-xs font-bold text-foreground"
        >
          تعذر تحميل GIF — إعادة المحاولة
        </button>
      )}
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
