import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

type Step = {
  eyebrow: string;
  title: string;
  subtitle: string;
  options?: string[];
  multi?: boolean;
  input?: { label: string; placeholder: string; unit?: string }[];
};

const steps: Step[] = [
  {
    eyebrow: "الخطوة ١ من ٦",
    title: "أخبرنا عنك",
    subtitle: "معلومات أساسية لبناء ملفك الشخصي.",
    input: [
      { label: "الاسم", placeholder: "أحمد" },
      { label: "العمر", placeholder: "28", unit: "سنة" },
    ],
  },
  {
    eyebrow: "الخطوة ٢ من ٦",
    title: "الجنس",
    subtitle: "لضبط الحسابات الفسيولوجية.",
    options: ["ذكر", "أنثى", "أفضّل عدم القول"],
  },
  {
    eyebrow: "الخطوة ٣ من ٦",
    title: "قياسات الجسم",
    subtitle: "دقيقة قدر الإمكان لأفضل نتائج.",
    input: [
      { label: "الطول", placeholder: "178", unit: "سم" },
      { label: "الوزن", placeholder: "76", unit: "كجم" },
      { label: "محيط الخصر", placeholder: "82", unit: "سم" },
    ],
  },
  {
    eyebrow: "الخطوة ٤ من ٦",
    title: "مستوى اللياقة",
    subtitle: "سنكيّف الشدّة تلقائياً بعد أول جلسة.",
    options: ["مبتدئ", "متوسط", "متقدم", "محترف"],
  },
  {
    eyebrow: "الخطوة ٥ من ٦",
    title: "هدفك الأساسي",
    subtitle: "يمكنك تغييره لاحقاً.",
    options: [
      "خسارة الوزن",
      "بناء العضلات",
      "تحسين اللياقة",
      "زيادة المرونة",
      "إعادة تأهيل",
      "الصحة العامة",
    ],
  },
  {
    eyebrow: "الخطوة ٦ من ٦",
    title: "المعدات المتوفرة",
    subtitle: "اختر كل ما ينطبق.",
    multi: true,
    options: [
      "بدون معدات",
      "أشرطة مقاومة",
      "دمبل",
      "كتل بل",
      "بار عقلة",
      "جهاز جري",
      "دراجة",
      "جيم منزلي كامل",
    ],
  },
];

function Onboarding() {
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<Record<number, string[]>>({});
  const step = steps[i];
  const isLast = i === steps.length - 1;
  const progress = ((i + 1) / steps.length) * 100;

  const toggle = (opt: string) => {
    setSelected((s) => {
      const cur = s[i] ?? [];
      if (step.multi) {
        return { ...s, [i]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
      }
      return { ...s, [i]: [opt] };
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground max-w-[430px] mx-auto overflow-x-hidden relative pb-8">
      <div
        className="pointer-events-none absolute -top-32 -right-24 size-72 rounded-full bg-primary/20 blur-[100px]"
        aria-hidden
      />

      {/* Top bar */}
      <div className="relative px-6 pt-10 pb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setI(Math.max(0, i - 1))}
          className="size-10 rounded-full bg-surface border border-border flex items-center justify-center text-muted-foreground disabled:opacity-30"
          disabled={i === 0}
          aria-label="السابق"
        >
          <ArrowRight className="size-4" />
        </button>
        <div className="flex-1 mx-4 h-1 bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <Link
          to="/"
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
        >
          تخطي
        </Link>
      </div>

      <div key={i} className="relative px-6 animate-enter">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-primary mb-3">
          {step.eyebrow}
        </p>
        <h1 className="text-4xl font-black leading-tight mb-3">{step.title}</h1>
        <p className="text-sm text-muted-foreground mb-8">{step.subtitle}</p>

        {step.input && (
          <div className="space-y-4">
            {step.input.map((f) => (
              <label key={f.label} className="block">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2">
                  {f.label}
                </span>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={f.placeholder}
                    className="w-full bg-surface border border-border rounded-2xl px-5 py-4 text-xl font-black focus:outline-none focus:border-primary transition-colors"
                  />
                  {f.unit && (
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs font-mono uppercase text-muted-foreground">
                      {f.unit}
                    </span>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {step.options && (
          <div className={step.multi ? "grid grid-cols-2 gap-3" : "space-y-3"}>
            {step.options.map((opt) => {
              const isSel = (selected[i] ?? []).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => toggle(opt)}
                  className={`w-full text-right rounded-2xl border p-4 transition-all active:scale-[0.98] flex items-center justify-between ${
                    isSel
                      ? "bg-primary/10 border-primary text-foreground"
                      : "bg-surface border-border text-foreground hover:border-white/20"
                  }`}
                >
                  <span className="text-sm font-bold">{opt}</span>
                  {isSel && (
                    <span className="size-6 rounded-full bg-primary grid place-items-center">
                      <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-6 pb-8 pt-4 bg-gradient-to-t from-background via-background to-transparent">
        {isLast ? (
          <Link
            to="/"
            className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl uppercase tracking-widest text-sm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            أنشئ خطتي
            <Check className="size-4" strokeWidth={3} />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => setI(i + 1)}
            className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl uppercase tracking-widest text-sm active:scale-[0.98] flex items-center justify-center gap-2"
          >
            التالي
            <ArrowLeft className="size-4" strokeWidth={3} />
          </button>
        )}
      </div>
    </main>
  );
}
