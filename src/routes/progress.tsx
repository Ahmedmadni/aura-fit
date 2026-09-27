import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { TrendingDown, TrendingUp, Target, Calendar, Trophy } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell, PageHeader } from "@/components/page-shell";
import { getExercise } from "@/lib/exercise-db";
import { dailyExerciseBests, loadHistory } from "@/lib/user-profile";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "التقدم اليومي | كينيتك" },
      { name: "description", content: "تابع أفضل مجموعة يومية وأرقامك القياسية في تمارين كينيتك." },
      { property: "og:title", content: "التقدم اليومي | كينيتك" },
      { property: "og:description", content: "تقرير يومي لأفضل مجموعة في كل تمرين." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Progress,
});

const weightPoints = [78, 77.5, 77.2, 76.8, 76.5, 76.2, 76];
const habits = [
  { name: "تدريب", done: 5, target: 6 },
  { name: "شرب الماء", done: 7, target: 8 },
  { name: "نوم ٧س+", done: 5, target: 7 },
  { name: "تأمل", done: 3, target: 5 },
];

function Progress() {
  const [selectedDay, setSelectedDay] = useState(() => localDateKey(new Date()));
  const history = useMemo(() => loadHistory(), []);
  const dailyBests = useMemo(
    () => dailyExerciseBests(history, selectedDay),
    [history, selectedDay],
  );
  const min = Math.min(...weightPoints);
  const max = Math.max(...weightPoints);
  return (
    <PageShell>
      <PageHeader
        eyebrow="التحليلات"
        title={"تقدمك\nخلال الوقت"}
        action={
          <button
            type="button"
            className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground"
            aria-label="التقويم"
          >
            <Calendar className="size-4" />
          </button>
        }
      />

      <section className="relative px-6 mb-6 animate-enter [animation-delay:80ms]">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">تقرير اليوم</p>
            <h2 className="mt-1 text-xl font-black">أفضل مجموعة لكل تمرين</h2>
          </div>
          <label className="sr-only" htmlFor="progress-day">اختر اليوم</label>
          <input
            id="progress-day"
            type="date"
            value={selectedDay}
            max={localDateKey(new Date())}
            onChange={(event) => setSelectedDay(event.target.value)}
            className="h-10 max-w-36 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          />
        </div>
        {dailyBests.length ? (
          <div className="divide-y divide-border rounded-2xl border border-border bg-surface/60">
            {dailyBests.map((item) => {
              const exercise = getExercise(item.exerciseId);
              const change = item.previousBest === null ? null : item.bestSet - item.previousBest;
              return (
                <div key={item.exerciseId} className="flex items-center gap-3 p-4">
                  <div className={`grid size-10 shrink-0 place-items-center rounded-full ${item.isPersonalBest ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Trophy className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{exercise?.name ?? item.exerciseId}</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">{item.totalSets} مجموعات مسجلة</p>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-black tabular-nums">{item.bestSet}</p>
                    <p className={`text-[10px] font-bold ${item.isPersonalBest ? "text-primary" : "text-muted-foreground"}`}>
                      {item.previousBest === null ? "أول تسجيل" : item.isPersonalBest ? `رقم جديد +${change}` : `السابق ${item.previousBest}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
            <Target className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-bold">لا توجد مجموعات مسجلة في هذا اليوم</p>
            <p className="mt-1 text-xs text-muted-foreground">أكمل جلسة وسجّل تكراراتك لتظهر هنا.</p>
          </div>
        )}
      </section>

      {/* Score cards */}
      <section className="relative px-6 mb-6 grid grid-cols-2 gap-3 animate-enter [animation-delay:100ms]">
        <ScoreCard label="نقاط اللياقة" value="847" delta="+23" up />
        <ScoreCard label="نقاط الصحة" value="92" delta="+4" up />
      </section>

      {/* Weight chart */}
      <section className="relative px-6 mb-6 animate-enter [animation-delay:200ms]">
        <div className="bg-surface border border-border rounded-3xl p-5 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                الوزن · ٧ أيام
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black" dir="ltr">
                  76.0
                </span>
                <span className="text-xs text-muted-foreground">كجم</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-primary font-bold bg-primary/10 px-2 py-1 rounded-full">
              <TrendingDown className="size-3" /> -٢.٠ كجم
            </span>
          </div>
          <svg viewBox="0 0 300 100" className="w-full h-24">
            <defs>
              <linearGradient id="wg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 100 ${weightPoints
                .map((v, i) => {
                  const x = (i / (weightPoints.length - 1)) * 300;
                  const y = 100 - ((v - min) / (max - min || 1)) * 80 - 10;
                  return `L ${x} ${y}`;
                })
                .join(" ")} L 300 100 Z`}
              fill="url(#wg)"
            />
            <path
              d={weightPoints
                .map((v, i) => {
                  const x = (i / (weightPoints.length - 1)) * 300;
                  const y = 100 - ((v - min) / (max - min || 1)) * 80 - 10;
                  return `${i === 0 ? "M" : "L"} ${x} ${y}`;
                })
                .join(" ")}
              fill="none"
              stroke="var(--brand)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 6px rgba(204,255,0,0.5))" }}
            />
          </svg>
        </div>
      </section>

      {/* Body measurements */}
      <section className="relative px-6 mb-6 animate-enter [animation-delay:300ms]">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
          قياسات الجسم
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <MeasureCard label="خصر" value="82" unit="سم" delta="-3" />
          <MeasureCard label="صدر" value="102" unit="سم" delta="+2" up />
          <MeasureCard label="ذراع" value="36" unit="سم" delta="+1" up />
        </div>
      </section>

      {/* Habits */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:400ms]">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-3">
          العادات هذا الأسبوع
        </h3>
        <div className="bg-surface border border-border rounded-2xl divide-y divide-border backdrop-blur-xl">
          {habits.map((h) => {
            const pct = (h.done / h.target) * 100;
            return (
              <div key={h.name} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">{h.name}</span>
                  <span className="text-xs font-mono text-muted-foreground" dir="ltr">
                    {h.done}/{h.target}
                  </span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden" dir="ltr">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ScoreCard({
  label,
  value,
  delta,
  up,
}: {
  label: string;
  value: string;
  delta: string;
  up?: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-4 backdrop-blur-xl">
      <div className="flex items-center gap-1 text-muted-foreground mb-2">
        <Target className="size-3" />
        <p className="text-[10px] font-mono uppercase tracking-widest">{label}</p>
      </div>
      <p className="text-3xl font-black leading-none mb-2" dir="ltr">
        {value}
      </p>
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-bold ${
          up ? "text-primary" : "text-cyan"
        }`}
      >
        {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
        {delta}
      </span>
    </div>
  );
}

function MeasureCard({
  label,
  value,
  unit,
  delta,
  up,
}: {
  label: string;
  value: string;
  unit: string;
  delta: string;
  up?: boolean;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-3 backdrop-blur-xl">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black" dir="ltr">
          {value}
        </span>
        <span className="text-[10px] text-muted-foreground">{unit}</span>
      </div>
      <span className={`text-[10px] font-bold ${up ? "text-primary" : "text-cyan"}`} dir="ltr">
        {delta}
      </span>
    </div>
  );
}
