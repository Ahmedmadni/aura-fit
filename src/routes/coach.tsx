import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Dumbbell,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";
import { INJURY_LABEL_AR } from "@/lib/exercise-db";
import {
  DEFAULT_PROFILE,
  exerciseStrengthAnalyses,
  loadHistory,
  loadProfile,
  loadTodayReadiness,
  type CompletedWorkout,
  type DailyReadinessCheckIn,
  type UserProfile,
} from "@/lib/user-profile";
import {
  PERIODIZATION_PHASE_LABEL_AR,
  generateWeeklyPlan,
  getWeeklyVolumeStatus,
} from "@/lib/workout-engine";

export const Route = createFileRoute("/coach")({
  head: () => ({
    meta: [
      { title: "المدرب التحليلي | Aura Fit" },
      {
        name: "description",
        content:
          "إرشاد تدريبي مبني على بياناتك الفعلية: الجاهزية، الخطة، الأحمال، RIR والاستشفاء.",
      },
    ],
  }),
  component: Coach,
});

function Coach() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<CompletedWorkout[]>([]);
  const [readiness, setReadiness] = useState<DailyReadinessCheckIn>();

  useEffect(() => {
    setProfile(loadProfile());
    setHistory(loadHistory());
    setReadiness(loadTodayReadiness());
  }, []);
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
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const adaptation = weekly[0]?.adaptation;
  const periodization = weekly[0]?.periodization;
  const plateaus = strength.filter((item) => item.plateau);
  const rising = strength.filter((item) => item.trend === "up");
  const onTarget = volume.filter((item) => item.status === "target").length;
  const lastWorkout = history[0];

  function ask(text: string) {
    const value = text.trim();
    if (!value) return;
    const normalized = value.toLowerCase();

    if (/اليوم|أتمرن|اتمرن|جاهز|جاهزية/.test(normalized)) {
      setAnswer(
        adaptation
          ? adaptation.mode === "recovery"
            ? "الخطة الحالية تفضل الاستشفاء. لا تحتاج لتعويض الشدة؛ اتبع جرعة الـDeload الحالية وراقب الألم والطاقة."
            : adaptation.mode === "progress"
              ? "جاهزيتك تدعم التقدم المحافظ اليوم. نفّذ الخطة كما هي ولا ترفع الحمل إلا عندما تتحقق شروط التكرارات وRIR."
              : "الجاهزية متوازنة. الأفضل تثبيت الجرعة الحالية وبناء التكرارات قبل أي تصعيد."
          : "لا توجد بيانات كافية بعد. ابدأ بـCheck-in اليومي وسجّل أول جلساتك.",
      );
    } else if (/حمل|وزن|قوة|تقدم|progress/.test(normalized)) {
      const best = rising[0];
      setAnswer(
        best
          ? `لديك ${rising.length} تمارين باتجاه قوة صاعد و${plateaus.length} Plateau حاليًا. استمر بالـDouble Progression ولا ترفع الحمل لمجرد إكمال الجلسة.`
          : strength.length
            ? `لديك بيانات أحمال لـ${strength.length} تمارين. لا يوجد اتجاه صاعد واضح بعد؛ حافظ على التسجيل الدقيق للوزن والتكرارات وRIR.`
            : "لم تسجل أحمالًا كافية بعد. سجّل Kg + Reps + RIR داخل جلسات المقاومة ليبدأ تحليل القوة.",
      );
    } else if (/ألم|الم|إصابة|اصابة|ركبة|كتف|ظهر/.test(normalized)) {
      setAnswer(
        profile.injuries.length
          ? `فلترة الخطة مفعلة حاليًا لـ${profile.injuries
              .map((item) => INJURY_LABEL_AR[item])
              .join("، ")}. إذا ظهر ألم حاد أو جديد فلا تستخدم التطبيق لتشخيص السبب، وأوقف الحركة وراجع مختصًا عند الحاجة.`
          : "لا توجد مناطق إصابة مسجلة في ملفك. يمكنك إضافتها من الأهداف والمعدات والإصابات لتفعيل الفلترة الاحترازية. الألم الحاد أو الجديد يحتاج تقييمًا مناسبًا ولا يُشخّص من التطبيق.",
      );
    } else if (/أسبوع|خطة|برنامج|مرحلة/.test(normalized)) {
      setAnswer(
        periodization
          ? `أنت في ${PERIODIZATION_PHASE_LABEL_AR[periodization.phase]}، الأسبوع ${periodization.cycleWeek}/4. حجم العضلات ضمن الهدف في ${onTarget}/${volume.length} تصنيفات متابعة.`
          : "أكمل إعداد ملفك ليتم إنشاء الخطة الأسبوعية.",
      );
    } else {
      setAnswer(
        "أستطيع تحليل أسئلة التدريب المرتبطة ببيانات Aura Fit الحالية: جاهزية اليوم، الخطة الأسبوعية، القوة والأحمال، Plateau، والإصابات المسجلة. لا أختلق بيانات غير موجودة في سجلك.",
      );
    }
    setQuestion("");
  }

  const cards = [
    {
      icon: Activity,
      title: "قرار اليوم",
      value: adaptation
        ? adaptation.mode === "progress"
          ? "تقدم محافظ"
          : adaptation.mode === "recovery"
            ? "استشفاء"
            : "ثبات"
        : "بيانات غير كافية",
      detail: adaptation?.reason ?? "سجّل Check-in وجلساتك ليبدأ التحليل.",
    },
    {
      icon: TrendingUp,
      title: "اتجاه القوة",
      value: strength.length
        ? `${rising.length} صاعد · ${plateaus.length} Plateau`
        : "لا توجد أحمال بعد",
      detail: strength.length
        ? `التحليل مبني على ${strength.length} تمارين لها أحمال مسجلة.`
        : "سجّل الوزن والتكرارات وRIR في تمارين المقاومة.",
    },
    {
      icon: ShieldCheck,
      title: "فلترة الحركة",
      value: profile.injuries.length
        ? profile.injuries.map((item) => INJURY_LABEL_AR[item]).join("، ")
        : "لا توجد قيود مسجلة",
      detail:
        "الفلترة احترازية وليست تشخيصًا أو بديلًا عن تعليمات المختص.",
    },
    {
      icon: Dumbbell,
      title: "آخر جلسة",
      value: lastWorkout
        ? `${lastWorkout.performance}% أداء`
        : "لم تسجل جلسة بعد",
      detail: lastWorkout
        ? `${Math.round(lastWorkout.durationSec / 60)} دقيقة · ${lastWorkout.exercises.filter((item) => item.completed).length} تمارين مكتملة`
        : "ابدأ أول جلسة ليستخدم المدرب سجلك الفعلي.",
    },
  ];

  return (
    <PageShell>
      <header className="relative p-6 pt-10 animate-enter">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl border border-primary/30 bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
              DATA COACH
            </p>
            <h1 className="text-2xl font-black leading-none">
              المدرب التحليلي
            </h1>
          </div>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          يجيب من بياناتك المسجلة في Aura Fit فقط؛ لا توجد محادثات أو أرقام
          تجريبية مخفية.
        </p>
      </header>

      <section className="relative px-6 mb-6 grid grid-cols-2 gap-3">
        {cards.map((card) => (
          <article
            key={card.title}
            className="rounded-2xl border border-border bg-surface/60 p-4"
          >
            <card.icon className="size-4 text-primary" />
            <p className="mt-3 text-[9px] text-muted-foreground">
              {card.title}
            </p>
            <p className="mt-1 text-sm font-black">{card.value}</p>
            <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground">
              {card.detail}
            </p>
          </article>
        ))}
      </section>

      {plateaus.length > 0 && (
        <section className="relative px-6 mb-6">
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/5 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
              <div>
                <p className="text-xs font-black text-amber-400">
                  Plateau يحتاج متابعة
                </p>
                <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                  تم رصد ثبات في {plateaus.length} تمارين. Aura Fit يراجع
                  الجاهزية وRIR والدورة التدريبية قبل أي تدوير أو Deload.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="relative px-6 mb-4">
        <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          أسئلة سريعة
        </p>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {[
            "هل أتمرن اليوم؟",
            "كيف أتقدم في الأوزان؟",
            "ما وضع خطة الأسبوع؟",
            "ماذا عن الألم أو الإصابة؟",
          ].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => ask(item)}
              className="shrink-0 rounded-full border border-border bg-surface px-3 py-2 text-xs font-bold text-muted-foreground"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="relative px-6 mb-32">
        {answer && (
          <div className="mb-3 rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-7">
            {answer}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            ask(question);
          }}
          className="flex items-center gap-2 rounded-2xl border border-border bg-card/90 p-2"
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="اسأل عن خطتك أو جاهزيتك…"
            className="flex-1 bg-transparent px-2 py-2 text-sm outline-none"
          />
          <button
            type="submit"
            className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground"
            aria-label="تحليل السؤال"
          >
            <Send className="size-4" />
          </button>
        </form>
        <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
          الأسئلة الصحية أو الألم الجديد لا يتم تشخيصها هنا. استخدم الفلترة
          الاحترازية واطلب تقييمًا متخصصًا عند الحاجة.
        </p>
        <Link
          to="/progress"
          className="mt-4 inline-block text-xs font-black text-primary"
        >
          فتح تحليل القوة والتقدم
        </Link>
      </section>

      <BottomNav />
    </PageShell>
  );
}
