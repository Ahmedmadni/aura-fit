import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  Dumbbell,
  Heart,
  RefreshCcw,
  Search,
  Zap,
} from "lucide-react";

import { BottomNav } from "@/components/bottom-nav";
import { PageHeader, PageShell } from "@/components/page-shell";
import {
  CATEGORY_LABEL_AR,
  EQUIPMENT_LABEL_AR,
  EXERCISES,
  LEVEL_LABEL_AR,
  MUSCLE_LABEL_AR,
  TRAINING_ROLE_LABEL_AR,
  type Category,
  type TrainingRole,
} from "@/lib/exercise-db";

export const Route = createFileRoute("/exercises")({
  component: ExerciseLibrary,
});

const categories: Array<{ id: Category | "all"; label: string; icon: typeof Dumbbell }> = [
  { id: "all", label: "الكل", icon: Dumbbell },
  { id: "push", label: "دفع", icon: Zap },
  { id: "pull", label: "سحب", icon: Activity },
  { id: "legs", label: "أرجل", icon: Heart },
  { id: "core", label: "الجذع", icon: Zap },
  { id: "cardio", label: "القلب والتحمل", icon: Activity },
  { id: "mobility", label: "مرونة", icon: RefreshCcw },
];

const roles: Array<{ id: TrainingRole | "all"; label: string }> = [
  { id: "all", label: "كل الاستخدامات" },
  { id: "warmup", label: "إحماء" },
  { id: "main", label: "أساسي" },
  { id: "accessory", label: "مساعد" },
  { id: "core", label: "كور" },
  { id: "cardio", label: "كارديو" },
  { id: "mobility", label: "مرونة" },
  { id: "cooldown", label: "تهدئة" },
];

const LEVEL_BARS = { beginner: 2, intermediate: 3, advanced: 5 } as const;
const PAGE_SIZE = 48;
const GIF_COUNT = EXERCISES.filter((exercise) => exercise.media.preferred === "gif" && Boolean(exercise.media.gif)).length;

function ExerciseLibrary() {
  const [cat, setCat] = useState<Category | "all">("all");
  const [role, setRole] = useState<TrainingRole | "all">("all");
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return EXERCISES.filter((exercise) => {
      if (cat !== "all" && exercise.category !== cat) return false;
      if (role !== "all" && exercise.trainingRole !== role) return false;
      if (!query) return true;
      const searchable = [
        exercise.name,
        exercise.latin,
        CATEGORY_LABEL_AR[exercise.category],
        TRAINING_ROLE_LABEL_AR[exercise.trainingRole],
        ...exercise.primary.map((muscle) => MUSCLE_LABEL_AR[muscle]),
        ...exercise.equipment.map((equipment) => EQUIPMENT_LABEL_AR[equipment]),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [cat, q, role]);

  const visible = filtered.slice(0, visibleCount);

  function selectCategory(next: Category | "all") {
    setCat(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <PageShell>
      <PageHeader eyebrow="مكتبة حركات موثقة ومطابقة للمصدر" title="مكتبة التمارين" />

      <div className="px-6 mb-4 animate-enter">
        <div className="relative">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            aria-hidden
          />
          <input
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            type="text"
            placeholder="ابحث باسم التمرين أو العضلة أو المعدة..."
            className="w-full bg-surface border border-border rounded-2xl pr-11 pl-4 py-3.5 text-sm focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      <div className="mb-5 overflow-x-auto no-scrollbar" dir="rtl">
        <div className="flex gap-2 px-6 w-max">
          {categories.map((category) => {
            const Icon = category.icon;
            const active = cat === category.id;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => selectCategory(category.id)}
                className={
                  "shrink-0 px-4 py-2.5 rounded-xl border flex items-center gap-2 transition-all " +
                  (active
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                    : "bg-surface border-border text-muted-foreground hover:text-foreground")
                }
              >
                <Icon className="size-3.5" />
                <span className="text-xs font-bold">{category.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-4 overflow-x-auto no-scrollbar" dir="rtl">
        <div className="flex gap-2 px-6 w-max">
          {roles.map((item) => {
            const active = role === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setRole(item.id);
                  setVisibleCount(PAGE_SIZE);
                }}
                className={
                  "shrink-0 rounded-full border px-3 py-2 text-[10px] font-bold transition-all " +
                  (active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-muted-foreground")
                }
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 mb-4 flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{filtered.length} تمرين</span>
        <span className="text-primary">{GIF_COUNT} فيديو متحرك · {EXERCISES.length - GIF_COUNT} بإطارات</span>
      </div>

      <section className="px-6 space-y-3 animate-enter">
        {visible.map((exercise, index) => (
          <Link
            key={exercise.id}
            to="/exercise/$id"
            params={{ id: exercise.id }}
            className="block relative rounded-2xl bg-card border border-border p-4 overflow-hidden active:scale-[0.99] transition-transform hover:border-primary/30"
            style={{ animationDelay: String(Math.min(index, 12) * 24) + "ms" }}
          >
            <div className="relative flex items-center gap-4">
              <div className="size-20 rounded-xl bg-background/60 border border-border grid place-items-center shrink-0 overflow-hidden">
                <img
                  src={exercise.media.poster ?? exercise.media.frames[0]}
                  alt={"صورة مطابقة لتمرين " + exercise.latin}
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    const fallback = exercise.media.frames[0];
                    if (event.currentTarget.getAttribute("src") !== fallback) {
                      event.currentTarget.src = fallback;
                    }
                  }}
                  className="size-full object-contain p-1"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <h3 className="font-display text-[0.98rem] font-bold leading-[1.45] truncate">{exercise.name}</h3>
                    {exercise.name !== exercise.latin && (
                      <p dir="ltr" className="mt-0.5 truncate text-left text-[10px] font-medium tracking-wide text-muted-foreground">
                        {exercise.latin}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="type-caption text-primary">
                      {TRAINING_ROLE_LABEL_AR[exercise.trainingRole]}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {CATEGORY_LABEL_AR[exercise.category]}
                    </span>
                    {exercise.media.preferred === "gif" ? (
                      <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">
                        GIF
                      </span>
                    ) : null}
                  </div>
                </div>

                <p className="type-small mb-2 truncate text-muted-foreground">
                  {exercise.primary.map((muscle) => MUSCLE_LABEL_AR[muscle]).join(" · ")} ·{" "}
                  {exercise.equipment.map((equipment) => EQUIPMENT_LABEL_AR[equipment]).join("، ")}
                </p>

                <div className="flex items-center gap-3 type-caption">
                  <span className="text-muted-foreground">{LEVEL_LABEL_AR[exercise.level]}</span>
                  <span className="text-primary">≈ {exercise.caloriesPerMin} كال/د</span>
                  <div className="flex gap-0.5 mr-auto">
                    {Array.from({ length: 5 }).map((_, bar) => (
                      <span
                        key={bar}
                        className={
                          "w-1 h-3 rounded-full " +
                          (bar < LEVEL_BARS[exercise.level] ? "bg-primary" : "bg-border")
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </section>

      {visibleCount < filtered.length && (
        <div className="px-6 mt-5">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="w-full py-3 rounded-xl border border-primary/30 bg-primary/5 text-xs font-bold text-primary"
          >
            عرض المزيد · {Math.min(PAGE_SIZE, filtered.length - visibleCount)} تمرين
          </button>
        </div>
      )}

      <div className="px-6 mt-6">
        <Link
          to="/"
          className="w-full py-3 rounded-xl border border-border text-xs font-mono uppercase tracking-widest text-muted-foreground flex items-center justify-center gap-2"
        >
          <ChevronLeft className="size-3" />
          العودة إلى الرئيسية
        </Link>
      </div>

      <BottomNav />
    </PageShell>
  );
}
