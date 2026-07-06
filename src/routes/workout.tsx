import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Volume2, VolumeX } from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { AnimatedAthlete } from "@/components/athlete-animated";
import {
  primeAudio,
  setSfxEnabled,
  sfxDone,
  sfxGo,
  sfxRest,
  sfxTick,
} from "@/lib/workout-audio";

export const Route = createFileRoute("/workout")({
  component: WorkoutPlayer,
});

type Pose = "warmup" | "squat" | "push-up" | "plank" | "burpee" | "cooldown";

type Exercise = {
  name: string;
  latin: string;
  duration: number;
  reps?: string;
  rest: number;
  cue: string;
  muscles: string;
  pose: Pose;
  tempo: number; // seconds per rep cycle
  ref: string; // scientific/organizational reference
};

/**
 * Session structure follows the ACSM FITT-VP guidelines for a 30-min
 * general-fitness circuit: 5-10 min dynamic warm-up, 20 min of resistance
 * / HIIT circuits with 1:1 to 1:2 work-rest ratios, 5 min cool-down.
 *
 * Rep schemes and rest intervals per exercise reference:
 *  - ACSM's Guidelines for Exercise Testing and Prescription (11th ed., 2021)
 *  - NSCA Essentials of Strength Training and Conditioning (4th ed., 2016)
 *  - NASM Essentials of Personal Fitness Training (7th ed., 2022)
 *  - WHO Guidelines on Physical Activity and Sedentary Behaviour (2020)
 */
const EXERCISES: Exercise[] = [
  {
    name: "إحماء ديناميكي",
    latin: "Dynamic Warm-up (RAMP protocol)",
    duration: 45,
    rest: 10,
    cue: "ارفع النبض تدريجياً عبر حركات مركّبة — راجع بروتوكول RAMP (Jeffreys, 2006)",
    muscles: "الجسم كامل",
    pose: "warmup",
    tempo: 1.4,
    ref: "Jeffreys I. (2006) — Warm-up revisited: the RAMP method.",
  },
  {
    name: "قرفصاء هوائية",
    latin: "Bodyweight Squat",
    duration: 40,
    reps: "16 عدة",
    rest: 20,
    cue: "الكعبان على الأرض، الركبتان بمحاذاة أصابع القدم، صدرك مرفوع",
    muscles: "الفخذ الأمامي · المؤخرة",
    pose: "squat",
    tempo: 2.5,
    ref: "NSCA Essentials of Strength Training & Conditioning, 4th ed., ch. 15.",
  },
  {
    name: "تمرين الضغط",
    latin: "Standard Push-Up",
    duration: 40,
    reps: "12 عدة",
    rest: 25,
    cue: "الجسم خط مستقيم، المرفقان بزاوية 45°، نزول متحكم بمدى 3 ثواني",
    muscles: "الصدر · الترايسبس",
    pose: "push-up",
    tempo: 3,
    ref: "ACSM Guidelines, 11th ed., §7 — Resistance training for healthy adults.",
  },
  {
    name: "بلانك أمامي",
    latin: "Prone Forearm Plank",
    duration: 35,
    rest: 20,
    cue: "شدّ عضلات البطن والمؤخرة، الوركان ثابتان — انتهِ عند فقدان الاستقامة",
    muscles: "الكور · الأكتاف",
    pose: "plank",
    tempo: 4,
    ref: "McGill S. — Ultimate Back Fitness and Performance, 5th ed.",
  },
  {
    name: "قفزة عمودية",
    latin: "Bodyweight Jump Squat",
    duration: 30,
    reps: "10 عدة",
    rest: 30,
    cue: "هبوط ناعم من الأمشاط للكعب، امتصاص الصدمة بثني الركبتين والوركين",
    muscles: "الرجل · التفجير",
    pose: "burpee",
    tempo: 2,
    ref: "NSCA Position Statement — Plyometric Training (Haff & Triplett, 2016).",
  },
  {
    name: "تمدد ختامي",
    latin: "Static Cool-Down Stretch",
    duration: 60,
    rest: 0,
    cue: "تنفس عميق من الأنف، ثبّت كل وضعية 20-30 ثانية دون ارتداد",
    muscles: "المرونة العامة",
    pose: "cooldown",
    tempo: 5,
    ref: "ACSM Position Stand — Quantity & Quality of Exercise (Garber et al., 2011).",
  },
];

function WorkoutPlayer() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"work" | "rest" | "done">("work");
  const [remaining, setRemaining] = useState(EXERCISES[0].duration);
  const [running, setRunning] = useState(true);
  const [muted, setMuted] = useState(false);
  const [showRefs, setShowRefs] = useState(false);
  const startedAt = useRef(Date.now());

  const current = EXERCISES[index];
  const next = EXERCISES[index + 1];
  const total = EXERCISES.length;
  const progress = ((index + (phase === "rest" ? 0.5 : 0)) / total) * 100;

  const totalDuration = useMemo(
    () => EXERCISES.reduce((s, e) => s + e.duration + e.rest, 0),
    [],
  );
  const [elapsed, setElapsed] = useState(0);

  // prime audio on mount + play initial "go"
  useEffect(() => {
    primeAudio();
    sfxGo();
  }, []);

  useEffect(() => {
    setSfxEnabled(!muted);
  }, [muted]);

  useEffect(() => {
    if (!running || phase === "done") return;
    const id = setInterval(() => {
      setRemaining((r) => {
        // countdown ticks
        if (r <= 4 && r > 1) sfxTick();

        if (r > 1) return r - 1;
        // transition
        if (phase === "work") {
          if (current.rest > 0) {
            setPhase("rest");
            sfxRest();
            return current.rest;
          }
        }
        // move next
        if (index + 1 < total) {
          setIndex((i) => i + 1);
          setPhase("work");
          sfxGo();
          return EXERCISES[index + 1].duration;
        }
        setPhase("done");
        sfxDone();
        return 0;
      });
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase, index, current.rest, total]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const ringSize = 240;
  const stroke = 10;
  const radius = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const phaseTotal = phase === "rest" ? current.rest : current.duration;
  const ringOffset = circ - (remaining / phaseTotal) * circ;

  if (phase === "done") {
    const minutes = Math.round(elapsed / 60);
    return (
      <PageShell>
        <div className="p-6 pt-16 text-center animate-enter">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-3">
            اكتملت الجلسة
          </p>
          <h1 className="text-5xl font-black leading-none mb-2">أحسنت</h1>
          <p className="text-muted-foreground">أتممت التمرين بنجاح</p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <StatCard label="المدة" value={`${minutes}د`} />
            <StatCard label="التمارين" value={String(total)} />
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
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate({ to: "/" })}
            className="size-10 rounded-full border border-border grid place-items-center text-lg"
            aria-label="إغلاق"
          >
            ✕
          </button>
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              الجلسة {index + 1} / {total}
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
        <div className="h-1 rounded-full bg-surface overflow-hidden mb-6">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Animated athlete */}
        <div className="relative mx-auto mb-4 rounded-3xl border border-border bg-surface/40 overflow-hidden">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(204,255,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(204,255,0,0.12) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            aria-hidden
          />
          <div className="relative grid place-items-center py-2">
            <AnimatedAthlete
              pose={isRest ? "cooldown" : current.pose}
              running={running && !isRest}
              tempo={current.tempo}
              size={260}
            />
          </div>
        </div>

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
              {current.reps && !isRest && (
                <p className="mt-2 text-xs font-mono text-primary">{current.reps}</p>
              )}
            </div>
          </div>
        </div>

        {/* exercise info */}
        <div className="mt-8 rounded-3xl bg-surface/60 backdrop-blur border border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            {current.latin}
          </p>
          <h2 className="text-2xl font-black mb-2">{current.name}</h2>
          <p className="text-xs text-muted-foreground mb-3">{current.muscles}</p>
          <div className="border-t border-border pt-3">
            <p className="text-sm leading-relaxed">
              <span className="text-primary font-bold">تنبيه المدرب: </span>
              {current.cue}
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
              {current.ref}
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
              <p className="font-bold text-sm">{next.name}</p>
            </div>
            <button
              onClick={() => {
                setIndex(index + 1);
                setPhase("work");
                setRemaining(next.duration);
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
          البروتوكول مبني على ACSM · NSCA · NASM · WHO
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
