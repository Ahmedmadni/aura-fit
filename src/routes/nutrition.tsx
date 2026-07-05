import { createFileRoute } from "@tanstack/react-router";
import { Droplet, Flame, Beef, Wheat, Apple, Plus } from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell, PageHeader } from "@/components/page-shell";

export const Route = createFileRoute("/nutrition")({
  component: Nutrition,
});

const macros = [
  { label: "بروتين", value: 128, target: 160, unit: "غ", color: "#ccff00", icon: Beef },
  { label: "كربوهيدرات", value: 210, target: 280, unit: "غ", color: "#00d9ff", icon: Wheat },
  { label: "دهون", value: 58, target: 70, unit: "غ", color: "#ff6b9d", icon: Apple },
];

const meals = [
  { time: "٠٧:٣٠", name: "شوفان بالتوت والمكسرات", kcal: 420, tag: "فطور" },
  { time: "١٢:٠٠", name: "دجاج مشوي مع أرز أسمر", kcal: 680, tag: "غداء" },
  { time: "١٦:٣٠", name: "بروتين شيك + موز", kcal: 320, tag: "سناك" },
  { time: "٢٠:٠٠", name: "سلمون + خضروات مشوية", kcal: 520, tag: "عشاء" },
];

function Nutrition() {
  const consumed = 1940;
  const target = 2400;
  const pct = (consumed / target) * 100;

  return (
    <PageShell>
      <PageHeader eyebrow="FUEL SYSTEM" title="التغذية" />

      {/* Main ring */}
      <section className="px-6 mb-6 animate-enter">
        <div className="bg-card border border-border rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute -top-16 -left-16 size-40 rounded-full bg-primary/10 blur-3xl" aria-hidden />
          <div className="relative flex items-center gap-6">
            <div className="relative shrink-0">
              <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
                <circle cx="60" cy="60" r="52" stroke="hsl(0 0% 100% / 0.08)" strokeWidth="10" fill="none" />
                <circle
                  cx="60"
                  cy="60"
                  r="52"
                  stroke="#ccff00"
                  strokeWidth="10"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 326.7} 326.7`}
                  style={{ filter: "drop-shadow(0 0 8px rgba(204,255,0,0.5))" }}
                />
              </svg>
              <div className="absolute inset-0 grid place-items-center text-center">
                <div>
                  <p className="text-2xl font-black leading-none">{consumed}</p>
                  <p className="text-[9px] font-mono uppercase text-muted-foreground mt-1">من {target}</p>
                </div>
              </div>
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-1">
                استهلاك اليوم
              </p>
              <h2 className="text-3xl font-black leading-tight">
                {target - consumed}
                <span className="text-sm font-mono text-muted-foreground mr-1">كال متبقية</span>
              </h2>
              <div className="mt-3 flex items-center gap-2 text-xs">
                <Flame className="size-3.5 text-primary" />
                <span className="text-muted-foreground">حرقت اليوم ٣٢٠ كال</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Macros */}
      <section className="px-6 mb-6 animate-enter">
        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
          الماكروز
        </p>
        <div className="grid grid-cols-3 gap-2">
          {macros.map((m) => {
            const p = (m.value / m.target) * 100;
            const Icon = m.icon;
            return (
              <div key={m.label} className="bg-card border border-border rounded-2xl p-3">
                <Icon className="size-4 mb-2" style={{ color: m.color }} />
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                  {m.label}
                </p>
                <p className="text-lg font-black mt-1">
                  {m.value}
                  <span className="text-[10px] text-muted-foreground font-mono">/{m.target}{m.unit}</span>
                </p>
                <div className="h-1 mt-2 bg-surface rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, p)}%`, background: m.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Water */}
      <section className="px-6 mb-6 animate-enter">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Droplet className="size-4 text-cyan" />
              <p className="text-sm font-black">الماء</p>
            </div>
            <p className="font-mono text-xs text-muted-foreground">١.٨ / ٣.٠ لتر</p>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <button
                key={i}
                type="button"
                className={`flex-1 h-10 rounded-lg border transition-all ${
                  i < 5
                    ? "bg-cyan/30 border-cyan"
                    : "bg-surface border-border hover:border-cyan/40"
                }`}
                aria-label={`كوب ${i + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Meals */}
      <section className="px-6 mb-6 animate-enter">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            وجبات اليوم
          </p>
          <button
            type="button"
            className="size-8 rounded-lg bg-primary/10 border border-primary/30 text-primary grid place-items-center"
            aria-label="أضف وجبة"
          >
            <Plus className="size-4" />
          </button>
        </div>
        <div className="space-y-2">
          {meals.map((m) => (
            <div
              key={m.name}
              className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4"
            >
              <div className="text-center shrink-0">
                <p className="text-[9px] font-mono uppercase text-muted-foreground">{m.tag}</p>
                <p className="font-mono text-xs text-primary mt-0.5">{m.time}</p>
              </div>
              <div className="w-px h-10 bg-border" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{m.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">
                  {m.kcal} كال
                </p>
              </div>
              <div className="text-primary font-mono text-xs">✓</div>
            </div>
          ))}
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}
