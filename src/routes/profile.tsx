import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Award,
  CalendarDays,
  ChevronLeft,
  Cloud,
  CloudOff,
  Download,
  Dumbbell,
  HardDrive,
  LogIn,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
  Target,
  Upload,
  Zap,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import {
  CLOUD_AUTH_CHANGED_EVENT,
  loadCloudSession,
  signInCloud,
  signOutCloud,
  signUpCloud,
  type CloudSession,
} from "@/lib/cloud-auth";
import { isCloudConfigured } from "@/lib/cloud-config";
import {
  CLOUD_SYNC_STATUS_EVENT,
  runFullCloudSync,
  type CloudSyncStatus,
} from "@/lib/cloud-sync";
import { FontSizeSetting } from "@/components/font-size-setting";
import { PwaInstallCard } from "@/components/pwa-install-card";
import { PageShell } from "@/components/page-shell";
import { INJURY_LABEL_AR, LEVEL_LABEL_AR } from "@/lib/exercise-db";
import {
  parseLocalBackup,
  restoreLocalBackup,
  serializeLocalBackup,
  type AuraLocalBackupV1,
} from "@/lib/local-backup";
import {
  computeAchievements,
  levelFromXp,
  totalXp,
} from "@/lib/achievements";
import {
  DEFAULT_PROFILE,
  loadHistory,
  loadProfile,
  type CompletedWorkout,
  type UserProfile,
} from "@/lib/user-profile";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

function Profile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const cloudConfigured = isCloudConfigured();
  const [cloudSession, setCloudSession] = useState<CloudSession | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>({
    state: "idle",
    message: "لم تبدأ المزامنة بعد",
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cloudBusy, setCloudBusy] = useState(false);
  const [cloudMessage, setCloudMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [pendingBackup, setPendingBackup] = useState<{
    text: string;
    parsed: AuraLocalBackupV1;
    fileName: string;
  } | null>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    const refreshSession = () => setCloudSession(loadCloudSession());
    refreshSession();

    const onStatus = (event: Event) => {
      setCloudStatus(
        (event as CustomEvent<CloudSyncStatus>).detail ?? {
          state: "idle",
          message: "حالة المزامنة غير متاحة",
        },
      );
    };

    window.addEventListener(CLOUD_AUTH_CHANGED_EVENT, refreshSession);
    window.addEventListener(CLOUD_SYNC_STATUS_EVENT, onStatus);
    return () => {
      window.removeEventListener(CLOUD_AUTH_CHANGED_EVENT, refreshSession);
      window.removeEventListener(CLOUD_SYNC_STATUS_EVENT, onStatus);
    };
  }, []);
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

  async function handleCloudSignIn() {
    if (!email.trim() || password.length < 6) {
      setCloudMessage("أدخل البريد وكلمة مرور لا تقل عن 6 أحرف.");
      return;
    }
    setCloudBusy(true);
    setCloudMessage("");
    try {
      await signInCloud(email.trim(), password);
      await runFullCloudSync();
      setProfile(loadProfile());
      setHistory(loadHistory());
      setCloudMessage("تم تسجيل الدخول ومزامنة بياناتك.");
      setPassword("");
    } catch (error) {
      setCloudMessage(
        error instanceof Error ? error.message : "تعذر تسجيل الدخول.",
      );
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleCloudSignUp() {
    if (!email.trim() || password.length < 6) {
      setCloudMessage("أدخل البريد وكلمة مرور لا تقل عن 6 أحرف.");
      return;
    }
    setCloudBusy(true);
    setCloudMessage("");
    try {
      const result = await signUpCloud(email.trim(), password);
      if (result.session) {
        await runFullCloudSync();
        setProfile(loadProfile());
        setHistory(loadHistory());
        setCloudMessage("تم إنشاء الحساب ومزامنة بياناتك.");
      } else if (result.confirmationRequired) {
        setCloudMessage(
          "تم إنشاء الحساب. افتح رسالة التأكيد في بريدك ثم سجّل الدخول.",
        );
      } else {
        setCloudMessage("تم إرسال طلب إنشاء الحساب.");
      }
      setPassword("");
    } catch (error) {
      setCloudMessage(
        error instanceof Error ? error.message : "تعذر إنشاء الحساب.",
      );
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleCloudSync() {
    setCloudBusy(true);
    setCloudMessage("");
    try {
      const result = await runFullCloudSync();
      setProfile(loadProfile());
      setHistory(loadHistory());
      setCloudMessage(
        result.signedIn
          ? `تمت المزامنة: ${result.workouts} جلسة و${result.readiness} تقييم يومي.`
          : "سجّل الدخول أولًا.",
      );
    } catch (error) {
      setCloudMessage(
        error instanceof Error ? error.message : "تعذرت المزامنة.",
      );
    } finally {
      setCloudBusy(false);
    }
  }

  async function handleCloudSignOut() {
    setCloudBusy(true);
    try {
      await signOutCloud();
      setCloudMessage("تم تسجيل الخروج. بيانات الجهاز المحلية لم تُحذف.");
    } finally {
      setCloudBusy(false);
    }
  }

  function handleBackupExport() {
    try {
      const text = serializeLocalBackup();
      const blob = new Blob([text], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `aura-fit-backup-${date}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setBackupMessage(
        `تم تصدير ${history.length} جلسة. ملف النسخة لا يحتوي بيانات تسجيل الدخول السحابي.`,
      );
    } catch (error) {
      setBackupMessage(
        error instanceof Error ? error.message : "تعذر إنشاء النسخة الاحتياطية.",
      );
    }
  }

  async function handleBackupImport(file?: File) {
    if (!file) return;
    setBackupMessage("");
    setPendingBackup(null);
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error("ملف النسخة أكبر من الحد المسموح 10 MB.");
      }

      const text = await file.text();
      const parsed = parseLocalBackup(text);
      setPendingBackup({
        text,
        parsed,
        fileName: file.name,
      });
      setBackupMessage(
        "تم فحص النسخة بنجاح. راجع الملخص ثم أكد الاستعادة.",
      );
    } catch (error) {
      setBackupMessage(
        error instanceof Error ? error.message : "تعذر فحص النسخة.",
      );
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = "";
    }
  }

  function confirmBackupRestore() {
    if (!pendingBackup) return;
    try {
      const result = restoreLocalBackup(pendingBackup.text);
      setProfile(loadProfile());
      setHistory(loadHistory());
      setPendingBackup(null);
      setBackupMessage(
        `تمت الاستعادة: ${result.workouts} جلسة و${result.readiness} تقييم جاهزية. الحساب السحابي لم يتغير.`,
      );
    } catch (error) {
      setBackupMessage(
        error instanceof Error ? error.message : "تعذر استعادة النسخة.",
      );
    }
  }

  function cancelBackupRestore() {
    setPendingBackup(null);
    setBackupMessage("تم إلغاء الاستعادة ولم تتغير بيانات الجهاز.");
  }

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

        <div className="mb-4">
          <PwaInstallCard />
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

      <section className="relative px-6 mb-7 animate-enter [animation-delay:120ms]">
        <div
          className={
            "rounded-2xl border p-4 " +
            (cloudSession
              ? "border-primary/25 bg-primary/5"
              : "border-border bg-surface/60")
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                المزامنة السحابية
              </p>
              <h3 className="mt-1 text-sm font-black">
                {!cloudConfigured
                  ? "غير مفعلة على هذا الإصدار"
                  : cloudSession
                    ? "الحساب متصل"
                    : "اختيارية · Local-first"}
              </h3>
            </div>
            {cloudSession ? (
              <Cloud className="size-5 text-primary" />
            ) : (
              <CloudOff className="size-5 text-muted-foreground" />
            )}
          </div>

          {!cloudConfigured ? (
            <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
              أضف VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY لتفعيل
              الحسابات والمزامنة. يظل التطبيق المحلي يعمل بالكامل بدونها.
            </p>
          ) : cloudSession ? (
            <>
              <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
                <p className="truncate text-xs font-black" dir="ltr">
                  {cloudSession.user.email ?? cloudSession.user.id}
                </p>
                <p className="mt-1 text-[9px] text-muted-foreground">
                  {cloudStatus.message}
                </p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={handleCloudSync}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-xs font-black text-primary-foreground disabled:opacity-50"
                >
                  <RefreshCw className={"size-3.5 " + (cloudBusy ? "animate-spin" : "")} />
                  مزامنة الآن
                </button>
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={handleCloudSignOut}
                  className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-3 text-xs font-bold text-muted-foreground disabled:opacity-50"
                >
                  <LogOut className="size-3.5" />
                  خروج
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 space-y-2">
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="البريد الإلكتروني"
                  dir="ltr"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="كلمة المرور"
                  dir="ltr"
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={handleCloudSignIn}
                  className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-xs font-black text-primary-foreground disabled:opacity-50"
                >
                  <LogIn className="size-3.5" />
                  دخول
                </button>
                <button
                  type="button"
                  disabled={cloudBusy}
                  onClick={handleCloudSignUp}
                  className="rounded-xl border border-border bg-background/50 px-3 py-3 text-xs font-bold disabled:opacity-50"
                >
                  إنشاء حساب
                </button>
              </div>
            </>
          )}

          {cloudMessage && (
            <p className="mt-3 rounded-lg border border-border bg-background/40 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              {cloudMessage}
            </p>
          )}

          <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
            تسجيل الدخول اختياري. يبقى سجل الجهاز متاحًا محليًا، وتُستخدم
            السحابة للنسخ والمزامنة بين الأجهزة عند تفعيلها.
          </p>
        </div>
      </section>

      <section className="relative px-6 mb-7 animate-enter [animation-delay:135ms]">
        <div className="rounded-2xl border border-border bg-surface/60 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                نسخة الجهاز
              </p>
              <h3 className="mt-1 text-sm font-black">
                تصدير واستعادة بيانات التدريب
              </h3>
            </div>
            <HardDrive className="size-5 text-primary" />
          </div>

          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            احفظ ملف JSON يحتوي ملف التدريب، تقييمات الجاهزية وسجل الجلسات.
            لا يتم تضمين جلسة Supabase أو رموز تسجيل الدخول.
          </p>

          <input
            ref={backupInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => void handleBackupImport(event.target.files?.[0])}
          />

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleBackupExport}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-xs font-black text-primary-foreground"
            >
              <Download className="size-3.5" />
              تنزيل نسخة
            </button>
            <button
              type="button"
              onClick={() => backupInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background/50 px-3 py-3 text-xs font-bold"
            >
              <Upload className="size-3.5" />
              فحص ملف للاستعادة
            </button>
          </div>

          {pendingBackup && (
            <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/5 p-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
                تأكيد الاستعادة
              </p>
              <p className="mt-1 truncate text-xs font-black" dir="ltr">
                {pendingBackup.fileName}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <BackupPreviewMetric
                  label="جلسات"
                  value={String(pendingBackup.parsed.workouts.length)}
                />
                <BackupPreviewMetric
                  label="جاهزية"
                  value={String(pendingBackup.parsed.readiness.length)}
                />
                <BackupPreviewMetric
                  label="أيام أسبوعيًا"
                  value={String(pendingBackup.parsed.profile.daysPerWeek)}
                />
              </div>
              <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
                تاريخ النسخة:{" "}
                {new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
                  dateStyle: "medium",
                  timeStyle: "short",
                }).format(new Date(pendingBackup.parsed.exportedAt))}
                . التأكيد سيستبدل بيانات التدريب المحلية الحالية فقط، ولن
                يغيّر جلسة الحساب السحابي.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={confirmBackupRestore}
                  className="rounded-xl bg-amber-400 px-3 py-2.5 text-xs font-black text-black"
                >
                  تأكيد الاستعادة
                </button>
                <button
                  type="button"
                  onClick={cancelBackupRestore}
                  className="rounded-xl border border-border bg-background/60 px-3 py-2.5 text-xs font-bold"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {backupMessage && (
            <p className="mt-3 rounded-lg border border-border bg-background/40 p-2.5 text-[10px] leading-relaxed text-muted-foreground">
              {backupMessage}
            </p>
          )}
        </div>
      </section>

      <section className="relative px-6 mb-7 animate-enter [animation-delay:140ms]">
        <div
          className={
            "rounded-2xl border p-4 " +
            (profile.injuries.length
              ? "border-amber-400/25 bg-amber-400/5"
              : "border-primary/20 bg-primary/5")
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
                فلترة الحركة
              </p>
              <h3 className="mt-1 text-sm font-black">
                {profile.injuries.length
                  ? "مناطق تحتاج احتياطًا"
                  : "لا توجد قيود مسجلة"}
              </h3>
            </div>
            <ShieldCheck
              className={
                "size-5 " +
                (profile.injuries.length ? "text-amber-400" : "text-primary")
              }
            />
          </div>
          {profile.injuries.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.injuries.map((injury) => (
                <span
                  key={injury}
                  className="rounded-full border border-amber-400/20 bg-background/60 px-2.5 py-1 text-[9px] font-bold text-amber-400"
                >
                  {INJURY_LABEL_AR[injury]}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[10px] text-muted-foreground">
              يمكنك تسجيل مناطق الإصابة أو القيود من الأهداف والمعدات.
            </p>
          )}
        </div>
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
            label="الأهداف والمعدات والإصابات"
            hint="تعديل"
          />
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function BackupPreviewMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-2">
      <p className="text-sm font-black" dir="ltr">
        {value}
      </p>
      <p className="mt-0.5 text-[8px] text-muted-foreground">{label}</p>
    </div>
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
