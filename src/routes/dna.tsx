import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  CalendarCheck,
  Dumbbell,
  Fingerprint,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";
import {
  getExercise,
  INJURY_LABEL_AR,
  MOVEMENT_FAMILY_LABEL_AR,
} from "@/lib/exercise-db";
import {
  currentStreak,
  exerciseStrengthAnalyses,
  loadHistory,
  loadProfile,
  loadTodayReadiness,
} from "@/lib/user-profile";
import {
  PERIODIZATION_PHASE_LABEL_AR,
  generateWeeklyPlan,
  getWeeklyVolumeStatus,
} from "@/lib/workout-engine";

export const Route = createFileRoute("/dna")({
  head: () => ({
    meta: [
      { title: "بصمة التدريب | Aura Fit" },
      {
        name: "description",
        content:
          "ملخص واقعي لهويتك التدريبية من الجلسات والأحمال والجاهزية وتوازن الحجم، بدون ادعاءات جينية.",
      },
    ],
  }),
  component: TrainingFingerprint,
});

function TrainingFingerprint() {
  const profile = useMemo(() => loadProfile(), []);
  const history = useMemo(() => loadHistory(), []);
  const readiness = useMemo(() => loadTodayReadiness(), []);
  const weekly = useMemo(
    () => generateWeeklyPlan(profile, history, readiness),
    [profile, history, readiness],
  );
  const strength = useMemo(
    () => exerciseStrengthAnalyses(history),
    [history],
  );
  const volume = useMemo(
    () => getWeeklyVolumeStatus(weekly, profile),
    [weekly, profile],
  );

  const adaptation = weekly[0]?.adaptation;
  const periodization = weekly[0]?.periodization;
  const streak = currentStreak(history);
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const recentWorkouts = history.filter(
    (workout) => new Date(workout.date).getTime() >= cutoff,
  );
  const movementFamilies = new Set(
    recentWorkouts.flatMap((workout) =>
      workout.exercises
        .filter((item) => item.completed)
        .map((item) => getExercise(item.id)?.movementFamily)
        .filter((item): item is NonNullable<typeof item> => Boolean(item)),
    ),
  );
  const recentPrs = strength.filter(
    (item) =>
      item.sessions > 1 &&
      (item.latestLoadIsPr || item.latestEstimated1RmIsPr),
  );
  const plateaus = strength.filter((item) => item.plateau);
  const rising = strength.filter((item) => item.trend === "up");
  const onTarget = volume.filter((item) => item.status === "target").length;
  const topStrength = [...strength].sort(
    (a, b) => b.bestEstimated1RmKg - a.bestEstimated1RmKg,
  )[0];

  const metrics = [
    {
      icon: Dumbbell,
      label: "سجل القوة",
      value: strength.length ? strength.length + " تمارين" : "لا توجد أحمال",
      detail: topStrength
        ? `أعلى e1RM مسجل: ${getExercise(topStrength.exerciseId)?.name ?? topStrength.exerciseId} · ${topStrength.bestEstimated1RmKg} كجم`
        : "سجّل Kg + Reps + RIR ليبدأ هذا المحور.",
    },
    {
      icon: CalendarCheck,
      label: "الاستمرارية",
      value: recentWorkouts.length + " جلسة / 28 يوم",
      detail: streak ? `سلسلة حالية: ${streak} يوم.` : "لا توجد سلسلة أيام حالية.",
    },
    {
      icon: Activity,
      label: "الاستشفاء",
      value: adaptation ? adaptation.readinessScore + "%" : "—",
      detail: adaptation
        ? adaptation.readinessSource === "daily-checkin"
          ? "مبني على Check-in اليوم والأداء الحديث."
          : "تقديري من خط الأساس والأداء الحديث."
        : "لا توجد بيانات كافية.",
    },
    {
      icon: Target,
      label: "توازن الأسبوع",
      value: onTarget + "/" + volume.length,
      detail: "عدد مجموعات العضلات الواقعة داخل نطاق الحجم المستهدف.",
    },
    {
      icon: Fingerprint,
      label: "تنوع الحركة",
      value: movementFamilies.size
        ? movementFamilies.size + " أنماط"
        : "لا توجد جلسات حديثة",
      detail: movementFamilies.size
        ? Array.from(movementFamilies)
            .slice(0, 4)
            .map((family) => MOVEMENT_FAMILY_LABEL_AR[family])
            .join(" · ")
        : "يسجل من التمارين المكتملة فعليًا.",
    },
    {
      icon: ShieldCheck,
      label: "فلترة السلامة",
      value: profile.injuries.length
        ? profile.injuries.length + " مناطق"
        : "لا توجد قيود",
      detail: profile.injuries.length
        ? profile.injuries
            .map((injury) => INJURY_LABEL_AR[injury])
            .join("، ")
        : "لا توجد مناطق إصابة مسجلة في الملف.",
    },
  ];

  return (
    <PageShell>
      <header className="p-6 pt-10 animate-enter">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
              TRAINING FINGERPRINT
            </p>
            <h1 className="mt-1 text-3xl font-black leading-tight">
              بصمة
              <br />
              التدريب
            </h1>
          </div>
          <div className="grid size-12 place-items-center rounded-2xl border border-primary/25 bg-primary/10">
            <Fingerprint className="size-6 text-primary" />
          </div>
        </div>
        <p className="mt-3 max-w-[38ch] text-xs leading-6 text-muted-foreground">
          قراءة من بياناتك المسجلة داخل Aura Fit. لا يوجد تحليل DNA أو HRV أو
          نسب خطر إصابة غير مقاسة.
        </p>
      </header>

      <section className="px-6 mb-7 grid grid-cols-2 gap-3 animate-enter">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-border bg-surface/60 p-4"
          >
            <metric.icon className="size-4 text-primary" />
            <p className="mt-3 text-[9px] text-muted-foreground">
              {metric.label}
            </p>
            <p className="mt-1 text-sm font-black">{metric.value}</p>
            <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
              {metric.detail}
            </p>
          </article>
        ))}
      </section>

      <section className="px-6 mb-7 animate-enter">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                الحالة الحالية
              </p>
              <h2 className="mt-1 text-lg font-black">
                {periodization
                  ? PERIODIZATION_PHASE_LABEL_AR[periodization.phase]
                  : "الخطة غير مكتملة"}
              </h2>
            </div>
            <Sparkles className="size-5 text-primary" />
          </div>
          {periodization && adaptation && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              <Mini label="الأسبوع" value={periodization.cycleWeek + "/4"} />
              <Mini label="RIR" value={periodization.targetRir} />
              <Mini label="الجاهزية" value={adaptation.readinessScore + "%"} />
            </div>
          )}
        </div>
      </section>

      <section className="px-6 mb-8 animate-enter">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          إشارات من السجل
        </p>
        <div className="space-y-2">
          <Signal
            icon={TrendingUp}
            title="اتجاهات القوة"
            body={
              strength.length
                ? `${rising.length} تمارين صاعدة · ${recentPrs.length} PR حديثة · ${plateaus.length} Plateau.`
                : "لا توجد بيانات أحمال كافية بعد."
            }
          />
          <Signal
            icon={Target}
            title="توازن الحجم"
            body={
              volume.length
                ? `${onTarget} من ${volume.length} مجموعات عضلية داخل النطاق المستهدف لهذا الأسبوع.`
                : "أكمل إعداد الخطة ليظهر تحليل الحجم."
            }
          />
          <Signal
            icon={ShieldCheck}
            title="حدود التحليل"
            body="لا نحول هذه المؤشرات إلى تشخيص طبي أو احتمال إصابة أو ادعاء جيني. الصفحة تلخص فقط بيانات التدريب التي سجلتها."
          />
        </div>
      </section>

      <section className="px-6 mb-10 grid grid-cols-2 gap-3">
        <Link
          to="/progress"
          className="rounded-2xl bg-primary p-4 text-center text-xs font-black text-primary-foreground"
        >
          تحليل القوة
        </Link>
        <Link
          to="/coach"
          className="rounded-2xl border border-border bg-surface p-4 text-center text-xs font-black"
        >
          سؤال المدرب
        </Link>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/50 p-2.5 text-center">
      <p className="font-mono text-sm font-black">{value}</p>
      <p className="mt-0.5 text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Signal({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface/60 p-4">
      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-4" />
      </div>
      <div>
        <p className="text-xs font-black">{title}</p>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </div>
  );
}
