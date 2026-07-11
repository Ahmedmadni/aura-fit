import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, ChevronLeft, Filter } from "lucide-react";
import { motion } from "framer-motion";
import { PageShell, PageHeader } from "@/components/page-shell";
import { BottomNav } from "@/components/bottom-nav";
import { EXERCISES, type Category, type Equipment, type Level } from "@/lib/exercise-db";

export const Route = createFileRoute("/library")({
  component: LibraryPage,
  head: () => ({
    meta: [
      { title: "مكتبة التمارين — Kinetic Performance" },
      { name: "description", content: "مكتبة تمارين شاملة مع فلاتر ذكية حسب المستوى والمعدات والعضلات المستهدفة." },
    ],
  }),
});

const CATS: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "push", label: "دفع" },
  { id: "pull", label: "سحب" },
  { id: "legs", label: "أرجل" },
  { id: "core", label: "كور" },
  { id: "cardio", label: "كارديو" },
  { id: "mobility", label: "مرونة" },
];

const LEVELS: { id: Level | "all"; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "beginner", label: "مبتدئ" },
  { id: "intermediate", label: "متوسط" },
  { id: "advanced", label: "متقدم" },
];

const EQUIP: { id: Equipment | "all"; label: string }[] = [
  { id: "all", label: "الكل" },
  { id: "none", label: "بدون" },
  { id: "mat", label: "سجادة" },
  { id: "dumbbells", label: "دمبل" },
  { id: "kettlebell", label: "كيتل" },
  { id: "resistance-band", label: "شريط" },
  { id: "pullup-bar", label: "بار عقلة" },
];

function LibraryPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Category | "all">("all");
  const [lvl, setLvl] = useState<Level | "all">("all");
  const [eq, setEq] = useState<Equipment | "all">("all");
  const [showFilters, setShowFilters] = useState(false);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return EXERCISES.filter((e) => {
      if (cat !== "all" && e.category !== cat) return false;
      if (lvl !== "all" && e.level !== lvl) return false;
      if (eq !== "all" && !e.equipment.includes(eq)) return false;
      if (term && !(e.name.toLowerCase().includes(term) || e.latin.toLowerCase().includes(term)))
        return false;
      return true;
    });
  }, [q, cat, lvl, eq]);

  return (
    <PageShell>
      <PageHeader
        eyebrow="المكتبة الشاملة"
        title={`${list.length} تمرين`}
        action={
          <button
            onClick={() => setShowFilters((s) => !s)}
            className="size-10 rounded-full border border-border grid place-items-center"
            aria-label="فلترة"
          >
            <Filter className="size-4" />
          </button>
        }
      />

      <div className="px-6 space-y-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالاسم…"
            className="w-full h-12 rounded-2xl bg-surface border border-border px-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>

        <FilterRow items={CATS} value={cat} onChange={setCat} />
        {showFilters && (
          <>
            <FilterRow items={LEVELS} value={lvl} onChange={setLvl} />
            <FilterRow items={EQUIP} value={eq} onChange={setEq} />
          </>
        )}
      </div>

      <div className="px-6 mt-6 space-y-3">
        {list.map((ex, i) => (
          <motion.div
            key={ex.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.3) }}
          >
            <Link
              to="/exercise/$id"
              params={{ id: ex.id }}
              className="block rounded-2xl bg-surface/60 border border-border p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-1">
                    {ex.latin}
                  </p>
                  <h3 className="font-bold text-base leading-tight">{ex.name}</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Chip>{levelAr(ex.level)}</Chip>
                    <Chip>{categoryAr(ex.category)}</Chip>
                    {ex.primary.slice(0, 2).map((m) => (
                      <Chip key={m} tone="muted">
                        {m}
                      </Chip>
                    ))}
                  </div>
                </div>
                <ChevronLeft className="size-5 text-muted-foreground shrink-0" />
              </div>
            </Link>
          </motion.div>
        ))}

        {list.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">لا توجد نتائج مطابقة</p>
          </div>
        )}
      </div>

      <BottomNav />
    </PageShell>
  );
}

function FilterRow<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto -mx-6 px-6 pb-1 no-scrollbar">
      {items.map((i) => {
        const active = value === i.id;
        return (
          <button
            key={i.id}
            onClick={() => onChange(i.id)}
            className={`px-3.5 h-8 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              active
                ? "bg-primary text-primary-foreground"
                : "bg-surface border border-border text-muted-foreground"
            }`}
          >
            {i.label}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ children, tone = "primary" }: { children: React.ReactNode; tone?: "primary" | "muted" }) {
  return (
    <span
      className={`inline-flex items-center px-2 h-5 rounded-md text-[10px] font-mono uppercase tracking-wider ${
        tone === "primary"
          ? "bg-primary/15 text-primary"
          : "bg-surface border border-border text-muted-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function levelAr(l: Level) {
  return l === "beginner" ? "مبتدئ" : l === "intermediate" ? "متوسط" : "متقدم";
}
function categoryAr(c: Category) {
  const m: Record<Category, string> = {
    push: "دفع",
    pull: "سحب",
    legs: "أرجل",
    core: "كور",
    cardio: "كارديو",
    mobility: "مرونة",
    warmup: "إحماء",
    cooldown: "استرداد",
  };
  return m[c] ?? c;
}
