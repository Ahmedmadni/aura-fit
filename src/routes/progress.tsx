import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Calendar,
  Dumbbell,
  Minus,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell, PageHeader } from "@/components/page-shell";
import { getExercise } from "@/lib/exercise-db";
import {
  DEFAULT_PROFILE,
  dailyExerciseBests,
  exerciseStrengthAnalyses,
  loadHistory,
  loadProfile,
  loadTodayReadiness,
  type CompletedWorkout,
  type DailyReadinessCheckIn,
  type UserProfile,
} from "@/lib/user-profile";
import {
  PERIODIZATION_PHASE_LABEL_AR,
  generateWeeklyPlan,
  getTrainingAdaptation,
} from "@/lib/workout-engine";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "تحليل القوة والتقدم | Aura Fit" },
      {
        name: "description",
        content:
          "تابع التكرارات والأحمال وRIR وe1RM واتجاه القوة من سجل تدريبك الفعلي.",
      },
      { property: "og:title", content: "تحليل القوة والتقدم | Aura Fit" },
      {
        property: "og:description",
        content: "تحليل ديناميكي للأحمال والقوة والأرقام الشخصية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Progress,
});

function Progress() {
  const [selectedDay, setSelectedDay] = useState(() =>
    localDateKey(new Date()),
  );
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [readinessCheckIn, setReadinessCheckIn] =
    useState<DailyReadinessCheckIn>();

  useEffect(() => {
    setHistory(loadHistory());
    setProfile(loadProfile());
    setReadinessCheckIn(loadTodayReadiness());
  }, []);
  const adaptation = useMemo(
    () => getTrainingAdaptation(profile, history, readinessCheckIn),
    [profile, history, readinessCheckIn],
  );
  const strength = useMemo(
    () => exerciseStrengthAnalyses(history),
    [history],
  );
  const currentPeriodization = useMemo(
    () =>
      generateWeeklyPlan(profile, history, readinessCheckIn)[0]
        ?.periodization,
    [profile, history, readinessCheckIn],
  );
  const dailyBests = useMemo(
    () => dailyExerciseBests(history, selectedDay),
    [history, selectedDay],
  );

  const recentPrs = strength.filter(
    (item) =>
      item.sessions > 1 &&
      (item.latestLoadIsPr || item.latestEstimated1RmIsPr),
  ).length;
  const plateaus = strength.filter((item) => item.plateau).length;
  const totalLoadVolume = strength.reduce(
    (sum, item) => sum + item.totalLoadVolumeKgReps,
    0,
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="التحليلات الفعلية"
        title={"قوتك\nخلال الوقت"}
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

      <section className="relative px-6 mb-6 grid grid-cols-2 gap-3 animate-enter">
        <SummaryCard
          icon={Activity}
          label="جلسات مسجلة"
          value={String(history.length)}
        />
        <SummaryCard
          icon={Dumbbell}
          label="تمارين بأحمال"
          value={String(strength.length)}
        />
        <SummaryCard
          icon={Trophy}
          label="PR حديثة"
          value={String(recentPrs)}
          accent={recentPrs > 0}
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Plateau"
          value={String(plateaus)}
          warn={plateaus > 0}
        />
      </section>

      <section className="relative px-6 mb-6 animate-enter [animation-delay:60ms]">
        <div
          className={
            "rounded-2xl border p-4 " +
            (adaptation.mode === "progress"
              ? "border-primary/30 bg-primary/10"
              : adaptation.mode === "recovery"
                ? "border-cyan/30 bg-cyan/10"
                : "border-border bg-surface/60")
          }
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                استجابة البرنامج
              </p>
              <h3 className="mt-1 text-lg font-black">
                {adaptation.mode === "progress"
                  ? "جاهز للتقدم"
                  : adaptation.mode === "recovery"
                    ? "الأولوية للاستشفاء"
                    : "ثبات وبناء تدريجي"}
              </h3>
            </div>
            <div className="text-left">
              <p className="font-mono text-2xl font-black">
                {adaptation.readinessScore}%
              </p>
              <p className="text-[9px] text-muted-foreground">جاهزية</p>
            </div>
          </div>

          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {adaptation.reason}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3">
            <MiniMetric
              label="الأداء"
              value={adaptation.recentPerformance + "%"}
            />
            <MiniMetric
              label="RIR حديث"
              value={
                adaptation.recentAverageRir === null
                  ? "—"
                  : String(adaptation.recentAverageRir)
              }
            />
            <MiniMetric
              label="جلسات محللة"
              value={String(adaptation.recentSessions)}
            />
          </div>
        </div>
      </section>

      {currentPeriodization && (
        <section className="relative px-6 mb-6 animate-enter [animation-delay:70ms]">
          <div
            className={
              "rounded-2xl border p-4 " +
              (currentPeriodization.phase === "deload"
                ? "border-cyan/30 bg-cyan/5"
                : "border-primary/25 bg-primary/5")
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  الدورة الحالية · {currentPeriodization.cycleWeek}/4
                </p>
                <h3 className="mt-1 text-lg font-black">
                  {PERIODIZATION_PHASE_LABEL_AR[currentPeriodization.phase]}
                </h3>
              </div>
              <p className="font-mono text-sm font-black">
                RIR {currentPeriodization.targetRir}
              </p>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {currentPeriodization.description}
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {["1", "2", "3", "4"].map((week) => {
                const active =
                  Number(week) === currentPeriodization.cycleWeek;
                return (
                  <div key={week} className="text-center">
                    <div
                      className={
                        "h-1.5 rounded-full " +
                        (active ? "bg-primary" : "bg-white/10")
                      }
                    />
                    <p
                      className={
                        "mt-1 text-[8px] " +
                        (active
                          ? "font-black text-primary"
                          : "text-muted-foreground")
                      }
                    >
                      W{week}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="relative px-6 mb-7 animate-enter [animation-delay:80ms]">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              تقرير اليوم
            </p>
            <h2 className="mt-1 text-xl font-black">أفضل مجموعة لكل تمرين</h2>
          </div>
          <label className="sr-only" htmlFor="progress-day">
            اختر اليوم
          </label>
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
              const change =
                item.previousBest === null
                  ? null
                  : item.bestSet - item.previousBest;
              return (
                <div
                  key={item.exerciseId}
                  className="flex items-center gap-3 p-4"
                >
                  <div
                    className={
                      "grid size-10 shrink-0 place-items-center rounded-full " +
                      (item.isPersonalBest
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground")
                    }
                  >
                    <Trophy className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {exercise ? (
                      <Link
                        to="/exercise/$id"
                        params={{ id: exercise.id }}
                        className="truncate text-sm font-bold hover:text-primary"
                      >
                        {exercise.name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-bold">
                        {item.exerciseId}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {item.totalSets} مجموعات مسجلة
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="text-2xl font-black tabular-nums">
                      {item.bestSet}
                    </p>
                    <p
                      className={
                        "text-[10px] font-bold " +
                        (item.isPersonalBest
                          ? "text-primary"
                          : "text-muted-foreground")
                      }
                    >
                      {item.previousBest === null
                        ? "أول تسجيل"
                        : item.isPersonalBest
                          ? "رقم جديد +" + change
                          : "السابق " + item.previousBest}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="لا توجد مجموعات مسجلة في هذا اليوم"
            body="أكمل جلسة وسجّل تكراراتك لتظهر هنا."
          />
        )}
      </section>

      <section className="relative px-6 mb-7 animate-enter [animation-delay:100ms]">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              سجل القوة
            </p>
            <h2 className="mt-1 text-xl font-black">اتجاه e1RM والحمل</h2>
          </div>
          {totalLoadVolume > 0 && (
            <div className="text-left">
              <p className="font-mono text-sm font-black">
                {formatCompact(totalLoadVolume)}
              </p>
              <p className="text-[8px] text-muted-foreground">
                كجم×تكرار مسجل
              </p>
            </div>
          )}
        </div>

        {strength.length ? (
          <div className="space-y-3">
            {strength.slice(0, 10).map((item) => {
              const exercise = getExercise(item.exerciseId);
              const trendLabel =
                item.trend === "up"
                  ? "صاعد"
                  : item.trend === "down"
                    ? "هابط"
                    : "مستقر";

              return (
                <article
                  key={item.exerciseId}
                  className={
                    "rounded-2xl border bg-surface/60 p-4 " +
                    (item.plateau
                      ? "border-amber-400/30"
                      : "border-border")
                  }
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {exercise ? (
                          <Link
                            to="/exercise/$id"
                            params={{ id: exercise.id }}
                            className="truncate text-sm font-black hover:text-primary"
                          >
                            {exercise.name}
                          </Link>
                        ) : (
                          <p className="truncate text-sm font-black">
                            {item.exerciseId}
                          </p>
                        )}

                        {item.sessions > 1 &&
                          item.latestEstimated1RmIsPr && (
                            <Badge tone="success">e1RM PR</Badge>
                          )}
                        {item.sessions > 1 && item.latestLoadIsPr && (
                          <Badge tone="success">Load PR</Badge>
                        )}
                        {item.plateau && (
                          <Badge tone="warn">Plateau</Badge>
                        )}
                      </div>

                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {item.sessions} جلسات · متوسط RIR{" "}
                        {item.averageRir ?? "—"}
                      </p>
                    </div>

                    <div className="text-left">
                      <div className="flex items-center justify-end gap-1">
                        {item.trend === "up" ? (
                          <TrendingUp className="size-3.5 text-primary" />
                        ) : item.trend === "down" ? (
                          <TrendingDown className="size-3.5 text-cyan" />
                        ) : (
                          <Minus className="size-3.5 text-muted-foreground" />
                        )}
                        <span
                          className={
                            "font-mono text-sm font-black " +
                            (item.trend === "up"
                              ? "text-primary"
                              : item.trend === "down"
                                ? "text-cyan"
                                : "")
                          }
                        >
                          {item.trendPercent > 0 ? "+" : ""}
                          {item.trendPercent}%
                        </span>
                      </div>
                      <p className="text-[8px] text-muted-foreground">
                        {trendLabel} · آخر 4
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 h-16 rounded-xl bg-background/40 px-2 py-1">
                    <StrengthSparkline
                      values={item.points
                        .slice(-8)
                        .map((point) => point.bestEstimated1RmKg)}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <StrengthMetric
                      label="آخر حمل"
                      value={item.lastLoadKg + " كجم"}
                    />
                    <StrengthMetric
                      label="أفضل e1RM"
                      value={item.bestEstimated1RmKg + " كجم"}
                    />
                    <StrengthMetric
                      label="e1RM الأخير"
                      value={item.latestEstimated1RmKg + " كجم"}
                    />
                    <StrengthMetric
                      label="حجم آخر جلسة"
                      value={formatCompact(item.latestLoadVolumeKgReps)}
                    />
                  </div>

                  {item.plateau && (
                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" />
                      <p className="text-[10px] leading-relaxed text-muted-foreground">
                        القوة التقديرية تحركت أقل من 1.5% عبر آخر أربع
                        تسجيلات. لا يغيّر التطبيق البرنامج تلقائيًا بسبب
                        Plateau وحده؛ تُراجع الجاهزية وRIR والحجم أولًا.
                      </p>
                    </div>
                  )}
                </article>
              );
            })}

            <p className="px-1 text-[9px] leading-relaxed text-muted-foreground">
              e1RM تقدير تدريبي مبني على الحمل والتكرارات وRIR. حجم الحمل
              هنا = الوزن المسجل × التكرارات، لذلك هو مؤشر مقارنة داخل
              التطبيق وليس قياسًا ميكانيكيًا كاملاً لكل تمرين.
            </p>
          </div>
        ) : (
          <EmptyState
            icon={Dumbbell}
            title="لا توجد أحمال مسجلة بعد"
            body="سجّل الوزن والتكرارات وRIR داخل جلسة المقاومة ليبدأ منحنى القوة."
          />
        )}
      </section>

      <section className="relative px-6 mb-8 animate-enter [animation-delay:140ms]">
        <div className="mb-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            بيانات الملف
          </p>
          <h2 className="mt-1 text-xl font-black">قياسات مسجلة فعليًا</h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <ProfileMetric
            icon={Scale}
            label="الوزن"
            value={
              profile.weightKg === undefined
                ? "—"
                : profile.weightKg + " كجم"
            }
          />
          <ProfileMetric
            icon={Activity}
            label="الطول"
            value={
              profile.heightCm === undefined
                ? "—"
                : profile.heightCm + " سم"
            }
          />
          <ProfileMetric
            icon={Target}
            label="العمر"
            value={
              profile.age === undefined ? "—" : profile.age + " سنة"
            }
          />
        </div>
        <p className="mt-3 text-[9px] text-muted-foreground">
          لا يعرض Aura Fit قيمًا افتراضية للوزن أو القياسات إذا لم يسجلها
          المستخدم.
        </p>
      </section>

      {history.length > 0 && (
        <section className="relative px-6 mb-8 animate-enter [animation-delay:160ms]">
          <div className="mb-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              آخر الجلسات
            </p>
            <h2 className="mt-1 text-xl font-black">سجل الأداء</h2>
          </div>

          <div className="divide-y divide-border rounded-2xl border border-border bg-surface/60">
            {history.slice(0, 5).map((workout) => (
              <div
                key={workout.id}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-sm font-bold">
                    {formatDate(workout.date)}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {workout.exercises.filter((item) => item.completed).length}
                    /{workout.exercises.length} تمارين ·{" "}
                    {Math.round(workout.durationSec / 60)} دقيقة
                  </p>
                </div>
                <div className="text-left">
                  <p className="font-mono text-lg font-black">
                    {workout.performance}%
                  </p>
                  <p className="text-[9px] text-muted-foreground">
                    {workout.periodizationPhase
                      ? PERIODIZATION_PHASE_LABEL_AR[
                          workout.periodizationPhase
                        ] +
                        (workout.periodizationCycleWeek
                          ? " · W" + workout.periodizationCycleWeek
                          : "")
                      : workout.adaptationMode === "progress"
                        ? "تقدّم"
                        : workout.adaptationMode === "recovery"
                          ? "استشفاء"
                          : "ثبات"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <BottomNav />
    </PageShell>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
  warn,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={
        "rounded-2xl border p-4 " +
        (warn
          ? "border-amber-400/30 bg-amber-400/5"
          : accent
            ? "border-primary/30 bg-primary/10"
            : "border-border bg-surface/60")
      }
    >
      <Icon
        className={
          "size-4 " +
          (warn ? "text-amber-400" : accent ? "text-primary" : "text-muted-foreground")
        }
      />
      <p className="mt-3 font-mono text-2xl font-black">{value}</p>
      <p className="mt-1 text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-black">{value}</p>
    </div>
  );
}

function StrengthMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-background/50 p-2.5 text-center">
      <p className="font-mono text-[11px] font-black">{value}</p>
      <p className="mt-0.5 text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "warn";
}) {
  return (
    <span
      className={
        "rounded-full border px-2 py-0.5 text-[8px] font-black " +
        (tone === "success"
          ? "border-primary/25 bg-primary/10 text-primary"
          : "border-amber-400/25 bg-amber-400/10 text-amber-400")
      }
    >
      {children}
    </span>
  );
}

function StrengthSparkline({ values }: { values: number[] }) {
  if (!values.length) return null;
  if (values.length === 1) {
    return (
      <div className="flex h-full items-center">
        <div className="h-1 w-full rounded-full bg-primary/40" />
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * 100;
      const y = 44 - ((value - min) / span) * 34;
      return x + "," + y;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 48"
      preserveAspectRatio="none"
      className="h-full w-full"
      aria-label="اتجاه القوة التقديرية"
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2.4"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-3">
      <Icon className="size-3.5 text-primary" />
      <p className="mt-2 text-[8px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs font-black">{value}</p>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border px-5 py-8 text-center">
      <Icon className="mx-auto size-5 text-muted-foreground" />
      <p className="mt-3 text-sm font-bold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("ar", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    day: "numeric",
    month: "short",
  }).format(new Date(iso));
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}
