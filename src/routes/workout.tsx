import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/workout")({
  component: WorkoutPlayer,
});

type Exercise = {
  name: string;
  latin: string;
  duration: number; // seconds
  reps?: string;
  rest: number;
  cue: string;
  muscles: string;
};

const EXERCISES: Exercise[] = [
  { name: "إحماء ديناميكي", latin: "Dynamic Warm-up", duration: 45, rest: 10, cue: "حرّك المفاصل وارفع النبض تدريجياً", muscles: "الجسم كامل" },
  { name: "قرفصاء هوائية", latin: "Air Squat", duration: 40, reps: "16 عدة", rest: 20, cue: "الظهر مستقيم، الوزن على الكعب", muscles: "الرجل الأمامية · الأرداف" },
  { name: "تمرين الضغط", latin: "Push-up", duration: 40, reps: "12 عدة", rest: 25, cue: "شدّ البطن، اهبط ببطء 3 ثواني", muscles: "الصدر · الترايسبس" },
  { name: "بلانك متحرك", latin: "Plank Shoulder Tap", duration: 35, rest: 20, cue: "الحوض ثابت، لا تدع الوركين يتأرجحان", muscles: "الكور · الأكتاف" },
  { name: "قفزة عمودية", latin: "Jump Squat", duration: 30, reps: "10 عدة", rest: 30, cue: "هبوط ناعم، ادفع من منتصف القدم", muscles: "الرجل · التفجير" },
  { name: "تمدد ختامي", latin: "Cool Down", duration: 60, rest: 0, cue: "تنفس عميق واسترخِ", muscles: "المرونة" },
];

function WorkoutPlayer() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"work" | "rest" | "done">("work");
  const [remaining, setRemaining] = useState(EXERCISES[0].duration);
  const [running, setRunning] = useState(true);
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

  useEffect(() => {
    if (!running || phase === "done") return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r > 1) return r - 1;
        // transition
        if (phase === "work") {
          if (current.rest > 0) {
            setPhase("rest");
            return current.rest;
          }
        }
        // move next
        if (index + 1 < total) {
          setIndex((i) => i + 1);
          setPhase("work");
          return EXERCISES[index + 1].duration;
        }
        setPhase("done");
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
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-3">اكتملت الجلسة</p>
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
            <Link to="/" className="block rounded-2xl border border-border py-4 font-bold text-muted-foreground">
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

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
            <p className="font-mono text-xs mt-0.5">{fmt(elapsed)} · {fmt(totalDuration - elapsed)}</p>
          </div>
          <button
            onClick={() => setRunning((r) => !r)}
            className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center"
            aria-label="إيقاف مؤقت"
          >
            {running ? "⏸" : "▶"}
          </button>
        </div>

        {/* progress bar */}
        <div className="h-1 rounded-full bg-surface overflow-hidden mb-8">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* ring */}
        <div className="relative mx-auto" style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} stroke="hsl(var(--surface))" strokeWidth={stroke} fill="none" />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={phase === "rest" ? "oklch(0.75 0.15 200)" : "oklch(0.9 0.2 130)"}
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
                {phase === "rest" ? "استراحة" : "نشاط"}
              </p>
              <p className="text-6xl font-black font-mono leading-none tabular-nums">
                {fmt(remaining)}
              </p>
              {current.reps && phase === "work" && (
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
        </div>

        {/* next */}
        {next && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
            <div className="size-10 rounded-xl bg-primary/20 grid place-items-center text-primary font-mono">
              {index + 2}
            </div>
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">التالي</p>
              <p className="font-bold text-sm">{next.name}</p>
            </div>
            <button
              onClick={() => {
                setIndex(index + 1);
                setPhase("work");
                setRemaining(next.duration);
              }}
              className="text-xs font-mono text-primary"
            >
              تخطي ↩
            </button>
          </div>
        )}
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
