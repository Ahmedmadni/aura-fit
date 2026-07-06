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

export const Route = createFileRoute("/exercise/$id")({
  component: ExerciseDetail,
});

const STEPS_MAP: Record<string, { title: string; body: string }[]> = {
  "pull-up": [
    { title: "الوضع الابتدائي", body: "أمسك البار بقبضة عريضة قليلاً من الكتف، الأكتاف مفعّلة." },
    { title: "التفعيل", body: "اسحب لوحي الكتف للأسفل والخلف قبل البدء بالحركة." },
    { title: "الحركة الصاعدة", body: "اسحب الصدر باتجاه البار مع الحفاظ على جذع مستقر." },
    { title: "النزول المتحكم", body: "انزل ببطء خلال ٢-٣ ثوانٍ للحفاظ على التوتر العضلي." },
  ],
  "push-up": [
    { title: "الوضع الابتدائي", body: "اليدان بعرض الكتفين، الجسم في خط مستقيم." },
    { title: "النزول", body: "اثنِ المرفقين بزاوية ٤٥° حتى يقترب الصدر من الأرض." },
    { title: "الصعود", body: "ادفع بقوة مع تفعيل عضلات البطن والصدر." },
  ],
};

const MISTAKES_MAP: Record<string, string[]> = {
  "pull-up": ["تأرجح الجسم", "عدم تفعيل الأكتاف", "نزول سريع بدون تحكم"],
  "push-up": ["هبوط الحوض", "فتح المرفقين للجانب", "عدم اكتمال المدى"],
  "squat": ["تقوس الظهر", "دخول الركبتين للداخل", "عدم الوصول للعمق الكامل"],
  "deadlift": ["تقوس الظهر السفلي", "بدء الحركة من الظهر", "قفل الركبتين المبكر"],
};

function ExerciseDetail() {
  const { id } = Route.useParams();
  const ex = EXERCISES.find((e) => e.id === id);
  if (!ex) throw notFound();

  const [tab, setTab] = useState<"overview" | "form" | "safety" | "muscles">("overview");
  const steps = STEPS_MAP[ex.id] ?? STEPS_MAP["push-up"];
  const mistakes = MISTAKES_MAP[ex.id] ?? ["تسرّع الحركة", "تنفس غير منتظم", "وضعية غير سليمة"];

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
          {/* Animated skeleton */}
          <motion.div
            className="absolute inset-0 grid place-items-center"
            initial={{ opacity: 0, scale: 0.85, filter: "blur(8px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <AthletePose2D pose={ex.id as Parameters<typeof AthletePose2D>[0]["pose"]} size={220} />
            </motion.div>
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
          <ol className="space-y-3">
            {steps.map((s, i) => (
              <li key={i}>
                <Card>
                  <div className="flex gap-4">
                    <div className="size-10 rounded-xl bg-primary text-primary-foreground font-black grid place-items-center shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-black mb-1">{s.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ol>
        )}

        {tab === "safety" && (
          <>
            <Card className="border-destructive/40">
              <CardHeader label="أخطاء شائعة" icon={AlertTriangle} tone="danger" />
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
