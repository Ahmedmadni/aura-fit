import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Volume2, VolumeX, ChevronRight, ChevronLeft, Check } from "lucide-react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { PageShell } from "@/components/page-shell";
import { AthleteVideo } from "@/components/athlete-video";
import {
  primeAudio,
  setSfxEnabled,
  sfxDone,
  sfxGo,
  sfxRest,
  sfxTick,
} from "@/lib/workout-audio";
import { generateWorkout, type PlannedExercise } from "@/lib/workout-engine";
import { loadProfile, recordWorkout } from "@/lib/user-profile";
import { checkNewAchievements } from "@/lib/achievements";

export const Route = createFileRoute("/workout")({
  component: WorkoutPlayer,
});

function WorkoutPlayer() {
  const navigate = useNavigate();

  // build the workout from profile (memoized so it stays stable during the session)
  const workout = useMemo(() => generateWorkout(loadProfile()), []);
  const plan = workout.exercises;

  const [index, setIndex] = useState(0);
  const [setIdx, setSetIdx] = useState(1); // 1-based current set
  const [phase, setPhase] = useState<"work" | "rest" | "done">("work");
  const [remaining, setRemaining] = useState(plan[0]?.workSeconds ?? 45);
  const [running, setRunning] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showRefs, setShowRefs] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const startedAt = useRef(Date.now());

  const current: PlannedExercise = plan[index];
  const next = plan[index + 1];
  const total = plan.length;

  const totalDuration = useMemo(
    () =>
      plan.reduce(
        (s, p) => s + p.workSeconds * p.sets + p.restSeconds * Math.max(0, p.sets - 1),
        0,
      ),
    [plan],
  );
  const [elapsed, setElapsed] = useState(0);

  const progress =
    ((index + (setIdx - 1) / current.sets + (phase === "rest" ? 0.5 / current.sets : 0)) / total) *
    100;

  useEffect(() => {
    primeAudio();
    sfxGo();
  }, []);

  useEffect(() => {
    setSfxEnabled(!muted);
  }, [muted]);

  // main timer
  useEffect(() => {
    if (!running || phase === "done") return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 4 && r > 1) sfxTick();
        if (r > 1) return r - 1;

        // transition logic
        if (phase === "work") {
          if (setIdx < current.sets && current.restSeconds > 0) {
            setPhase("rest");
            sfxRest();
            return current.restSeconds;
          }
          // move to next exercise
          setCompleted((s) => new Set(s).add(current.exercise.id));
          if (index + 1 < total) {
            setIndex((i) => i + 1);
            setSetIdx(1);
            setPhase("work");
            sfxGo();
            return plan[index + 1].workSeconds;
          }
          setPhase("done");
          sfxDone();
          return 0;
        }
        // rest → next set of same exercise
        setSetIdx((s) => s + 1);
        setPhase("work");
        sfxGo();
        return current.workSeconds;
      });
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase, index, setIdx, current, total, plan]);

  // save on completion
  useEffect(() => {
    if (phase !== "done") return;
    const durationSec = Math.round((Date.now() - startedAt.current) / 1000);
    const calories = Math.round(
      plan.reduce(
        (s, p) =>
          completed.has(p.exercise.id)
            ? s + (p.exercise.caloriesPerMin * p.workSeconds * p.sets) / 60
            : s,
        0,
      ),
    );
    const activeSec = plan.reduce(
      (s, p) => (completed.has(p.exercise.id) ? s + p.workSeconds * p.sets : s),
      0,
    );
    recordWorkout({
      id: workout.id + "-" + Date.now(),
      date: new Date().toISOString(),
      exercises: plan.map((p) => ({
        id: p.exercise.id,
        sets: p.sets,
        reps: p.reps,
        completed: completed.has(p.exercise.id),
      })),
      durationSec,
      activeSec,
      calories,
      intensity: workout.intensity,
      performance: Math.round((completed.size / total) * 100),
    });
    checkNewAchievements([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const ringSize = 240;
  const stroke = 10;
  const radius = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const phaseTotal = phase === "rest" ? current.restSeconds : current.workSeconds;
  const ringOffset = circ - (remaining / phaseTotal) * circ;

  function handleSwipe(_: unknown, info: PanInfo) {
    if (info.offset.x > 80 && index > 0) {
      // swipe right in RTL = previous
      setIndex(index - 1);
      setSetIdx(1);
      setPhase("work");
      setRemaining(plan[index - 1].workSeconds);
      sfxGo();
    } else if (info.offset.x < -80 && next) {
      // swipe left in RTL = next
      setCompleted((s) => new Set(s).add(current.exercise.id));
      setIndex(index + 1);
      setSetIdx(1);
      setPhase("work");
      setRemaining(next.workSeconds);
      sfxGo();
    }
  }

  if (phase === "done") {
    const minutes = Math.round(elapsed / 60);
    return (
      <PageShell>
        <div className="p-6 pt-16 text-center animate-enter">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-3">
            اكتملت الجلسة
          </p>
          <h1 className="text-5xl font-black leading-none mb-2">أحسنت</h1>
          <p className="text-muted-foreground">
            أتممت {completed.size} من {total} تمارين
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <StatCard label="المدة" value={`${minutes}د`} />
            <StatCard label="التمارين" value={String(completed.size)} />
            <StatCard label="السعرات" value={`~${minutes * 8}`} />
          </div>

          <div className="mt-10 space-y-3">
            <Link
              to="/progress"
              className="block rounded-2xl bg-primary text-primary-foreground py-4 font-black uppercase tracking-widest"
            >
              حفظ ومتابعة التقدم
            </Link>
            <Link
              to="/"
              className="block rounded-2xl border border-border py-4 font-bold text-muted-foreground"
            >
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const isRest = phase === "rest";

  return (
    <PageShell>
      <div className="p-5 pt-8">
        {/* top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate({ to: "/" })}
            className="size-10 rounded-full border border-border grid place-items-center text-lg"
            aria-label="إغلاق"
          >
            ✕
          </button>
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {index + 1} / {total} · مجموعة {setIdx} / {current.sets}
            </p>
            <p className="font-mono text-xs mt-0.5">
              {fmt(elapsed)} · {fmt(Math.max(0, totalDuration - elapsed))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMuted((m) => !m)}
              className="size-10 rounded-full border border-border grid place-items-center"
              aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
              type="button"
            >
              {muted ? (
                <VolumeX className="size-4 text-muted-foreground" />
              ) : (
                <Volume2 className="size-4 text-primary" />
              )}
            </button>
            <button
              onClick={() => {
                if (!running) primeAudio();
                setRunning((r) => !r);
              }}
              className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center"
              aria-label="إيقاف مؤقت"
              type="button"
            >
              {running ? "⏸" : "▶"}
            </button>
          </div>
        </div>

        {/* progress bar */}
        <div className="h-1 rounded-full bg-surface overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* set dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {Array.from({ length: current.sets }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i + 1 < setIdx
                  ? "bg-primary w-6"
                  : i + 1 === setIdx
                    ? "bg-primary w-8 animate-pulse"
                    : "bg-surface w-6"
              }`}
            />
          ))}
        </div>

        {/* Athlete + swipe */}
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleSwipe}
          className="relative mx-auto mb-4 rounded-3xl border border-border bg-surface/40 overflow-hidden cursor-grab active:cursor-grabbing"
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(204,255,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(204,255,0,0.12) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            aria-hidden
          />
          <div className="relative grid place-items-center py-2 min-h-[240px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${index}-${isRest ? "rest" : "work"}`}
                initial={{ opacity: 0, scale: 0.9, filter: "blur(6px)" }}
                animate={{
                  opacity: 1,
                  scale: running && !isRest ? 1 : 0.97,
                  filter: "blur(0px)",
                }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <AthleteVideo
                  exerciseId={current.exercise.id}
                  pose={isRest ? "cooldown" : current.exercise.pose}
                  running={running && !isRest}
                  tempo={current.exercise.tempo}
                  size={260}
                />
              </motion.div>
            </AnimatePresence>
            {running && !isRest && (
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-primary/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.15, 0.55, 0.15] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />
            )}
            {/* swipe hint arrows */}
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-30">
              <ChevronRight className="size-5" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center opacity-30">
              <ChevronLeft className="size-5" />
            </div>
          </div>
        </motion.div>

        {/* Breathing guide during rest */}
        {isRest && (
          <div className="text-center mb-2">
            <motion.div
              className="mx-auto rounded-full bg-cyan/20 border border-cyan/40"
              animate={{ scale: [1, 1.5, 1.5, 1], opacity: [0.5, 1, 1, 0.5] }}
              transition={{ duration: 8, repeat: Infinity, times: [0, 0.375, 0.625, 1] }}
              style={{ width: 60, height: 60 }}
            />
            <p className="text-xs font-mono uppercase tracking-widest text-cyan mt-2">
              شهيق ٤ · ثبات ٤ · زفير ٤
            </p>
          </div>
        )}

        {/* ring */}
        <div className="relative mx-auto" style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="hsl(var(--surface))"
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={isRest ? "oklch(0.75 0.15 200)" : "oklch(0.9 0.2 130)"}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              style={{ filter: "drop-shadow(0 0 12px oklch(0.9 0.2 130 / 0.5))" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                {isRest ? "استراحة" : "نشاط"}
              </p>
              <p
                className={`text-6xl font-black font-mono leading-none tabular-nums ${
                  remaining <= 3 && !isRest ? "text-primary animate-pulse" : ""
                }`}
              >
                {fmt(remaining)}
              </p>
              {!isRest && (
                <p className="mt-2 text-xs font-mono text-primary">{current.reps}</p>
              )}
            </div>
          </div>
        </div>

        {/* exercise info */}
        <div className="mt-8 rounded-3xl bg-surface/60 backdrop-blur border border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            {current.exercise.latin}
          </p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">{current.exercise.name}</h2>
            {completed.has(current.exercise.id) && (
              <span className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center">
                <Check className="size-4" strokeWidth={3} />
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-3">{current.exercise.primary.join(" · ")}</p>
          <div className="border-t border-border pt-3">
            <p className="text-sm leading-relaxed">
              <span className="text-primary font-bold">تنبيه المدرب: </span>
              {current.exercise.cue}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowRefs((s) => !s)}
            className="mt-4 w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="size-3" />
              المرجع العلمي
            </span>
            <span>{showRefs ? "−" : "+"}</span>
          </button>
          {showRefs && (
            <p className="mt-2 text-[11px] leading-relaxed text-foreground/80 border-r-2 border-primary/60 pr-3">
              {current.exercise.reference}
            </p>
          )}
        </div>

        {/* next */}
        {next && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
            <div className="size-10 rounded-xl bg-primary/20 grid place-items-center text-primary font-mono">
              {index + 2}
            </div>
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                التالي
              </p>
              <p className="font-bold text-sm">{next.exercise.name}</p>
            </div>
            <button
              onClick={() => {
                setCompleted((s) => new Set(s).add(current.exercise.id));
                setIndex(index + 1);
                setSetIdx(1);
                setPhase("work");
                setRemaining(next.workSeconds);
                sfxGo();
              }}
              className="text-xs font-mono text-primary"
              type="button"
            >
              تخطي ↩
            </button>
          </div>
        )}

        {/* protocol footer */}
        <p className="mt-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center leading-relaxed">
          البروتوكول مبني على ACSM · NSCA · NASM · WHO · اسحب يميناً/يساراً للتنقل
        </p>
      </div>
    </PageShell>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface/60 border border-border p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-2xl font-black font-mono">{value}</p>
    </div>
  );
}
