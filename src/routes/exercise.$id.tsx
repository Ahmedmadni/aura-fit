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
import { EXERCISES } from "./exercises";
import { PageShell } from "@/components/page-shell";
import { BottomNav } from "@/components/bottom-nav";
import { AthletePose2D, MuscleAnatomy2D } from "@/components/athlete-2d";

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
          <div className="absolute inset-0 grid place-items-center">
            <AthletePose2D pose={ex.id as Parameters<typeof AthletePose2D>[0]["pose"]} size={220} />
          </div>
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
        <div className="bg-surface border border-border rounded-xl p-1 flex">
          {[
            { id: "overview", label: "الأداء" },
            { id: "form", label: "الخطوات" },
            { id: "safety", label: "السلامة" },
            { id: "muscles", label: "العضلات" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as typeof tab)}
              className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <section className="px-6 space-y-4 animate-enter" key={tab}>
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

function SkeletonAnim() {
  return (
    <svg viewBox="0 0 120 160" className="w-40 h-56" fill="none">
      <defs>
        <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ccff00" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ccff00" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <g stroke="url(#body)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="60" cy="20" r="10" fill="#ccff00" fillOpacity="0.1" />
        <line x1="60" y1="30" x2="60" y2="80">
          <animate attributeName="stroke-opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
        </line>
        <path d="M60 40 L30 55 M60 40 L90 55">
          <animate attributeName="d" values="M60 40 L30 55 M60 40 L90 55;M60 40 L35 40 M60 40 L85 40;M60 40 L30 55 M60 40 L90 55" dur="2s" repeatCount="indefinite" />
        </path>
        <path d="M60 80 L40 130 M60 80 L80 130" />
        <path d="M40 130 L35 150 M80 130 L85 150" />
      </g>
      {/* Joint markers */}
      {[
        [60, 30],
        [30, 55],
        [90, 55],
        [60, 80],
        [40, 130],
        [80, 130],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.5" fill="#ccff00">
          <animate attributeName="r" values="2;4;2" dur="1.5s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

function MuscleMap({ primary }: { primary: string }) {
  return (
    <svg viewBox="0 0 100 160" className="w-32 h-52" fill="none">
      <g stroke="hsl(0 0% 100% / 0.3)" strokeWidth="1.5" fill="hsl(0 0% 100% / 0.05)">
        {/* Head */}
        <circle cx="50" cy="15" r="9" />
        {/* Neck */}
        <path d="M46 24 L46 30 L54 30 L54 24" />
        {/* Torso */}
        <path d="M30 32 L70 32 L74 80 L26 80 Z" />
        {/* Arms */}
        <path d="M30 34 L18 70 L20 90" />
        <path d="M70 34 L82 70 L80 90" />
        {/* Legs */}
        <path d="M35 82 L32 140 L36 155" />
        <path d="M65 82 L68 140 L64 155" />
      </g>
      {/* Highlight primary */}
      <g fill="#ccff00" opacity="0.6">
        {primary.includes("ظهر") || primary.includes("الظهر") ? (
          <path d="M32 34 L68 34 L70 70 L30 70 Z">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
          </path>
        ) : primary.includes("صدر") ? (
          <ellipse cx="50" cy="50" rx="18" ry="12">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
          </ellipse>
        ) : primary.includes("فخذ") || primary.includes("أرجل") ? (
          <>
            <path d="M35 82 L32 130 L36 140 L40 82Z">
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
            </path>
            <path d="M60 82 L64 140 L68 130 L65 82Z">
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
            </path>
          </>
        ) : primary.includes("كتف") ? (
          <>
            <circle cx="28" cy="36" r="6" />
            <circle cx="72" cy="36" r="6" />
          </>
        ) : primary.includes("بطن") ? (
          <rect x="42" y="45" width="16" height="30" rx="4">
            <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
          </rect>
        ) : (
          <ellipse cx="50" cy="55" rx="20" ry="20" opacity="0.4" />
        )}
      </g>
    </svg>
  );
}
