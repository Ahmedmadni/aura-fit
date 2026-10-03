import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Beef,
  Droplet,
  Flame,
  Scale,
  Wheat,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell, PageHeader } from "@/components/page-shell";
import {
  DEFAULT_PROFILE,
  loadProfile,
  type UserProfile,
} from "@/lib/user-profile";

export const Route = createFileRoute("/nutrition")({
  head: () => ({
    meta: [
      { title: "التغذية التقديرية | Aura Fit" },
      {
        name: "description",
        content:
          "احتياج طاقة وماكروز تقديري مبني على بيانات الملف الشخصي، بدون وجبات أو استهلاك وهمي.",
      },
    ],
  }),
  component: Nutrition,
});

function activityFactor(days: number) {
  if (days <= 2) return 1.35;
  if (days === 3) return 1.45;
  if (days === 4) return 1.5;
  if (days === 5) return 1.55;
  return 1.6;
}

function goalFactor(goals: string[]) {
  if (goals.includes("fat-loss")) return 0.9;
  if (goals.includes("muscle-gain")) return 1.08;
  if (goals.includes("strength")) return 1.04;
  return 1;
}

function Nutrition() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    setProfile(loadProfile());
  }, []);
  const ready =
    profile.age !== undefined &&
    profile.weightKg !== undefined &&
    profile.heightCm !== undefined &&
    profile.gender !== undefined;

  const estimate = useMemo(() => {
    if (!ready) return null;

    const weight = profile.weightKg as number;
    const height = profile.heightCm as number;
    const age = profile.age as number;
    const sexConstant = profile.gender === "male" ? 5 : -161;
    const bmr = 10 * weight + 6.25 * height - 5 * age + sexConstant;
    const maintenance = Math.round(
      bmr * activityFactor(profile.daysPerWeek),
    );
    const calories = Math.round(
      (maintenance * goalFactor(profile.goals)) / 25,
    ) * 25;

    const proteinPerKg =
      profile.goals.includes("muscle-gain") ||
      profile.goals.includes("strength") ||
      profile.goals.includes("fat-loss")
        ? 1.6
        : 1.4;
    const protein = Math.round(weight * proteinPerKg);
    const fat = Math.round(weight * 0.8);
    const remaining = Math.max(
      0,
      calories - protein * 4 - fat * 9,
    );
    const carbs = Math.round(remaining / 4);
    const waterLiters = Math.round(weight * 0.033 * 10) / 10;

    return {
      bmr: Math.round(bmr),
      maintenance,
      calories,
      protein,
      fat,
      carbs,
      waterLiters,
    };
  }, [profile, ready]);

  return (
    <PageShell>
      <PageHeader eyebrow="NUTRITION ESTIMATE" title="التغذية" />

      {!estimate ? (
        <section className="px-6 mb-8 animate-enter">
          <div className="rounded-3xl border border-dashed border-border bg-surface/50 p-6 text-center">
            <Scale className="mx-auto size-6 text-primary" />
            <h2 className="mt-4 text-xl font-black">
              نحتاج بيانات جسمك أولًا
            </h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              لن يعرض Aura Fit سعرات أو ماكروز افتراضية. أضف العمر، الجنس،
              الطول والوزن ليحسب نطاقًا تقديريًا مبنيًا على ملفك.
            </p>
            <Link
              to="/onboarding"
              className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground"
            >
              استكمال بيانات الملف
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="px-6 mb-6 animate-enter">
            <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-primary/5 p-6">
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                هدف طاقة تقديري
              </p>
              <div className="mt-2 flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-black" dir="ltr">
                    {estimate.calories}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    كيلو كالوري / يوم
                  </p>
                </div>
                <Flame className="size-8 text-primary" />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4">
                <Metric label="BMR تقديري" value={estimate.bmr + " kcal"} />
                <Metric
                  label="صيانة تقديرية"
                  value={estimate.maintenance + " kcal"}
                />
              </div>
            </div>
          </section>

          <section className="px-6 mb-6 animate-enter">
            <p className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              توزيع يومي مقترح
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Macro
                icon={Beef}
                label="بروتين"
                value={estimate.protein}
                unit="غ"
              />
              <Macro
                icon={Wheat}
                label="كربوهيدرات"
                value={estimate.carbs}
                unit="غ"
              />
              <Macro
                icon={Flame}
                label="دهون"
                value={estimate.fat}
                unit="غ"
              />
            </div>
          </section>

          <section className="px-6 mb-6 animate-enter">
            <div className="rounded-2xl border border-border bg-surface/60 p-4">
              <div className="flex items-center gap-2">
                <Droplet className="size-4 text-cyan" />
                <p className="text-sm font-black">ترطيب أساسي تقديري</p>
              </div>
              <p className="mt-3 text-2xl font-black" dir="ltr">
                ~{estimate.waterLiters} L
              </p>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                تقدير يومي تقريبي من وزن الجسم فقط. الحرارة، التعرق، الحمل
                التدريبي والحالات الصحية قد تغير الاحتياج.
              </p>
            </div>
          </section>

          <section className="px-6 mb-8 animate-enter">
            <div className="rounded-2xl border border-border bg-background/50 p-4">
              <p className="text-xs font-black">ما الذي لا ندعيه هنا؟</p>
              <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                لا نسجل أنك أكلت وجبات لم تدخلها، ولا نعرض “سعرات مستهلكة”
                وهمية. هذه أهداف تقديرية باستخدام معادلة BMR شائعة ومعامل نشاط
                محافظ، وليست وصفة علاجية أو خطة تغذية سريرية.
              </p>
            </div>
          </section>
        </>
      )}

      <BottomNav />
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-sm font-black" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function Macro({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  unit: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-3">
      <Icon className="size-4 text-primary" />
      <p className="mt-3 text-[9px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-black" dir="ltr">
        {value}
        <span className="ml-1 text-[9px] text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
