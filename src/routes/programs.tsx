import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Play,
  Target,
  TrendingUp,
} from "lucide-react";
import programHypertrophy from "@/assets/program-hypertrophy.jpg";
import programMobility from "@/assets/program-mobility.jpg";
import programCardio from "@/assets/program-cardio.jpg";
import heroWorkout from "@/assets/hero-workout.jpg";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell, PageHeader } from "@/components/page-shell";
import {
  PHASE_LABEL_AR,
  generateWeeklyPlan,
  generateWeeklySchedule,
  getWeeklyMuscleCoverage,
  getWeeklyVolumeStatus,
} from "@/lib/workout-engine";
import { MUSCLE_LABEL_AR, type Goal } from "@/lib/exercise-db";
import {
  DEFAULT_PROFILE,
  loadHistory,
  loadProfile,
  type CompletedWorkout,
  type UserProfile,
} from "@/lib/user-profile";

export const Route = createFileRoute("/programs")({
  component: Programs,
});

const curated = [
  {
    title: "تضخيم عضلي",
    meta: "حجم أسبوعي أعلى",
    dur: "45 د",
    lvl: "متوسط",
    img: programHypertrophy,
  },
  {
    title: "مرونة ديناميكية",
    meta: "حركة واستشفاء",
    dur: "20 د",
    lvl: "مبتدئ",
    img: programMobility,
  },
  {
    title: "ذروة هوائية",
    meta: "كارديو وتحمل",
    dur: "35 د",
    lvl: "متوسط",
    img: programCardio,
  },
];

const GOAL_LABELS: Record<Goal, string> = {
  "fat-loss": "خفض الدهون",
  "muscle-gain": "بناء العضلات",
  strength: "القوة",
  endurance: "التحمل",
  mobility: "المرونة",
  "general-fitness": "اللياقة العامة",
};

function Programs() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);

  useEffect(() => {
    setProfile(loadProfile());
    setHistory(loadHistory());
  }, []);

  const weekly = useMemo(
    () => generateWeeklyPlan(profile, history),
    [profile, history],
  );
  const schedule = useMemo(
    () => generateWeeklySchedule(profile, undefined, history),
    [profile, history],
  );
  const coverage = useMemo(() => getWeeklyMuscleCoverage(weekly), [weekly]);
  const volume = useMemo(
    () => getWeeklyVolumeStatus(weekly, profile),
    [weekly, profile],
  );
  const majorCoverage = coverage.filter((item) =>
    ["chest", "back", "shoulders", "quads", "hamstrings", "glutes", "core"].includes(
      item.muscle,
    ),
  );
  const coveredTwice = majorCoverage.filter((item) => item.days >= 2).length;
  const volumeOnTarget = volume.filter((item) => item.status === "target").length;

  return (
    <PageShell>
      <PageHeader eyebrow="الخطة الذكية" title={"أسبوعك\nالمتوازن"} />

      <section className="px-6 mb-6 animate-enter">
        <div className="rounded-3xl border border-primary/25 bg-primary/5 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-eyebrow text-primary">التوزيع الحالي</p>
              <h2 className="type-section-title mt-1">
                {profile.daysPerWeek} أيام · {profile.sessionMinutes} دقيقة
              </h2>
              <p className="type-small mt-2 text-muted-foreground">
                الهدف: {profile.goals.map((goal) => GOAL_LABELS[goal]).join("، ") || "لياقة عامة"}
              </p>
            </div>
            <CalendarDays className="size-6 shrink-0 text-primary" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryStat label="جلسات" value={String(weekly.length)} />
            <SummaryStat label="تغطية 2×" value={coveredTwice + "/" + majorCoverage.length} />
            <SummaryStat label="حجم مناسب" value={volumeOnTarget + "/" + volume.length} />
            <SummaryStat
              label="متوسط الجلسة"
              value={
                Math.round(
                  weekly.reduce((sum, workout) => sum + workout.estimatedMinutes, 0) /
                    Math.max(1, weekly.length),
                ) + "د"
              }
            />
          </div>
        </div>
      </section>

      <section className="px-6 mb-8 animate-enter [animation-delay:100ms]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="type-eyebrow text-muted-foreground">اليوم داخل الأسبوع</p>
            <h3 className="type-section-title">جلساتك بالترتيب</h3>
          </div>
          <Target className="size-5 text-primary" />
        </div>

        <div className="space-y-3">
          {schedule.map((day) => {
            if (day.isRest || !day.workout) {
              return (
                <article
                  key={day.weekday}
                  className="rounded-2xl border border-dashed border-border bg-background/40 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-border text-xs font-black text-muted-foreground">
                      {day.dayLabel.slice(0, 2)}
                    </div>
                    <div>
                      <p className="type-card-title">{day.dayLabel} · راحة</p>
                      <p className="type-caption mt-1 text-muted-foreground">
                        استشفاء ومشي خفيف أو حركة بسيطة حسب الجاهزية.
                      </p>
                    </div>
                  </div>
                </article>
              );
            }

            const workout = day.workout;
            const phaseCounts = workout.exercises.reduce<Record<string, number>>(
              (all, item) => {
                all[item.phase] = (all[item.phase] ?? 0) + 1;
                return all;
              },
              {},
            );

            return (
              <article
                key={day.weekday}
                className="rounded-2xl border border-border bg-surface/70 p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-xs font-black text-primary-foreground">
                    {day.dayLabel.slice(0, 2)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="type-card-title">
                          {day.dayLabel} · {workout.title}
                        </p>
                        <p className="type-caption mt-1 text-muted-foreground">
                          {workout.estimatedMinutes} دقيقة · ≈ {workout.estimatedCalories} سعرة
                        </p>
                      </div>
                      <Link
                        to="/workout"
                        search={{ day: day.workoutIndex }}
                        className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
                        aria-label={"ابدأ " + workout.title}
                      >
                        <Play className="size-3.5 fill-current" />
                      </Link>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {workout.targetMuscles.slice(0, 7).map((muscle) => (
                        <span
                          key={muscle}
                          className="rounded-full border border-border bg-background/70 px-2 py-1 text-[10px] text-muted-foreground"
                        >
                          {MUSCLE_LABEL_AR[muscle]}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-3 text-[10px] text-muted-foreground">
                      {(["warmup", "main", "accessory", "core", "cardio", "cooldown"] as const)
                        .filter((phase) => phaseCounts[phase])
                        .map((phase) => (
                          <span key={phase}>
                            {PHASE_LABEL_AR[phase]} {phaseCounts[phase]}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="px-6 mb-8 animate-enter [animation-delay:150ms]">
        <div className="mb-4">
          <p className="type-eyebrow text-muted-foreground">توزيع العضلات</p>
          <h3 className="type-section-title">التغطية الأسبوعية</h3>
        </div>
        <div className="rounded-2xl border border-border bg-surface/70 p-4">
          <div className="grid grid-cols-2 gap-3">
            {majorCoverage.map((item) => (
              <div key={item.muscle} className="rounded-xl bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold">{MUSCLE_LABEL_AR[item.muscle]}</p>
                  {item.days >= 2 ? (
                    <CheckCircle2 className="size-3.5 text-primary" />
                  ) : (
                    <span className="text-[9px] text-muted-foreground">مرة واحدة</span>
                  )}
                </div>
                <p className="mt-1 font-mono text-lg font-black">{item.days}×</p>
                <p className="text-[9px] text-muted-foreground">
                  {item.directSets} مجموعات مباشرة
                  {item.indirectSets ? " + " + item.indirectSets + " مساعدة" : ""}
                </p>
              </div>
            ))}
          </div>
          <p className="type-caption mt-4 text-muted-foreground">
            الهدف الافتراضي هو تكرار تعريض المجموعات العضلية الرئيسية مرتين أسبوعيًا متى سمح عدد أيام التدريب والمعدات.
          </p>
        </div>
      </section>

      <section className="px-6 mb-8 animate-enter [animation-delay:180ms]">
        <div className="mb-4">
          <p className="type-eyebrow text-muted-foreground">الحجم التدريبي</p>
          <h3 className="type-section-title">المجموعات الأسبوعية الفعالة</h3>
          <p className="type-small mt-2 text-muted-foreground">
            المجموعة المباشرة = 1.0، والمساهمة الثانوية = 0.5. النطاق يتغير تلقائيًا حسب المستوى والهدف.
          </p>
        </div>

        <div className="space-y-2">
          {volume.map((item) => {
            const pct = Math.min(100, Math.round((item.effectiveSets / item.max) * 100));
            const statusLabel =
              item.status === "low"
                ? "أقل من المطلوب"
                : item.status === "high"
                  ? "أعلى من النطاق"
                  : "ضمن النطاق";
            return (
              <div
                key={item.muscle}
                className="rounded-2xl border border-border bg-surface/70 p-3.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold">{MUSCLE_LABEL_AR[item.muscle]}</p>
                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                      المستهدف {item.min}–{item.max} · الأفضل ≈ {item.target}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-lg font-black">
                      {item.effectiveSets}
                    </p>
                    <p
                      className={
                        "text-[9px] font-bold " +
                        (item.status === "target"
                          ? "text-primary"
                          : "text-amber-400")
                      }
                    >
                      {statusLabel}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: pct + "%" }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[9px] text-muted-foreground">
                  <span>{item.directSets} مباشر</span>
                  <span>{item.indirectSets} مساعد</span>
                  <span>{item.days} أيام</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative px-6 mb-8 animate-enter [animation-delay:200ms]">
        <div className="relative overflow-hidden rounded-3xl aspect-[16/10] bg-card border border-border">
          <img
            src={heroWorkout}
            alt="برنامج تدريبي"
            className="absolute inset-0 size-full object-cover opacity-65"
            width={832}
            height={520}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-0 p-5">
            <span className="inline-block rounded-md bg-primary px-2 py-1 text-[10px] font-black text-primary-foreground">
              قابل للتخصيص
            </span>
            <h2 className="mt-2 text-2xl font-black">الخطة تتغير مع هدفك وجدولك</h2>
            <p className="mt-1 text-xs text-white/70">
              عدّل عدد الأيام والمدة والمعدات من إعداد ملفك ثم يعاد توزيع الأسبوع تلقائيًا.
            </p>
          </div>
        </div>
      </section>

      <section className="px-6 mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="type-section-title">أنماط إضافية</h3>
          <TrendingUp className="size-4 text-primary" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {curated.map((program) => (
            <article key={program.title} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="aspect-square">
                <img
                  src={program.img}
                  alt={program.title}
                  className="size-full object-cover opacity-70"
                  loading="lazy"
                />
              </div>
              <div className="p-2.5">
                <p className="text-[9px] text-muted-foreground">{program.meta}</p>
                <p className="mt-1 text-xs font-black">{program.title}</p>
                <div className="mt-2 flex items-center gap-1 text-[9px] text-primary">
                  <Clock className="size-3" /> {program.dur}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3 text-center">
      <p className="font-mono text-lg font-black">{value}</p>
      <p className="text-[9px] text-muted-foreground">{label}</p>
    </div>
  );
}
