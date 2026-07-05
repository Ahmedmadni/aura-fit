import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Filter, ChevronLeft, Dumbbell, Zap, Activity, Heart } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell, PageHeader } from "@/components/page-shell";
import { AthleteIcon2D } from "@/components/athlete-2d";

export const Route = createFileRoute("/exercises")({
  component: ExerciseLibrary,
});

const categories = [
  { id: "all", label: "الكل", icon: Dumbbell },
  { id: "chest", label: "صدر", icon: Zap },
  { id: "back", label: "ظهر", icon: Activity },
  { id: "legs", label: "أرجل", icon: Heart },
  { id: "core", label: "بطن", icon: Zap },
  { id: "shoulders", label: "أكتاف", icon: Activity },
];

export const EXERCISES = [
  {
    id: "pull-up",
    name: "العقلة",
    latin: "Pull-Up",
    category: "back",
    level: "متقدم",
    equipment: "بار عقلة",
    primary: "الظهر العريض",
    secondary: ["البايسبس", "الكتف الخلفي"],
    calories: 12,
    difficulty: 4,
    color: "from-lime-400/20 to-transparent",
  },
  {
    id: "push-up",
    name: "الضغط",
    latin: "Push-Up",
    category: "chest",
    level: "مبتدئ",
    equipment: "بدون",
    primary: "الصدر",
    secondary: ["الترايسبس", "الكتف الأمامي"],
    calories: 8,
    difficulty: 2,
    color: "from-cyan-400/20 to-transparent",
  },
  {
    id: "squat",
    name: "القرفصاء",
    latin: "Squat",
    category: "legs",
    level: "متوسط",
    equipment: "بدون",
    primary: "الفخذ الأمامي",
    secondary: ["المؤخرة", "أوتار الركبة"],
    calories: 10,
    difficulty: 3,
    color: "from-orange-400/20 to-transparent",
  },
  {
    id: "deadlift",
    name: "الرفعة الميتة",
    latin: "Deadlift",
    category: "back",
    level: "محترف",
    equipment: "دمبل",
    primary: "الظهر السفلي",
    secondary: ["المؤخرة", "أوتار الركبة"],
    calories: 14,
    difficulty: 5,
    color: "from-red-400/20 to-transparent",
  },
  {
    id: "plank",
    name: "البلانك",
    latin: "Plank",
    category: "core",
    level: "مبتدئ",
    equipment: "بدون",
    primary: "عضلات البطن",
    secondary: ["الظهر السفلي", "الكتف"],
    calories: 5,
    difficulty: 2,
    color: "from-purple-400/20 to-transparent",
  },
  {
    id: "burpee",
    name: "البيربي",
    latin: "Burpee",
    category: "legs",
    level: "متقدم",
    equipment: "بدون",
    primary: "كامل الجسم",
    secondary: ["الصدر", "الأرجل", "القلب"],
    calories: 15,
    difficulty: 4,
    color: "from-pink-400/20 to-transparent",
  },
  {
    id: "lunge",
    name: "الاندفاع",
    latin: "Lunge",
    category: "legs",
    level: "مبتدئ",
    equipment: "بدون",
    primary: "الفخذ الأمامي",
    secondary: ["المؤخرة", "الساق"],
    calories: 9,
    difficulty: 2,
    color: "from-teal-400/20 to-transparent",
  },
  {
    id: "shoulder-press",
    name: "ضغط الكتف",
    latin: "Shoulder Press",
    category: "shoulders",
    level: "متوسط",
    equipment: "دمبل",
    primary: "الكتف الأوسط",
    secondary: ["الترايسبس", "الكتف الأمامي"],
    calories: 8,
    difficulty: 3,
    color: "from-blue-400/20 to-transparent",
  },
] as const;

function ExerciseLibrary() {
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  const filtered = EXERCISES.filter(
    (e) =>
      (cat === "all" || e.category === cat) &&
      (q === "" || e.name.includes(q) || e.latin.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <PageShell>
      <PageHeader eyebrow="MOTION LAB" title="مكتبة التمارين" />

      {/* Search */}
      <div className="px-6 mb-4 animate-enter">
        <div className="relative">
          <Search
            className="absolute right-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
            aria-hidden
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="text"
            placeholder="ابحث عن تمرين..."
            className="w-full bg-surface border border-border rounded-2xl pr-11 pl-14 py-3.5 text-sm focus:outline-none focus:border-primary transition-colors"
          />
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 size-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center"
            aria-label="فلترة"
          >
            <Filter className="size-4" />
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="mb-5 overflow-x-auto no-scrollbar" dir="rtl">
        <div className="flex gap-2 px-6 w-max">
          {categories.map((c) => {
            const Icon = c.icon;
            const active = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className={`shrink-0 px-4 py-2.5 rounded-xl border flex items-center gap-2 transition-all ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                    : "bg-surface border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-3.5" />
                <span className="text-xs font-bold">{c.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-6 mb-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>{filtered.length} تمرين</span>
        <span className="text-primary">MOTION-COACH · ACTIVE</span>
      </div>

      {/* Grid */}
      <section className="px-6 space-y-3 animate-enter">
        {filtered.map((ex, i) => (
          <Link
            key={ex.id}
            to="/exercise/$id"
            params={{ id: ex.id }}
            className="block relative rounded-2xl bg-card border border-border p-4 overflow-hidden active:scale-[0.99] transition-transform"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <div
              className={`absolute inset-0 bg-gradient-to-l ${ex.color} opacity-60 pointer-events-none`}
              aria-hidden
            />
            <div className="relative flex items-center gap-4">
              {/* Skeleton icon placeholder */}
              <div className="size-16 rounded-xl bg-background/60 border border-border grid place-items-center shrink-0 overflow-hidden">
                <AthleteIcon2D pose={ex.id as Parameters<typeof AthleteIcon2D>[0]["pose"]} size={54} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <h3 className="font-black text-lg leading-tight truncate">{ex.name}</h3>
                  <span className="text-[9px] font-mono uppercase tracking-widest text-primary shrink-0">
                    {ex.latin}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground truncate mb-2">
                  {ex.primary} · {ex.equipment}
                </p>
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="text-muted-foreground uppercase">{ex.level}</span>
                  <span className="text-primary">{ex.calories} كال/د</span>
                  <div className="flex gap-0.5 mr-auto">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={`w-1 h-3 rounded-full ${
                          i < ex.difficulty ? "bg-primary" : "bg-border"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </section>

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
