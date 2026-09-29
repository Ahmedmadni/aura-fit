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
  type Category,
} from "@/lib/exercise-db";

export const Route = createFileRoute("/exercises")({
  component: ExerciseLibrary,
});

const categories: Array<{ id: Category | "all"; label: string; icon: typeof Dumbbell }> = [
  { id: "all", label: "الكل", icon: Dumbbell },
  { id: "push", label: "دفع", icon: Zap },
  { id: "pull", label: "سحب", icon: Activity },
  { id: "legs", label: "أرجل", icon: Heart },
  { id: "core", label: "كور", icon: Zap },
  { id: "cardio", label: "كارديو", icon: Activity },
  { id: "mobility", label: "مرونة", icon: RefreshCcw },
];

const LEVEL_BARS = { beginner: 2, intermediate: 3, advanced: 5 } as const;
const PAGE_SIZE = 48;

function ExerciseLibrary() {
  const [cat, setCat] = useState<Category | "all">("all");
  const [q, setQ] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return EXERCISES.filter((exercise) => {
      if (cat !== "all" && exercise.category !== cat) return false;
      if (!query) return true;
      const searchable = [
        exercise.name,
        exercise.latin,
        CATEGORY_LABEL_AR[exercise.category],
        ...exercise.primary.map((muscle) => MUSCLE_LABEL_AR[muscle]),
        ...exercise.equipment.map((equipment) => EQUIPMENT_LABEL_AR[equipment]),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [cat, q]);

  const visible = filtered.slice(0, visibleCount);

  function selectCategory(next: Category | "all") {
    setCat(next);
    setVisibleCount(PAGE_SIZE);
  }

  return (
    <PageShell>
      <PageHeader eyebrow="OPEN-SOURCE MOTION LAB" title="مكتبة التمارين" />

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

      <div className="px-6 mb-4 flex items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{filtered.length} تمرين</span>
        <span className="text-primary">302 SOURCE-MATCHED · CC BY-SA</span>
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
                  src={exercise.media.frames[0]}
                  alt={"الوضع الابتدائي لتمرين " + exercise.latin}
                  loading="lazy"
                  className="size-full object-contain p-1"
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="min-w-0">
                    <h3 className="font-black text-base leading-tight truncate">{exercise.name}</h3>
                    {exercise.name !== exercise.latin && (
                      <p className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground truncate mt-0.5">
                        {exercise.latin}
                      </p>
                    )}
                  </div>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-primary shrink-0">
                    {CATEGORY_LABEL_AR[exercise.category]}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground truncate mb-2">
                  {exercise.primary.map((muscle) => MUSCLE_LABEL_AR[muscle]).join(" · ")} ·{" "}
                  {exercise.equipment.map((equipment) => EQUIPMENT_LABEL_AR[equipment]).join("، ")}
                </p>

                <div className="flex items-center gap-3 text-[10px] font-mono">
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
