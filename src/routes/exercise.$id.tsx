import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronRight,
  Play,
  AlertTriangle,
  CheckCircle2,
  Wind,
  Volume2,
  Repeat,
  Target,
  Shield,
} from "lucide-react";
import { AnimatePresence, motion, LayoutGroup } from "framer-motion";
import { EXERCISES } from "./exercises";
import { PageShell } from "@/components/page-shell";
import { BottomNav } from "@/components/bottom-nav";
import {
  AthletePose2D,
  MuscleAnatomy2D,
  type MuscleFocus,
  type PoseSpot,
} from "@/components/athlete-2d";
import { PostureCompare, PostureSlider } from "@/components/posture-compare";
import { AthleteVideo } from "@/components/athlete-video";

export const Route = createFileRoute("/exercise/$id")({
  component: ExerciseDetail,
});

type Step = { title: string; body: string; focus: MuscleFocus; spot: PoseSpot };

function poseFromCategory(category: string) {
  if (category === "chest") return "push-up" as const;
  if (category === "legs") return "squat" as const;
  if (category === "core") return "plank" as const;
  return "default" as const;
}

const STEPS_MAP: Record<string, Step[]> = {
  "pull-up": [
    { title: "الوضع الابتدائي", body: "أمسك البار بقبضة عريضة قليلاً من الكتف، الأكتاف مفعّلة.", focus: "shoulder", spot: { x: 100, y: 22, r: 24, label: "قبضة" } },
    { title: "التفعيل", body: "اسحب لوحي الكتف للأسفل والخلف قبل البدء بالحركة.", focus: "back", spot: { x: 100, y: 60, r: 28, label: "لوحا الكتف" } },
    { title: "الحركة الصاعدة", body: "اسحب الصدر باتجاه البار مع الحفاظ على جذع مستقر.", focus: "arms", spot: { x: 100, y: 110, r: 30, label: "ظهر · بايسبس" } },
    { title: "النزول المتحكم", body: "انزل ببطء خلال ٢-٣ ثوانٍ للحفاظ على التوتر العضلي.", focus: "core", spot: { x: 100, y: 160, r: 28, label: "توتر مركزي" } },
  ],
  "push-up": [
    { title: "الوضع الابتدائي", body: "اليدان بعرض الكتفين، الجسم في خط مستقيم.", focus: "core", spot: { x: 110, y: 180, r: 26, label: "بلانك" } },
    { title: "النزول", body: "اثنِ المرفقين بزاوية ٤٥° حتى يقترب الصدر من الأرض.", focus: "chest", spot: { x: 60, y: 170, r: 22, label: "مرفق" } },
    { title: "الصعود", body: "ادفع بقوة مع تفعيل عضلات البطن والصدر.", focus: "chest", spot: { x: 120, y: 170, r: 26, label: "صدر" } },
  ],
};

const MISTAKES_MAP: Record<string, string[]> = {
  "pull-up": ["تأرجح الجسم", "عدم تفعيل الأكتاف", "نزول سريع بدون تحكم"],
  "push-up": ["هبوط الحوض", "فتح المرفقين للجانب", "عدم اكتمال المدى"],
  "squat": ["تقوس الظهر", "دخول الركبتين للداخل", "عدم الوصول للعمق الكامل"],
  "deadlift": ["تقوس الظهر السفلي", "بدء الحركة من الظهر", "قفل الركبتين المبكر"],
};

const DEFAULT_STEPS: Step[] = [
  { title: "الاستعداد", body: "ثبّت الجذع وتحقق من الوضعية الأولية.", focus: "core", spot: { x: 100, y: 130, r: 26, label: "جذع" } },
  { title: "المرحلة الأولى", body: "ابدأ الحركة بتحكم كامل من العضلة المستهدفة.", focus: "chest", spot: { x: 100, y: 100, r: 24, label: "بداية" } },
  { title: "المرحلة الختامية", body: "أكمل المدى ثم ارجع ببطء إلى نقطة البداية.", focus: "legs", spot: { x: 100, y: 210, r: 26, label: "قاعدة" } },
];


function ExerciseDetail() {
  const { id } = Route.useParams();
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw notFound();

  const [tab, setTab] = useState<"overview" | "form" | "safety" | "muscles">("overview");
  const [activeStep, setActiveStep] = useState(0);
  const steps: Step[] = STEPS_MAP[ex.id] ?? DEFAULT_STEPS;
  const mistakes = MISTAKES_MAP[ex.id] ?? ["تسرّع الحركة", "تنفس غير منتظم", "وضعية غير سليمة"];
  const current = steps[Math.min(activeStep, steps.length - 1)];
  const heroSpot = tab === "form" ? current.spot : null;
  const heroFocus = tab === "form" ? current.focus : null;

  return (
    <PageShell>
      {/* Top bar */}
      <div className="px-6 pt-10 pb-4 flex items-center justify-between animate-enter">
        <Link
          to="/exercises"
          className="size-10 rounded-full bg-surface border border-border flex items-center justify-center"
          aria-label="رجوع"
        >
          <ChevronRight className="size-4" />
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          MOTION COACH · {ex.latin}
        </span>
        <button
          type="button"
          className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-primary"
          aria-label="تعليمات صوتية"
        >
          <Volume2 className="size-4" />
        </button>
      </div>

      {/* Hero animation area */}
      <section className="px-6 mb-5 animate-enter">
        <div className="relative aspect-[4/3] rounded-3xl bg-card border border-border overflow-hidden">
          <div className={`absolute inset-0 bg-gradient-to-bl ${ex.color} opacity-80`} aria-hidden />
          {/* Grid HUD */}
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(204,255,0,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(204,255,0,0.15) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
            }}
            aria-hidden
          />
          {/* Real-athlete movement clip */}
          <motion.div
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, scale: 0.85, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <AthleteVideo
              exerciseId={ex.id}
              pose={poseFromCategory(ex.category)}
              running
              tempo={3}
              size={320}
            />
          </motion.div>
          {/* HUD corners */}
          {["top-3 right-3", "top-3 left-3", "bottom-3 right-3", "bottom-3 left-3"].map((p) => (
            <div key={p} className={`absolute ${p} size-4 border-primary`} aria-hidden>
              <div className="w-full h-[2px] bg-primary" />
              <div className="h-full w-[2px] bg-primary" />
            </div>
          ))}
          {/* Bottom overlay */}
          <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-background via-background/70 to-transparent">
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-3xl font-black leading-tight">{ex.name}</h1>
                <p className="text-xs text-muted-foreground mt-1">
                  {ex.primary} · {ex.level}
                </p>
              </div>
              <div className="text-left">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                  ROM
                </p>
                <p className="font-mono text-primary text-lg">100%</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <div className="px-6 mb-5 grid grid-cols-3 gap-2 animate-enter">
        <QuickStat icon={Target} label="التركيز" value={ex.primary} />
        <QuickStat icon={Repeat} label="التكرار" value="١٢×٤" />
        <QuickStat icon={Wind} label="السعرات" value={`${ex.calories}/د`} />
      </div>

      {/* Tabs */}
      <div className="px-6 mb-5 sticky top-0 z-10 bg-background/80 backdrop-blur-xl py-2 -mt-2">
        <LayoutGroup id="exercise-tabs">
          <div className="bg-surface border border-border rounded-xl p-1 flex">
            {[
              { id: "overview", label: "الأداء" },
              { id: "form", label: "الخطوات" },
              { id: "safety", label: "السلامة" },
              { id: "muscles", label: "العضلات" },
            ].map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id as typeof tab)}
                  className={`relative flex-1 py-2 text-[11px] font-bold rounded-lg transition-colors ${
                    active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-primary rounded-lg shadow-[0_6px_18px_rgba(204,255,0,0.35)]"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative">{t.label}</span>
                </button>
              );
            })}
          </div>
        </LayoutGroup>
      </div>

      <section className="px-6 min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12, scale: 0.98, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, scale: 0.99, filter: "blur(4px)" }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-4"
          >
        {tab === "overview" && (
          <>
            <Card>
              <CardHeader label="ملخص المدرب الذكي" />
              <p className="text-sm leading-relaxed text-foreground/90">
                تمرين {ex.name} يستهدف {ex.primary} بشكل أساسي مع تفعيل ثانوي لـ{" "}
                {ex.secondary.join("، ")}. مناسب لمستوى {ex.level}. حافظ على التنفس المنتظم وتفعيل
                الجذع طوال الحركة.
              </p>
            </Card>
            <Card>
              <CardHeader label="التنفس" />
              <div className="flex items-center gap-3">
                <div className="size-12 rounded-full bg-primary/10 border border-primary/30 grid place-items-center text-primary">
                  <Wind className="size-5" />
                </div>
                <div className="text-sm">
                  <p className="font-bold">شهيق عند الاستعداد</p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    زفير قوي عند بذل الجهد الأقصى
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}

        {tab === "form" && (
          <>
            <Card>
              <CardHeader label={`الخطوة ${activeStep + 1} / ${steps.length} · إبراز حي`} />
              <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
                <div>
                  <p className="font-black text-lg">{current.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                    {current.body}
                  </p>
                  <p className="mt-3 text-[10px] font-mono uppercase tracking-widest text-primary">
                    ◉ {current.spot.label} · {muscleLabel(current.focus)}
                  </p>
                </div>
                <div className="shrink-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStep}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <MuscleAnatomy2D primary={ex.primary} focus={heroFocus} />
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
              <div className="mt-3 flex gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      i <= activeStep ? "bg-primary" : "bg-border"
                    }`}
                  />
                ))}
              </div>
            </Card>

            <ol className="space-y-3">
              {steps.map((s, i) => {
                const active = i === activeStep;
                return (
                  <li key={i}>
                    <motion.button
                      type="button"
                      onClick={() => setActiveStep(i)}
                      className={`w-full text-right block rounded-2xl border p-4 transition-colors ${
                        active
                          ? "bg-primary/10 border-primary/60"
                          : "bg-card border-border hover:border-primary/30"
                      }`}
                      whileTap={{ scale: 0.985 }}
                      layout
                    >
                      <div className="flex gap-4 items-start">
                        <motion.div
                          className={`size-10 rounded-xl font-black grid place-items-center shrink-0 ${
                            active
                              ? "bg-primary text-primary-foreground shadow-[0_0_18px_rgba(204,255,0,0.5)]"
                              : "bg-surface text-muted-foreground"
                          }`}
                          animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                          transition={{ duration: 1.4, repeat: active ? Infinity : 0 }}
                        >
                          {i + 1}
                        </motion.div>
                        <div className="flex-1">
                          <p className="font-black mb-1">{s.title}</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
                          <p className="mt-2 text-[9px] font-mono uppercase tracking-widest text-primary/80">
                            {muscleLabel(s.focus)}
                          </p>
                        </div>
                      </div>
                    </motion.button>
                  </li>
                );
              })}
            </ol>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveStep((s) => Math.max(0, s - 1))}
                disabled={activeStep === 0}
                className="flex-1 py-3 rounded-xl border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground disabled:opacity-40"
              >
                السابقة
              </button>
              <button
                type="button"
                onClick={() => setActiveStep((s) => Math.min(steps.length - 1, s + 1))}
                disabled={activeStep === steps.length - 1}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-xs font-black uppercase tracking-widest disabled:opacity-40"
              >
                التالية ←
              </button>
            </div>
          </>
        )}

        {tab === "safety" && (
          <>
            <Card>
              <CardHeader label="مقارنة قبل / بعد · اسحب المؤشر" icon={Shield} />
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                حرّك الشريط أفقياً لتبديل العرض بين الوضعية الصحيحة والخطأ الشائع على نفس المشهد.
              </p>
              <PostureSlider exerciseId={ex.id} />
            </Card>

            <Card>
              <CardHeader label="مقارنة بصرية · صحيح مقابل خطأ" icon={Shield} />
              <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                طبقات توضيحية ثنائية الأبعاد تُظهر الوضعية السليمة والأخطاء الشائعة مع تحديد المفصل الخطر.
              </p>
              <PostureCompare exerciseId={ex.id} />
            </Card>


            <Card className="border-destructive/40">
              <CardHeader label="قائمة الأخطاء" icon={AlertTriangle} tone="danger" />
              <ul className="space-y-2 mt-2">
                {mistakes.map((m) => (
                  <li key={m} className="flex items-start gap-2 text-sm">
                    <span className="text-destructive mt-1">✕</span>
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="border-primary/40">
              <CardHeader label="التنفيذ الصحيح" icon={CheckCircle2} tone="success" />
              <ul className="space-y-2 mt-2">
                <li className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1">✓</span>
                  <span>وضعية محايدة للعمود الفقري طوال الحركة</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1">✓</span>
                  <span>تحكم كامل بالنزول والصعود</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <span className="text-primary mt-1">✓</span>
                  <span>تفعيل مسبق للجذع قبل بدء الحركة</span>
                </li>
              </ul>
            </Card>

            <Card>
              <CardHeader label="بدائل التمرين" icon={Shield} />
              <div className="grid grid-cols-2 gap-2 mt-2">
                {["نسخة مساعدة", "نطاق أقصر", "دون معدات", "بند مقاوم"].map((a) => (
                  <div
                    key={a}
                    className="text-xs bg-surface border border-border rounded-xl p-3 text-center font-bold"
                  >
                    {a}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === "muscles" && (
          <Card>
            <CardHeader label="خريطة تفعيل العضلات" />
            <div className="mt-4 flex items-center justify-center">
              <MuscleAnatomy2D primary={ex.primary} />
            </div>
            <div className="mt-4 space-y-2">
              <MuscleRow label={ex.primary} pct={92} tone="primary" />
              {ex.secondary.map((s, i) => (
                <MuscleRow key={s} label={s} pct={65 - i * 15} tone="secondary" />
              ))}
            </div>
          </Card>
        )}
          </motion.div>
        </AnimatePresence>
      </section>

      {/* CTA */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 z-40">
        <Link
          to="/workout"
          className="w-full bg-primary text-primary-foreground font-black py-4 rounded-2xl uppercase tracking-widest text-sm active:scale-[0.98] flex items-center justify-center gap-2 shadow-[0_10px_30px_rgba(204,255,0,0.4)]"
        >
          <Play className="size-4 fill-current" />
          ابدأ التمرين
        </Link>
      </div>

      <BottomNav />
    </PageShell>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-2xl p-4 ${className}`}>{children}</div>
  );
}

function CardHeader({
  label,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "danger";
}) {
  const color =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-primary"
        : "text-muted-foreground";
  return (
    <div className={`flex items-center gap-2 mb-2 ${color}`}>
      {Icon && <Icon className="size-4" />}
      <p className="text-[10px] font-mono uppercase tracking-widest">{label}</p>
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
    <div className="bg-card border border-border rounded-2xl p-3">
      <Icon className="size-4 text-primary mb-2" />
      <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-xs font-black mt-1 truncate">{value}</p>
    </div>
  );
}

function MuscleRow({ label, pct, tone }: { label: string; pct: number; tone: "primary" | "secondary" }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className={tone === "primary" ? "text-primary" : "text-foreground/70"}>{pct}%</span>
      </div>
      <div className="h-1.5 bg-surface rounded-full overflow-hidden">
        <div
          className={tone === "primary" ? "h-full bg-primary" : "h-full bg-foreground/40"}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const MUSCLE_LABELS: Record<MuscleFocus, string> = {
  chest: "الصدر",
  back: "الظهر",
  legs: "الأرجل",
  shoulder: "الأكتاف",
  arms: "الذراعان",
  core: "الجذع",
  full: "الجسم كامل",
};

function muscleLabel(f: MuscleFocus) {
  return MUSCLE_LABELS[f];
}
