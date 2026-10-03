import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Dumbbell,
  ExternalLink,
  Play,
  Repeat,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { AthleteVideo } from "@/components/athlete-video";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";
import {
  CATEGORY_LABEL_AR,
  EQUIPMENT_LABEL_AR,
  EXERCISE_TYPE_LABEL_AR,
  getExercise,
  GOAL_LABEL_AR,
  INJURY_LABEL_AR,
  INJURY_SCREENING_NOTE_AR,
  LEVEL_LABEL_AR,
  LOCATION_LABEL_AR,
  MOVEMENT_FAMILY_LABEL_AR,
  MUSCLE_LABEL_AR,
} from "@/lib/exercise-db";
import {
  analyzeExerciseStrength,
  loadHistory,
  loadProfile,
} from "@/lib/user-profile";
import {
  getExerciseProgressionPrescription,
  getTrainingAdaptation,
} from "@/lib/workout-engine";

export const Route = createFileRoute("/exercise/$id")({
  component: ExerciseDetail,
});

function ExerciseDetail() {
  const { id } = Route.useParams();
  const exercise = getExercise(id);
  if (!exercise) throw notFound();

  const [tab, setTab] = useState<"overview" | "motion" | "safety" | "source">("overview");
  const history = useMemo(() => loadHistory(), []);
  const profile = useMemo(() => loadProfile(), []);
  const adaptation = useMemo(
    () => getTrainingAdaptation(profile, history),
    [profile, history],
  );
  const strength = useMemo(
    () => analyzeExerciseStrength(history, exercise.id),
    [history, exercise.id],
  );
  const progression = useMemo(
    () =>
      getExerciseProgressionPrescription(
        exercise.id,
        exercise.recommendedReps,
        history,
        adaptation.mode,
      ),
    [adaptation.mode, exercise.id, exercise.recommendedReps, history],
  );
  const primary = exercise.primary.map((muscle) => MUSCLE_LABEL_AR[muscle]).join("، ");
  const secondary = exercise.secondary.map((muscle) => MUSCLE_LABEL_AR[muscle]).join("، ");
  const equipment = exercise.equipment.map((item) => EQUIPMENT_LABEL_AR[item]).join("، ");
  const matchingInjuries = exercise.contraindicated.filter((injury) =>
    profile.injuries.includes(injury),
  );

  return (
    <PageShell>
      <div className="px-6 pt-10 pb-4 flex items-center justify-between animate-enter">
        <Link
          to="/exercises"
          className="size-10 rounded-full bg-surface border border-border flex items-center justify-center"
          aria-label="رجوع"
        >
          <ChevronRight className="size-4" />
        </Link>

        <span className="max-w-[250px] truncate text-[10px] font-medium tracking-wide text-muted-foreground">
          {exercise.media.gif ? "فيديو مطابق" : "حركة مطابقة"} · {exercise.latin}
        </span>

        <div className="size-10 rounded-full bg-primary/10 border border-primary/20 grid place-items-center text-primary">
          <Dumbbell className="size-4" />
        </div>
      </div>

      <section className="px-6 mb-5 animate-enter">
        <div className="relative aspect-[4/3] rounded-3xl bg-card border border-border overflow-hidden">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "linear-gradient(rgba(204,255,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(204,255,0,0.15) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden
          />

          <motion.div
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <AthleteVideo
              exerciseId={exercise.id}
              pose={exercise.pose}
              running
              tempo={exercise.tempo}
              size={320}
            />
          </motion.div>

          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background/80 to-transparent">
            <h1 className="font-display text-[1.55rem] font-extrabold leading-[1.35]">{exercise.name}</h1>
            <p dir="ltr" className="mt-1 text-left text-[11px] font-medium tracking-wide text-primary">
              {exercise.latin}
            </p>
          </div>
        </div>
      </section>

      {matchingInjuries.length > 0 && (
        <section className="px-6 mb-5 animate-enter">
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-400" />
              <div>
                <p className="text-sm font-black text-amber-400">
                  مستبعد من خطتك الحالية
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  هذه الحركة تحمل وسم فحص احترازي لـ{" "}
                  {matchingInjuries
                    .map((injury) => INJURY_LABEL_AR[injury])
                    .join("، ")}.
                </p>
                <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
                  {INJURY_SCREENING_NOTE_AR}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="px-6 mb-5 grid grid-cols-3 gap-2 animate-enter">
        <QuickStat icon={Target} label="التركيز" value={primary} />
        <QuickStat icon={Repeat} label="التكرار" value={exercise.recommendedReps} />
        <QuickStat
          icon={Wind}
          label="تقدير السعرات"
          value={"≈ " + exercise.caloriesPerMin + "/د"}
        />
      </div>

      <div className="px-6 mb-5 sticky top-0 z-10 bg-background/85 backdrop-blur-xl py-2">
        <div className="bg-surface border border-border rounded-xl p-1 flex">
          {[
            { id: "overview", label: "الملخص" },
            { id: "motion", label: "الحركة" },
            { id: "safety", label: "السلامة" },
            { id: "source", label: "المصدر" },
          ].map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id as typeof tab)}
                className={
                  "flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors " +
                  (active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <section className="px-6 min-h-[300px] pb-40">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-4"
          >
            {tab === "overview" && (
              <>
                <Card>
                  <CardHeader label="عن التمرين" />
                  <p className="type-body text-foreground/90">{exercise.descriptionAr}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <InfoChip>{CATEGORY_LABEL_AR[exercise.category]}</InfoChip>
                    <InfoChip>{LEVEL_LABEL_AR[exercise.level]}</InfoChip>
                    <InfoChip>{EXERCISE_TYPE_LABEL_AR[exercise.exerciseType]}</InfoChip>
                    <InfoChip>{MOVEMENT_FAMILY_LABEL_AR[exercise.movementFamily]}</InfoChip>
                    {exercise.location.map((location) => (
                      <InfoChip key={location}>{LOCATION_LABEL_AR[location]}</InfoChip>
                    ))}
                  </div>

                  <div className="mt-4 border-t border-border pt-3 text-sm leading-7 text-muted-foreground">
                    <p><span className="font-semibold text-foreground">العضلة الأساسية:</span> {primary}</p>
                    {secondary ? <p><span className="font-semibold text-foreground">عضلات مساعدة:</span> {secondary}</p> : null}
                    <p><span className="font-semibold text-foreground">المعدات:</span> {equipment}</p>
                    <p><span className="font-semibold text-foreground">الهدف:</span> {exercise.goals.map((goal) => GOAL_LABEL_AR[goal]).join("، ")}</p>
                  </div>
                </Card>

                {strength && (
                  <Card className={strength.plateau ? "border-amber-400/30" : "border-primary/20"}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardHeader label="تقدمك في هذا التمرين" icon={TrendingUp} />
                        <p className="text-sm font-black">
                          {strength.trend === "up"
                            ? "القوة في اتجاه صاعد"
                            : strength.trend === "down"
                              ? "القوة انخفضت مؤخرًا"
                              : "القوة مستقرة مؤخرًا"}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {strength.sessions} جلسات مسجلة ·{" "}
                          {strength.trendPercent > 0 ? "+" : ""}
                          {strength.trendPercent}% عبر آخر التسجيلات
                        </p>
                      </div>
                      {strength.trend === "up" ? (
                        <TrendingUp className="size-5 text-primary" />
                      ) : strength.trend === "down" ? (
                        <TrendingDown className="size-5 text-cyan" />
                      ) : (
                        <Target className="size-5 text-muted-foreground" />
                      )}
                    </div>

                    <div className="mt-4 h-16 rounded-xl bg-background/50 px-2 py-1">
                      <ExerciseStrengthSparkline
                        values={strength.points
                          .slice(-8)
                          .map((point) => point.bestEstimated1RmKg)}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <DetailMetric
                        label="آخر حمل"
                        value={strength.lastLoadKg + " كجم"}
                      />
                      <DetailMetric
                        label="أفضل e1RM"
                        value={strength.bestEstimated1RmKg + " كجم"}
                      />
                      <DetailMetric
                        label="حجم آخر جلسة"
                        value={strength.latestLoadVolumeKgReps + ""}
                      />
                    </div>

                    {(strength.latestLoadIsPr ||
                      strength.latestEstimated1RmIsPr) &&
                      strength.sessions > 1 && (
                        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3 text-[10px] font-bold text-primary">
                          رقم شخصي جديد:
                          {strength.latestLoadIsPr ? " أعلى حمل" : ""}
                          {strength.latestLoadIsPr &&
                          strength.latestEstimated1RmIsPr
                            ? " +"
                            : ""}
                          {strength.latestEstimated1RmIsPr
                            ? " أعلى e1RM تقديري"
                            : ""}
                        </div>
                      )}

                    {strength.plateau && (
                      <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-3">
                        <p className="text-[10px] font-bold text-amber-400">
                          Plateau محتمل
                        </p>
                        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                          آخر أربع تسجيلات تحركت ضمن نطاق ضيق. راجع النوم وRIR
                          والحجم قبل تغيير التمرين أو إضافة حمل.
                        </p>
                      </div>
                    )}

                    <div className="mt-3 border-t border-border pt-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                        التوصية التالية
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-foreground/85">
                        {progression.note}
                      </p>
                      {progression.suggestedLoadKg !== undefined && (
                        <p className="mt-2 font-mono text-sm font-black">
                          الحمل المقترح: {progression.suggestedLoadKg} كجم · RIR{" "}
                          {progression.targetRir}
                        </p>
                      )}
                    </div>

                    <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
                      e1RM وحجم الحمل مؤشرات تدريبية تقديرية مشتقة من الوزن
                      والتكرارات وRIR، وليست اختبار قوة مباشر.
                    </p>
                  </Card>
                )}

                <Card>
                  <CardHeader label="تنبيه المدرب" />
                  <p className="type-body">{exercise.cue}</p>
                </Card>

                <Card>
                  <CardHeader label="التنفس" icon={Wind} />
                  <p className="type-body text-muted-foreground">{exercise.breathing}</p>
                </Card>
              </>
            )}

            {tab === "motion" && (
              <>
                <Card>
                  <CardHeader
                    label={exercise.media.gif ? "فيديو الحركة المطابق" : "الإطارات المطابقة للتمرين"}
                  />

                  {exercise.media.gif ? (
                    <>
                      <AthleteVideo
                        exerciseId={exercise.id}
                        pose={exercise.pose}
                        running
                        tempo={exercise.tempo}
                        fluid
                      />
                      <p className="type-small mt-3 text-muted-foreground">
                        هذا الـGIF مرتبط مباشرة بنفس معرّف التمرين في
                        hasaneyldrm/exercises-dataset: {exercise.media.sourceExerciseId}. مستوى
                        المطابقة: {exercise.media.matchConfidence === "exact" ? "تطابق اسمي" : "ثقة مرتفعة"}.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="type-small mb-4 text-muted-foreground">
                        {exercise.media.matchConfidence === "review"
                          ? "توجد مطابقة مرشحة تحتاج مراجعة فنية؛ لن يتم تشغيلها تلقائيًا، لذلك يعرض التطبيق إطارات Workout Guide الآمنة كـ fallback."
                          : "لا توجد مطابقة GIF مؤكدة لهذا التمرين حاليًا، لذلك يعرض التطبيق إطارات Workout Guide الأصلية كـ fallback."}
                      </p>

                      <div className="grid grid-cols-3 gap-2" dir="ltr">
                        {exercise.media.frames.map((frame, index) => (
                          <div
                            key={frame}
                            className="rounded-xl border border-border bg-background p-1"
                          >
                            <img
                              src={frame}
                              alt={"إطار " + (index + 1) + " لتمرين " + exercise.latin}
                              className="aspect-square size-full object-contain"
                            />
                            <p className="mt-1 text-center text-[9px] font-medium text-primary">
                              إطار {index + 1}
                            </p>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>

                <Card>
                  <CardHeader label="خطوات الأداء بالعربية" icon={CheckCircle2} />
                  <ol className="space-y-3">
                    {exercise.instructionsAr.map((step, index) => (
                      <li key={step} className="flex items-start gap-3 type-body">
                        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </Card>

                <Card>
                  <CardHeader label="قاعدة مطابقة الحركة" icon={Shield} />
                  <p className="type-small text-muted-foreground">
                    الخطوات العربية مرتبطة بنوع هذا التمرين وبالإطارات الثلاثة الأصلية الخاصة به.
                    وعندما تتوفر مطابقة موثقة في مصدر التعليمات، يبقى النص الإنجليزي الأصلي محفوظًا
                    في تبويب المصدر للمراجعة الفنية.
                  </p>
                </Card>
              </>
            )}

            {tab === "safety" && (
              <>
                <Card className="border-primary/30">
                  <CardHeader label="إرشادات عامة" icon={CheckCircle2} />
                  <ul className="space-y-2">
                    {exercise.safety.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <span className="text-primary mt-1">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="border-destructive/30">
                  <CardHeader
                    label="أخطاء عامة يجب تجنبها"
                    icon={AlertTriangle}
                    tone="danger"
                  />
                  <ul className="space-y-2">
                    {exercise.mistakes.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm">
                        <span className="text-destructive mt-1">✕</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card>
                  <CardHeader label="علامات فحص احترازية" icon={Shield} />
                  {exercise.contraindicated.length ? (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {exercise.contraindicated.map((injury) => (
                          <span
                            key={injury}
                            className="rounded-full border border-border bg-surface px-3 py-1 text-xs"
                          >
                            {INJURY_LABEL_AR[injury]}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-3">
                        هذه العلامات مشتقة آليًا من اسم ونمط الحركة للحفاظ على فلتر
                        التطبيق، وليست حكماً طبياً أو قائمة موانع نهائية.
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      لا توجد علامة احترازية مشتقة لهذا التمرين في الكتالوج الحالي.
                    </p>
                  )}
                </Card>
              </>
            )}

            {tab === "source" && (
              <>
                <Card>
                  <CardHeader label="مصدر الحركة والصور" icon={ExternalLink} />
                  {exercise.media.gif ? (
                    <>
                      <p className="text-sm font-bold">hasaneyldrm/exercises-dataset</p>
                      <p className="type-small mt-1 text-muted-foreground">
                        المصدر المطابق: {exercise.media.sourceName} · ID{" "}
                        {exercise.media.sourceExerciseId}. تم تثبيت الربط على commit{" "}
                        {exercise.media.sourceCommit?.slice(0, 12)}.
                      </p>
                      <a
                        href={exercise.media.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-primary"
                      >
                        فتح مصدر الفيديو <ExternalLink className="size-3" />
                      </a>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-bold">Workout Guide · Bryl Lim</p>
                      <p className="type-small mt-1 text-muted-foreground">
                        الإطارات: CC BY-SA 4.0 · الإسناد: {exercise.media.fallback.attribution}. تم تثبيت
                        الاستيراد على commit {exercise.media.fallback.sourceCommit.slice(0, 12)}.
                      </p>
                      <a
                        href={exercise.media.fallback.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs text-primary"
                      >
                        فتح مصدر الإطارات <ExternalLink className="size-3" />
                      </a>
                    </>
                  )}
                </Card>

                <Card>
                  <CardHeader label="مصدر التعليمات" />
                  <p className="type-small text-muted-foreground">
                    {exercise.media.gif
                      ? "تمت مطابقة هذا التمرين مع exercises-dataset باستخدام نفس sourceId، ويستخدم التطبيق الـGIF والصورة والتعليمات المرتبطة بهذا السجل."
                      : exercise.sourceInstructionsEn
                        ? "توجد مطابقة موثقة لنص التعليمات، لكن لا توجد وسائط GIF مفعلة لهذا السجل في خريطة الوسائط الحالية."
                        : "لا توجد مطابقة قطعية مع مصدر التعليمات الإضافي، لذلك يعتمد التطبيق على البيانات المنظمة والإطارات الأصلية."}
                  </p>

                  {exercise.sourceInstructionStepsEn?.length ? (
                    <details className="mt-4 rounded-xl border border-border bg-background/60 p-3">
                      <summary className="cursor-pointer text-xs font-semibold text-primary">
                        عرض النص الإنجليزي الأصلي للمراجعة
                      </summary>
                      <ol dir="ltr" className="mt-3 list-decimal space-y-2 pl-5 text-left text-xs leading-6 text-muted-foreground">
                        {exercise.sourceInstructionStepsEn.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </details>
                  ) : null}
                </Card>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </section>

      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 z-40">
        <Link
          to="/workout"
          search={{ day: undefined }}
          className="w-full bg-primary text-primary-foreground font-black py-4 rounded-2xl uppercase tracking-widest text-sm active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(204,255,0,0.4)]"
        >
          <Play className="size-4 fill-current" />
          ابدأ جلسة تدريب
        </Link>
      </div>

      <BottomNav />
    </PageShell>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={"bg-card border border-border rounded-2xl p-4 " + className}>
      {children}
    </div>
  );
}

function CardHeader({
  label,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "danger";
}) {
  const color = tone === "danger" ? "text-destructive" : "text-muted-foreground";
  return (
    <div className={"flex items-center gap-2 mb-2 " + color}>
      {Icon && <Icon className="size-4" />}
      <p className="type-caption font-semibold">{label}</p>
    </div>
  );
}

function QuickStat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 min-w-0">
      <Icon className="size-4 text-primary mb-2" />
      <p className="type-caption text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold">{value}</p>
    </div>
  );
}


function DetailMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-background/60 p-2.5 text-center">
      <p className="font-mono text-[11px] font-black">{value}</p>
      <p className="mt-0.5 text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ExerciseStrengthSparkline({ values }: { values: number[] }) {
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

function InfoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-foreground/85">
      {children}
    </span>
  );
}
