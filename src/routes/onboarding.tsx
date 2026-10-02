import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import {
  type Equipment,
  type Goal,
  type Level,
} from "@/lib/exercise-db";
import { saveProfile } from "@/lib/user-profile";

export const Route = createFileRoute("/onboarding")({
  component: Onboarding,
});

const titles = [
  ["الخطوة ١ من ٧", "أخبرنا عنك", "معلومات أساسية لبناء ملفك الشخصي."],
  ["الخطوة ٢ من ٧", "الجنس", "اختياري، ويُستخدم فقط ضمن ملفك الشخصي."],
  ["الخطوة ٣ من ٧", "قياسات الجسم", "يمكن تعديلها لاحقًا."],
  ["الخطوة ٤ من ٧", "مستوى التدريب", "سنضبط صعوبة الحركات وحجم الجلسة وفقًا له."],
  ["الخطوة ٥ من ٧", "هدفك الأساسي", "يؤثر على المجموعات والتكرارات والكارديو."],
  ["الخطوة ٦ من ٧", "المعدات المتوفرة", "لن نضع تمرينًا يحتاج معدات غير متاحة لك."],
  ["الخطوة ٧ من ٧", "جدولك الأسبوعي", "اختر عدد الأيام والمدة الواقعية للجلسة."],
] as const;

const LEVELS: Array<{ label: string; value: Level }> = [
  { label: "مبتدئ", value: "beginner" },
  { label: "متوسط", value: "intermediate" },
  { label: "متقدم", value: "advanced" },
];

const GOALS: Array<{ label: string; value: Goal }> = [
  { label: "خفض الدهون", value: "fat-loss" },
  { label: "بناء العضلات", value: "muscle-gain" },
  { label: "زيادة القوة", value: "strength" },
  { label: "رفع التحمل", value: "endurance" },
  { label: "تحسين المرونة", value: "mobility" },
  { label: "اللياقة العامة", value: "general-fitness" },
];

const EQUIPMENT_OPTIONS: Array<{ label: string; values: Equipment[] }> = [
  { label: "بدون معدات", values: ["none", "mat"] },
  { label: "دمبل", values: ["dumbbells"] },
  { label: "باربل", values: ["barbell"] },
  { label: "كيتل بيل", values: ["kettlebell"] },
  { label: "أشرطة مقاومة", values: ["resistance-band"] },
  { label: "بار عقلة", values: ["pullup-bar"] },
  { label: "كابل / أجهزة", values: ["cable", "machine"] },
  { label: "جهاز كارديو", values: ["cardio-machine"] },
];

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | undefined>();
  const [height, setHeight] = useState("");
  const [weight, setWeight] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [goal, setGoal] = useState<Goal>("general-fitness");
  const [equipmentLabels, setEquipmentLabels] = useState<string[]>(["بدون معدات"]);
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(30);

  const [eyebrow, title, subtitle] = titles[step];
  const progress = ((step + 1) / titles.length) * 100;

  function toggleEquipment(label: string) {
    setEquipmentLabels((current) =>
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label],
    );
  }

  function complete() {
    const equipment = new Set<Equipment>(["none", "mat"]);
    for (const option of EQUIPMENT_OPTIONS) {
      if (!equipmentLabels.includes(option.label)) continue;
      option.values.forEach((item) => equipment.add(item));
    }

    saveProfile({
      name: name.trim() || undefined,
      age: Number(age) || undefined,
      heightCm: Number(height) || undefined,
      weightKg: Number(weight) || undefined,
      gender,
      level,
      goals: [goal],
      equipment: [...equipment],
      daysPerWeek,
      sessionMinutes,
    });
    navigate({ to: "/" });
  }

  return (
    <main className="relative mx-auto min-h-screen max-w-[430px] overflow-x-hidden bg-background pb-28 text-foreground">
      <div
        className="pointer-events-none absolute -right-24 -top-32 size-72 rounded-full bg-primary/20 blur-[100px]"
        aria-hidden
      />

      <div className="relative flex items-center justify-between px-6 pb-6 pt-10">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          className="grid size-10 place-items-center rounded-full border border-border bg-surface text-muted-foreground disabled:opacity-30"
          disabled={step === 0}
          aria-label="السابق"
        >
          <ArrowRight className="size-4" />
        </button>
        <div className="mx-4 h-1 flex-1 overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: progress + "%" }}
          />
        </div>
        <button
          type="button"
          onClick={() => navigate({ to: "/" })}
          className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground"
        >
          تخطي
        </button>
      </div>

      <section key={step} className="relative px-6 animate-enter">
        <p className="type-eyebrow mb-3 text-primary">{eyebrow}</p>
        <h1 className="type-page-title mb-3">{title}</h1>
        <p className="type-body mb-8 text-muted-foreground">{subtitle}</p>

        {step === 0 && (
          <div className="space-y-4">
            <Field label="الاسم" value={name} onChange={setName} placeholder="أحمد" />
            <Field label="العمر" value={age} onChange={setAge} placeholder="28" suffix="سنة" inputMode="numeric" />
          </div>
        )}

        {step === 1 && (
          <OptionGrid
            options={[
              { label: "ذكر", active: gender === "male", onClick: () => setGender("male") },
              { label: "أنثى", active: gender === "female", onClick: () => setGender("female") },
              { label: "أفضّل عدم القول", active: gender === undefined, onClick: () => setGender(undefined) },
            ]}
          />
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Field label="الطول" value={height} onChange={setHeight} placeholder="178" suffix="سم" inputMode="numeric" />
            <Field label="الوزن" value={weight} onChange={setWeight} placeholder="76" suffix="كجم" inputMode="decimal" />
          </div>
        )}

        {step === 3 && (
          <OptionGrid
            options={LEVELS.map((item) => ({
              label: item.label,
              active: level === item.value,
              onClick: () => setLevel(item.value),
            }))}
          />
        )}

        {step === 4 && (
          <OptionGrid
            options={GOALS.map((item) => ({
              label: item.label,
              active: goal === item.value,
              onClick: () => setGoal(item.value),
            }))}
          />
        )}

        {step === 5 && (
          <div className="grid grid-cols-2 gap-3">
            {EQUIPMENT_OPTIONS.map((item) => {
              const active = equipmentLabels.includes(item.label);
              return (
                <SelectButton
                  key={item.label}
                  label={item.label}
                  active={active}
                  onClick={() => toggleEquipment(item.label)}
                />
              );
            })}
          </div>
        )}

        {step === 6 && (
          <div className="space-y-6">
            <div>
              <p className="type-caption mb-2 text-muted-foreground">أيام التدريب أسبوعيًا</p>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setDaysPerWeek(days)}
                    className={
                      "h-12 rounded-xl border text-sm font-black transition-all " +
                      (daysPerWeek === days
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground")
                    }
                  >
                    {days}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="type-caption mb-2 text-muted-foreground">مدة الجلسة</p>
              <div className="grid grid-cols-4 gap-2">
                {[20, 30, 45, 60].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => setSessionMinutes(minutes)}
                    className={
                      "h-12 rounded-xl border text-xs font-bold transition-all " +
                      (sessionMinutes === minutes
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface text-muted-foreground")
                    }
                  >
                    {minutes} د
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4">
              <p className="type-card-title">توزيع الخطة</p>
              <p className="type-small mt-2 text-muted-foreground">
                {daysPerWeek <= 3
                  ? "كامل الجسم في كل جلسة مع تغيير التمارين، لتغطية العضلات الرئيسية أكثر من مرة أسبوعيًا."
                  : daysPerWeek === 4
                    ? "Upper / Lower مرتين أسبوعيًا: علوي، سفلي، علوي، سفلي."
                    : daysPerWeek === 5
                      ? "Push / Pull / Legs ثم Upper / Lower لرفع تكرار تدريب كل مجموعة عضلية."
                      : "Push / Pull / Legs مرتين أسبوعيًا مع تغيير الحركات بين A وB."}
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 bg-gradient-to-t from-background via-background to-transparent px-6 pb-8 pt-4">
        {step === titles.length - 1 ? (
          <button
            type="button"
            onClick={complete}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-black text-primary-foreground active:scale-[0.98]"
          >
            أنشئ خطتي الأسبوعية
            <Check className="size-4" strokeWidth={3} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setStep((current) => current + 1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-sm font-black text-primary-foreground active:scale-[0.98]"
          >
            التالي
            <ArrowLeft className="size-4" strokeWidth={3} />
          </button>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  suffix?: string;
  inputMode?: "text" | "numeric" | "decimal";
}) {
  return (
    <label className="block">
      <span className="type-caption mb-2 block text-muted-foreground">{label}</span>
      <div className="relative">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          inputMode={inputMode}
          placeholder={placeholder}
          className="w-full rounded-2xl border border-border bg-surface px-5 py-4 text-xl font-black focus:border-primary focus:outline-none"
        />
        {suffix && (
          <span className="absolute left-5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}

function OptionGrid({
  options,
}: {
  options: Array<{ label: string; active: boolean; onClick: () => void }>;
}) {
  return (
    <div className="space-y-3">
      {options.map((option) => (
        <SelectButton key={option.label} {...option} />
      ))}
    </div>
  );
}

function SelectButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center justify-between rounded-2xl border p-4 text-right transition-all active:scale-[0.98] " +
        (active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-surface text-foreground")
      }
    >
      <span className="text-sm font-bold">{label}</span>
      {active && (
        <span className="grid size-6 place-items-center rounded-full bg-primary">
          <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}
