import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, GripVertical, Sparkles, Play, Save } from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { PageShell, PageHeader } from "@/components/page-shell";
import { BottomNav } from "@/components/bottom-nav";
import { EXERCISES, getExercise, type Category, type Exercise } from "@/lib/exercise-db";
import { generateWorkout } from "@/lib/workout-engine";
import { loadHistory, loadProfile } from "@/lib/user-profile";
import { deleteCustomPlan, loadCustomPlans, saveCustomPlan, type CustomPlan } from "@/lib/custom-plans";

export const Route = createFileRoute("/builder")({
  component: BuilderPage,
  head: () => ({
    meta: [
      { title: "منشئ التمارين — Kinetic Performance" },
      { name: "description", content: "أنشئ تمارينك الخاصة بالسحب والإفلات، أو ولّد جلسة ذكية بلمسة زر." },
      { property: "og:title", content: "منشئ التمارين — Kinetic Performance" },
      { property: "og:description", content: "أنشئ تمارينك الخاصة بالسحب والإفلات، أو ولّد جلسة ذكية بلمسة زر." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

type Slot = {
  key: string;
  exercise: Exercise;
  sets: number;
  reps: string;
  rest: number;
};

function BuilderPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [cat, setCat] = useState<Category | "all">("all");
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const [savedPlans, setSavedPlans] = useState<CustomPlan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string>();
  const [planName, setPlanName] = useState("جلستي المخصصة");
  const [error, setError] = useState("");
  useEffect(() => {
    try { setSavedPlans(loadCustomPlans()); }
    catch { setError("تعذر قراءة الخطط القديمة. لن نستبدلها تلقائيًا حتى يتم إصلاح البيانات."); }
  }, []);

  const pool = useMemo(
    () => (cat === "all" ? EXERCISES : EXERCISES.filter((e) => e.category === cat)),
    [cat],
  );

  const totalMin = Math.round(
    slots.reduce(
      (s, x) => s + (45 * x.sets + x.rest * Math.max(0, x.sets - 1)) / 60,
      0,
    ),
  );
  const totalCals = Math.round(
    slots.reduce((s, x) => s + (x.exercise.caloriesPerMin * 45 * x.sets) / 60, 0),
  );

  function addSlot(ex: Exercise) {
    if (slots.some((slot) => slot.exercise.id === ex.id)) {
      setError("هذا التمرين موجود بالفعل؛ عدّل مجموعاته بدل تكراره.");
      setShowPicker(false);
      return;
    }
    setError("");
    setSaved(false);
    setSlots((prev) => [
      ...prev,
      {
        key: `${ex.id}-${Date.now()}`,
        exercise: ex,
        sets: ex.recommendedSets,
        reps: ex.recommendedReps,
        rest: ex.restSeconds,
      },
    ]);
    setShowPicker(false);
  }

  function aiGenerate() {
    setCurrentPlanId(undefined);
    setPlanName("جلستي المخصصة");
    setSaved(false);
    setError("");
    const w = generateWorkout(loadProfile(), { history: loadHistory() });
    setSlots(
      w.exercises.map((p) => ({
        key: `${p.exercise.id}-${Math.random()}`,
        exercise: p.exercise,
        sets: p.sets,
        reps: p.reps,
        rest: p.restSeconds,
      })),
    );
  }

  function save(): CustomPlan | null {
    if (!slots.length) { setError("أضف تمرينًا قبل الحفظ."); return null; }
    try {
      const plan = saveCustomPlan({
        id: currentPlanId, title: planName,
        slots: slots.map((slot) => ({
          id: slot.exercise.id, sets: slot.sets, reps: slot.reps, rest: slot.rest,
        })),
      });
      setCurrentPlanId(plan.id);
      setSavedPlans(loadCustomPlans());
      setSaved(true);
      setError("");
      return plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حفظ الخطة.");
      return null;
    }
  }

  function startWorkout() {
    const plan = save();
    if (!plan) return;
    navigate({ to: "/workout", search: { day: undefined, custom: plan.id } });
  }

  function openPlan(plan: CustomPlan) {
    const loaded: Slot[] = [];
    for (const item of plan.slots) {
      const exercise = getExercise(item.id);
      if (!exercise) { setError("تحتوي الخطة على تمرين لم يعد موجودًا."); return; }
      loaded.push({
        key: `${item.id}-${loaded.length}`,
        exercise, sets: item.sets, reps: item.reps, rest: item.rest,
      });
    }
    setSlots(loaded);
    setCurrentPlanId(plan.id);
    setPlanName(plan.title);
    setSaved(false);
    setError("");
  }

  function removePlan(id: string) {
    if (!window.confirm("هل تريد حذف هذه الخطة المحفوظة؟")) return;
    try {
      deleteCustomPlan(id);
      setSavedPlans(loadCustomPlans());
      if (currentPlanId === id) setCurrentPlanId(undefined);
      setError("");
    } catch { setError("تعذر حذف الخطة."); }
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="المنشئ الذكي"
        title="ابنِ جلستك"
        action={
          <button
            onClick={aiGenerate}
            className="h-10 px-3 rounded-xl bg-primary/15 border border-primary/40 text-primary text-xs font-bold inline-flex items-center gap-1"
          >
            <Sparkles className="size-3.5" />
            توليد ذكي
          </button>
        }
      />

      {/* summary */}
      <div className="mx-6 rounded-3xl bg-surface/60 border border-border p-5 grid grid-cols-3 gap-3">
        <Stat label="تمارين" value={String(slots.length)} />
        <Stat label="دقائق" value={String(totalMin)} />
        <Stat label="سعرات" value={`~${totalCals}`} />
      </div>

      {/* slots */}
      <div className="px-6 mt-6">
        {slots.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border p-10 text-center text-muted-foreground">
            <p className="text-sm mb-1">لا توجد تمارين بعد</p>
            <p className="text-xs">ابدأ بإضافة تمارين أو اضغط توليد AI</p>
          </div>
        )}

        <Reorder.Group axis="y" values={slots} onReorder={setSlots} className="space-y-3">
          {slots.map((s, i) => (
            <Reorder.Item key={s.key} value={s}>
              <div className="rounded-2xl bg-surface/60 border border-border p-4">
                <div className="flex items-center gap-3">
                  <GripVertical className="size-4 text-muted-foreground cursor-grab" />
                  <div className="size-8 rounded-lg bg-primary/15 text-primary grid place-items-center font-mono text-xs">
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm leading-tight">{s.exercise.name}</p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {s.exercise.latin}
                    </p>
                  </div>
                  <button
                    onClick={() => setSlots((prev) => prev.filter((x) => x.key !== s.key))}
                    className="size-8 rounded-lg border border-border grid place-items-center text-muted-foreground hover:text-destructive"
                    aria-label="حذف"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  <NumField
                    label="مجموعات"
                    value={s.sets}
                    onChange={(v) =>
                      setSlots((prev) =>
                        prev.map((x) => (x.key === s.key ? { ...x, sets: v } : x)),
                      )
                    }
                    min={1}
                    max={8}
                  />
                  <TextField
                    label="تكرارات"
                    value={s.reps}
                    onChange={(v) =>
                      setSlots((prev) =>
                        prev.map((x) => (x.key === s.key ? { ...x, reps: v } : x)),
                      )
                    }
                  />
                  <NumField
                    label="راحة ث"
                    value={s.rest}
                    onChange={(v) =>
                      setSlots((prev) =>
                        prev.map((x) => (x.key === s.key ? { ...x, rest: v } : x)),
                      )
                    }
                    min={0}
                    max={300}
                    step={5}
                  />
                </div>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>

        <button
          onClick={() => setShowPicker(true)}
          className="mt-4 w-full h-14 rounded-2xl border border-dashed border-border text-muted-foreground font-bold inline-flex items-center justify-center gap-2"
        >
          <Plus className="size-4" />
          إضافة تمرين
        </button>
      </div>

      <section className="px-6 mt-6 space-y-3" aria-label="خططي المخصصة">
        <label htmlFor="custom-plan-name" className="block text-sm font-bold">اسم الخطة</label>
        <input id="custom-plan-name" value={planName} maxLength={80}
          onChange={(event) => { setPlanName(event.target.value); setSaved(false); }}
          className="w-full h-11 rounded-xl border border-border bg-surface px-3 text-sm"
          placeholder="اسم الجلسة" />
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {slots.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { save(); }}
              className="h-12 rounded-2xl border border-border font-bold inline-flex items-center justify-center gap-2">
              <Save className="size-4" />
              {saved ? "تم الحفظ ✓" : "حفظ الخطة"}
            </button>
            <button type="button" onClick={startWorkout}
              className="h-12 rounded-2xl bg-primary text-primary-foreground font-black inline-flex items-center justify-center gap-2">
              <Play className="size-4 fill-current" />
              ابدأ خطتي
            </button>
          </div>
        )}
        {savedPlans.length > 0 && (
          <div className="pt-4 space-y-2">
            <h2 className="font-black text-base">الخطط المحفوظة ({savedPlans.length})</h2>
            {savedPlans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-border p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-bold">{plan.title}</p>
                  <p className="text-xs text-muted-foreground">{plan.slots.length} تمارين</p>
                </div>
                <button type="button" onClick={() => openPlan(plan)}
                  className="rounded-lg border border-border px-3 py-2 text-xs font-bold">تعديل</button>
                <button type="button" onClick={() =>
                  navigate({ to: "/workout", search: { day: undefined, custom: plan.id } })
                } className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                  تشغيل
                </button>
                <button type="button" onClick={() => removePlan(plan.id)}
                  aria-label={`حذف ${plan.title}`}
                  className="rounded-lg border border-border px-2 py-2 text-xs text-red-400">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* picker sheet */}
      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/60 z-50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPicker(false)}
            />
            <motion.div
              className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-background border-t border-border rounded-t-3xl p-5 z-50 max-h-[75vh] overflow-y-auto"
              style={{
                maxHeight: "75dvh",
                paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))",
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
            >
              <div className="w-12 h-1 bg-border rounded-full mx-auto mb-4" />
              <h3 className="font-black text-lg mb-3">اختر تمريناً</h3>

              <div className="flex gap-2 overflow-x-auto -mx-5 px-5 pb-3 no-scrollbar">
                {(["all", "push", "pull", "legs", "core", "cardio", "mobility"] as const).map(
                  (c) => (
                    <button
                      key={c}
                      onClick={() => setCat(c as Category | "all")}
                      className={`px-3 h-8 rounded-full text-xs font-bold whitespace-nowrap ${
                        cat === c
                          ? "bg-primary text-primary-foreground"
                          : "bg-surface border border-border text-muted-foreground"
                      }`}
                    >
                      {c === "all" ? "الكل" : c}
                    </button>
                  ),
                )}
              </div>

              <div className="space-y-2">
                {pool.map((ex) => (
                  <button
                    key={ex.id}
                    onClick={() => addSlot(ex)}
                    className="w-full text-right rounded-xl bg-surface/60 border border-border p-3 hover:border-primary transition-colors"
                  >
                    <p className="font-bold text-sm">{ex.name}</p>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                      {ex.latin} · {ex.level}
                    </p>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </PageShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <p className="text-2xl font-black font-mono tabular-nums">{value}</p>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
        {label}
      </p>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <div className="flex items-center rounded-xl border border-border bg-surface overflow-hidden">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-9 text-muted-foreground hover:text-primary"
          type="button"
        >
          −
        </button>
        <span className="flex-1 text-center font-mono font-bold tabular-nums text-sm">
          {value}
        </span>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-8 h-9 text-muted-foreground hover:text-primary"
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 rounded-xl border border-border bg-surface px-2 text-center text-sm font-mono focus:outline-none focus:border-primary"
      />
    </div>
  );
}

