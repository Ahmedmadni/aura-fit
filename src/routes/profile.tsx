import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  Activity,
  Award,
  CalendarDays,
  ChevronLeft,
  Dumbbell,
  Settings,
  Target,
  Zap,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { FontSizeSetting } from "@/components/font-size-setting";
import { PageShell } from "@/components/page-shell";
import { LEVEL_LABEL_AR } from "@/lib/exercise-db";
import {
  computeAchievements,
  levelFromXp,
  totalXp,
} from "@/lib/achievements";
import { loadHistory, loadProfile } from "@/lib/user-profile";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const profile = useMemo(() => loadProfile(), []);
  const history = useMemo(() => loadHistory(), []);
  const achievements = useMemo(
    () => computeAchievements(history),
    [history],
  );
  const unlocked = achievements.filter((item) => item.unlocked);
  const xp = totalXp(history);
  const xpLevel = levelFromXp(xp);
  const totalHours =
    history.reduce((sum, workout) => sum + workout.durationSec, 0) / 3600;
  const totalCalories = history.reduce(
    (sum, workout) => sum + workout.calories,
    0,
  );
  const oldestWorkout = history.length
    ? [...history].sort(
        (a, b) =>
          new Date(a.date).getTime() - new Date(b.date).getTime(),
      )[0]
    : undefined;
  const displayName = profile.name?.trim() || "مستخدم Aura Fit";
  const initial = displayName.slice(0, 1);
  const memberSince = oldestWorkout
    ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        month: "long",
        year: "numeric",
      }).format(new Date(oldestWorkout.date))
    : "لم تسجل جلسة بعد";

  return (
    <PageShell>
      <section className="relative p-6 pt-10 animate-enter">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              حسابي
            </p>
            <h1 className="mt-1 text-3xl font-black">ملف التدريب</h1>
          </div>
          <div className="grid size-10 place-items-center rounded-full border border-border bg-surface text-muted-foreground">
            <Settings className="size-4" />
          </div>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="grid size-20 place-items-center rounded-3xl bg-gradient-to-br from-primary to-brand-dim text-3xl font-black text-primary-foreground">
            {initial}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black leading-tight">
              {displayName}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {oldestWorkout ? "يتدرب منذ " + memberSince : memberSince}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[9px] font-bold text-primary">
                {LEVEL_LABEL_AR[profile.level]}
              </span>
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[9px] text-muted-foreground">
                {profile.daysPerWeek} أيام أسبوعيًا
              </span>
              <span className="rounded-full border border-border bg-surface px-2.5 py-1 text-[9px] text-muted-foreground">
                {profile.sessionMinutes} دقيقة
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <FontSizeSetting />
        </div>

        <div className="rounded-2xl border border-border bg-surface p-4 backdrop-blur-xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-primary" />
              <span className="text-sm font-black">
                مستوى النشاط {xpLevel.level}
              </span>
            </div>
            <span
              className="text-[10px] font-mono text-muted-foreground"
              dir="ltr"
            >
              {xp.toLocaleString()} / {xpLevel.next.toLocaleString()} XP
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-white/5"
            dir="ltr"
          >
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_10px_rgba(204,255,0,0.5)]"
              style={{
                width:
                  Math.max(
                    0,
                    Math.min(100, Math.round(xpLevel.progress * 100)),
                  ) + "%",
              }}
            />
          </div>
          <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
            XP مؤشر نشاط داخل التطبيق مشتق من الجلسات المسجلة، وليس تصنيفًا
            طبيًا أو رياضيًا رسميًا.
          </p>
        </div>
      </section>

      <section className="relative px-6 mb-7 grid grid-cols-3 gap-3 animate-enter [animation-delay:100ms]">
        <MiniCard
          icon={Dumbbell}
          label="جلسة"
          value={String(history.length)}
        />
        <MiniCard
          icon={Activity}
          label="ساعة"
          value={totalHours ? totalHours.toFixed(1) : "0"}
        />
        <MiniCard
          icon={Zap}
          label="سعرة تقديرية"
          value={formatCompact(totalCalories)}
        />
      </section>

      <section className="relative px-6 mb-7 animate-enter [animation-delay:160ms]">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
              الإنجازات
            </p>
            <h3 className="mt-1 text-lg font-black">
              {unlocked.length}/{achievements.length} مفتوحة
            </h3>
          </div>
          <Award className="size-5 text-primary" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className={
                "rounded-2xl border p-3 " +
                (achievement.unlocked
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-surface/50 opacity-55")
              }
            >
              <div className="text-2xl">{achievement.icon}</div>
              <p className="mt-2 text-xs font-black">
                {achievement.title}
              </p>
              <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
                {achievement.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative px-6 mb-8 animate-enter [animation-delay:220ms]">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface backdrop-blur-xl">
          <ProfileLink
            to="/programs"
            icon={CalendarDays}
            label="الخطة الأسبوعية"
            hint={profile.daysPerWeek + " أيام"}
          />
          <ProfileLink
            to="/progress"
            icon={Target}
            label="التقدم والقوة"
            hint={history.length ? history.length + " جلسة" : "ابدأ التسجيل"}
          />
          <ProfileLink
            to="/onboarding"
            icon={Zap}
            label="الأهداف والمعدات"
            hint="تعديل"
          />
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function MiniCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 text-center backdrop-blur-xl">
      <Icon className="mx-auto size-3.5 text-primary" />
      <p className="mt-2 text-xl font-black" dir="ltr">
        {value}
      </p>
      <p className="mt-0.5 text-[8px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function ProfileLink({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: "/programs" | "/progress" | "/onboarding";
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center justify-between border-b border-border p-4 last:border-b-0 hover:bg-white/5"
    >
      <div className="flex items-center gap-3">
        <div className="grid size-9 place-items-center rounded-xl border border-border bg-background/50 text-muted-foreground">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-bold">{label}</span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-[9px] font-mono">{hint}</span>
        <ChevronLeft className="size-4" />
      </div>
    </Link>
  );
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("ar", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}
