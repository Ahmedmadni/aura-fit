import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  BookOpen,
  Dna,
  Flame,
  Heart,
  LayoutGrid,
  Moon,
  Play,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import heroWorkout from "@/assets/hero-workout.jpg";
import programHypertrophy from "@/assets/program-hypertrophy.jpg";
import programMobility from "@/assets/program-mobility.jpg";
import programCardio from "@/assets/program-cardio.jpg";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";
import {
  EXERCISES,
  MUSCLE_LABEL_AR,
} from "@/lib/exercise-db";
import {
  generateWeeklyPlan,
  generateWeeklySchedule,
  getWeeklyVolumeStatus,
} from "@/lib/workout-engine";
import {
  DEFAULT_PROFILE,
  currentStreak,
  loadHistory,
  loadProfile,
  type CompletedWorkout,
  type UserProfile,
} from "@/lib/user-profile";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const programs = [
  { title: "تضخيم عضلي", meta: "٤ أسابيع · قوة", img: programHypertrophy },
  { title: "مرونة ديناميكية", meta: "٢ أسبوع · استشفاء", img: programMobility },
  { title: "ذروة هوائية", meta: "٦ أسابيع · كارديو", img: programCardio },
];

function Dashboard() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const [now] = useState(() => new Date());

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
  const volume = useMemo(
    () => getWeeklyVolumeStatus(weekly, profile),
    [weekly, profile],
  );

  const today = schedule[now.getDay()];
  const todayWorkout = today?.workout;
  const nextTraining = useMemo(() => {
    if (todayWorkout) return today;
    for (let offset = 1; offset < 7; offset += 1) {
      const candidate = schedule[(now.getDay() + offset) % 7];
      if (candidate?.workout) return candidate;
    }
    return undefined;
  }, [now, schedule, today, todayWorkout]);

  const readiness = Math.max(
    25,
    Math.min(
      100,
      Math.round(
        72 +
          (profile.sleepQuality - 3) * 8 -
          (profile.fatigue - 2) * 10,
      ),
    ),
  );
  const weeklyCalories = weekly.reduce(
    (sum, workout) => sum + workout.estimatedCalories,
    0,
  );
  const onTargetVolume = volume.filter((item) => item.status === "target").length;
  const streak = currentStreak(history);
  const displayName = profile.name?.trim() || "بطل";
  const dateLabel = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  const achievements = [
    { icon: Flame, label: streak ? `${streak} يوم متواصل` : "ابدأ سلسلتك", value: "STRK" },
    {
      icon: Award,
      label:
        profile.level === "beginner"
          ? "مستوى مبتدئ"
          : profile.level === "intermediate"
            ? "مستوى متوسط"
            : "مستوى متقدم",
      value: "LVL",
    },
    {
      icon: TrendingUp,
      label: `${onTargetVolume}/${volume.length} حجم متوازن`,
      value: "VOL",
    },
  ];

  return (
    <PageShell>
      <header className="relative p-6 pt-10 flex justify-between items-end animate-enter">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
            {dateLabel}
          </p>
          <h1 className="text-3xl font-black tracking-tight leading-none">
            أهلاً بعودتك،
            <br />
            {displayName}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-full">
          <Flame className="size-3.5 text-primary" />
          <span className="text-primary text-[10px] font-mono font-bold">STRK</span>
          <span className="text-sm font-black">{streak}</span>
        </div>
      </header>

      <section className="relative px-6 mb-6 animate-enter [animation-delay:100ms]">
        <div className="bg-surface border border-border rounded-3xl p-5 flex items-center justify-between backdrop-blur-xl">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                جاهزية تقديرية
              </p>
              <p className="text-4xl font-black text-primary leading-none" dir="ltr">
                {readiness}%
              </p>
            </div>
            <div className="flex gap-4">
              <Stat icon={Moon} label="النوم" value={profile.sleepQuality + "/5"} />
              <div className="border-r border-border pr-4">
                <Stat icon={Heart} label="الإجهاد" value={profile.fatigue + "/5"} />
              </div>
            </div>
          </div>
          <ReadinessRings readiness={readiness} />
        </div>
      </section>

      <section className="relative px-6 mb-8 animate-enter [animation-delay:150ms]">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {achievements.map((item) => (
            <div
              key={item.value}
              className="flex-shrink-0 flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 backdrop-blur-xl"
            >
              <item.icon className="size-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {item.value}
              </span>
              <span className="text-xs font-bold">{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="relative px-6 mb-8 animate-enter [animation-delay:200ms]">
        <div className="relative overflow-hidden rounded-3xl aspect-[4/5] bg-card border border-border">
          <img
            src={heroWorkout}
            alt={todayWorkout ? "جلسة اليوم التدريبية" : "يوم الاستشفاء"}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            width={832}
            height={1024}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-bl from-background/60 via-transparent to-transparent" />

          <div className="absolute bottom-0 p-6 w-full space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Tag className="bg-primary text-primary-foreground">
                <Sparkles className="size-3" />
                {todayWorkout ? "خطة اليوم" : "استشفاء مخطط"}
              </Tag>
              <Tag className="bg-white/10 backdrop-blur-md text-white border border-white/10">
                <Zap className="size-3" />
                {todayWorkout ? `شدة ${todayWorkout.intensity}%` : "راحة"}
              </Tag>
            </div>

            {todayWorkout ? (
              <>
                <div>
                  <h2 className="text-4xl font-black leading-[1] mb-2 tracking-tight">
                    {todayWorkout.title}
                  </h2>
                  <p className="text-sm text-white/70 max-w-[32ch]">
                    {todayWorkout.targetMuscles
                      .slice(0, 5)
                      .map((muscle) => MUSCLE_LABEL_AR[muscle])
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-5 font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
                  <span>{todayWorkout.estimatedMinutes} MIN</span>
                  <span className="text-white/30">·</span>
                  <span>{todayWorkout.estimatedCalories} KCAL</span>
                  <span className="text-white/30">·</span>
                  <span>{todayWorkout.exercises.length} EX</span>
                </div>
                <Link
                  to="/workout"
                  search={{ day: today.workoutIndex }}
                  className="w-full bg-primary hover:bg-white text-primary-foreground font-black py-4 rounded-xl transition-colors uppercase tracking-widest text-sm active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Play className="size-4 fill-current" />
                  ابدأ جلسة اليوم
                </Link>
              </>
            ) : (
              <>
                <div>
                  <h2 className="text-4xl font-black leading-[1] mb-2 tracking-tight">
                    يوم راحة
                  </h2>
                  <p className="text-sm text-white/70 max-w-[32ch]">
                    الاستشفاء جزء من الخطة. استخدم اليوم للمشي الخفيف والحركة المريحة،
                    والجلسة التالية {nextTraining?.dayLabel ?? "قريبًا"}
                    {nextTraining?.workout ? " · " + nextTraining.workout.title : ""}.
                  </p>
                </div>
                <Link
                  to="/programs"
                  className="w-full bg-primary hover:bg-white text-primary-foreground font-black py-4 rounded-xl transition-colors uppercase tracking-widest text-sm active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Activity className="size-4" />
                  عرض خطة الأسبوع
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="relative px-6 mb-8 animate-enter [animation-delay:300ms]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            توزيع الأسبوع
          </h3>
          <Link
            to="/programs"
            className="text-[10px] font-mono text-primary uppercase"
          >
            التفاصيل
          </Link>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 backdrop-blur-xl">
          <div className="flex items-end justify-between h-24 gap-2">
            {schedule.map((day) => {
              const active = day.weekday === now.getDay();
              return (
                <div key={day.weekday} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex-1 bg-white/5 rounded-t-md overflow-hidden relative flex items-end">
                    <div
                      className={
                        "w-full rounded-t-md transition-all " +
                        (active
                          ? "bg-primary shadow-[0_0_20px_rgba(204,255,0,0.4)]"
                          : day.isRest
                            ? "bg-white/10"
                            : "bg-white/30")
                      }
                      style={{ height: day.isRest ? "18%" : "80%" }}
                    />
                  </div>
                  <span
                    className={
                      "text-[10px] font-bold " +
                      (active ? "text-primary" : "text-muted-foreground")
                    }
                  >
                    {day.dayLabel.slice(0, 1)}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
            <MiniStat label="جلسات" value={String(weekly.length)} />
            <MiniStat label="حجم مناسب" value={onTargetVolume + "/" + volume.length} />
            <MiniStat label="حرق مخطط" value={"~" + weeklyCalories} />
          </div>
        </div>
      </section>

      <section className="relative mb-8 animate-enter [animation-delay:400ms]">
        <div className="px-6 flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            برامج مختارة
          </h3>
          <Link to="/programs" className="text-[10px] font-mono text-primary uppercase">
            عرض الكل
          </Link>
        </div>
        <div className="flex gap-4 overflow-x-auto px-6 no-scrollbar">
          {programs.map((program) => (
            <article key={program.title} className="min-w-[170px] group">
              <div className="aspect-square rounded-2xl bg-card border border-border overflow-hidden mb-3 relative">
                <img
                  src={program.img}
                  alt={program.title}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  loading="lazy"
                  width={512}
                  height={512}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-2 left-2 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Play className="size-3 fill-current" />
                </div>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {program.meta}
              </p>
              <p className="text-sm font-black tracking-tight mt-0.5">{program.title}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative px-6 mb-8 animate-enter [animation-delay:500ms]">
        <div className="grid grid-cols-2 gap-3">
          <QuickLink to="/dna" icon={Dna} label="الحمض الرياضي" hint="تحليل ذكي متكامل" accent />
          <QuickLink to="/coach" icon={Sparkles} label="المدرب الذكي" hint="اسألني أي شيء" />
          <QuickLink
            to="/library"
            icon={BookOpen}
            label="مكتبة التمارين"
            hint={EXERCISES.length + " تمرين"}
          />
          <QuickLink to="/builder" icon={LayoutGrid} label="منشئ الجلسات" hint="ابنِ أو ولّد بـAI" />
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="size-2.5 text-muted-foreground" />
        <p className="text-[10px] font-mono text-muted-foreground uppercase">{label}</p>
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">
        {label}
      </p>
      <p className="text-sm font-black" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function Tag({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={
        "inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider " +
        className
      }
    >
      {children}
    </span>
  );
}

type QuickProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  accent?: boolean;
};

function QuickLink({
  to,
  ...props
}: QuickProps & {
  to: "/dna" | "/coach" | "/nutrition" | "/library" | "/builder";
}) {
  const { icon: Icon, label, hint, accent } = props;
  return (
    <Link
      to={to}
      className={
        "text-right rounded-2xl border p-4 backdrop-blur-xl transition-all active:scale-[0.98] block " +
        (accent
          ? "bg-primary/10 border-primary/30 hover:bg-primary/15"
          : "bg-surface border-border hover:border-white/20")
      }
    >
      <Icon className={"size-5 mb-3 " + (accent ? "text-primary" : "text-foreground")} />
      <p className="text-sm font-black tracking-tight">{label}</p>
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
        {hint}
      </p>
    </Link>
  );
}

function ReadinessRings({ readiness }: { readiness: number }) {
  const outerCirc = 264;
  const outerOffset = outerCirc - (readiness / 100) * outerCirc;

  return (
    <div className="relative size-28">
      <svg className="size-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={outerCirc}
          strokeDashoffset={outerOffset}
          style={{ filter: "drop-shadow(0 0 8px rgba(204,255,0,0.5))" }}
        />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-mono text-muted-foreground uppercase">جاهزية</span>
        <span className="text-sm font-black" dir="ltr">
          {readiness}%
        </span>
      </div>
    </div>
  );
}
