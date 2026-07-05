import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Brain,
  Flame,
  Heart,
  Shield,
  Sparkles,
  TrendingUp,
  Zap,
  Dna,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/dna")({
  head: () => ({
    meta: [
      { title: "الحمض الرياضي · كينيتك" },
      {
        name: "description",
        content: "تحليل ذكي متكامل لهويتك الرياضية: القوة، التحمل، المرونة، الاستشفاء وخطر الإصابة.",
      },
    ],
  }),
  component: DnaPage,
});

type Axis = { key: string; label: string; value: number; delta: number };

const AXES: Axis[] = [
  { key: "strength", label: "القوة", value: 82, delta: +4 },
  { key: "power", label: "الانفجارية", value: 74, delta: +2 },
  { key: "endurance", label: "التحمل", value: 68, delta: -1 },
  { key: "mobility", label: "المرونة", value: 55, delta: +6 },
  { key: "recovery", label: "الاستشفاء", value: 71, delta: +3 },
  { key: "consistency", label: "الثبات", value: 89, delta: +1 },
];

const RISKS = [
  { area: "الكتف الأيمن", level: "متوسط", pct: 42, note: "زيادة حجم دفع علوي بنسبة ٣٢٪" },
  { area: "أسفل الظهر", level: "منخفض", pct: 18, note: "توازن جيد بين السحب والدفع" },
  { area: "الركبة", level: "منخفض", pct: 22, note: "قوة رباعية مستقرة" },
];

const INSIGHTS = [
  {
    icon: Sparkles,
    title: "ذروتك الأدائية بعد ٥ ساعات من الاستيقاظ",
    hint: "بيانات نبض القلب والاستشفاء آخر ٣٠ يوم",
  },
  {
    icon: TrendingUp,
    title: "نمو قوة السحب ٢٣٪ خلال ٦ أسابيع",
    hint: "أعلى بـ ١٫٤× من متوسط مستواك",
  },
  {
    icon: Shield,
    title: "احتياط استشفاء منخفض غداً",
    hint: "المدرب الذكي سيقلل الشدة تلقائياً",
  },
];

function DnaPage() {
  const [selected, setSelected] = useState<string | null>("strength");
  const active = AXES.find((a) => a.key === selected) ?? AXES[0];
  const dnaScore = useMemo(
    () => Math.round(AXES.reduce((s, a) => s + a.value, 0) / AXES.length),
    [],
  );

  return (
    <PageShell>
      <header className="p-6 pt-10 flex items-end justify-between animate-enter">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
            KINETIC · DNA V2
          </p>
          <h1 className="text-3xl font-black tracking-tight leading-none">
            الحمض
            <br />
            الرياضي
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full">
          <Dna className="size-3.5 text-primary" />
          <span className="text-[10px] font-mono text-primary uppercase">SCORE</span>
          <span className="text-sm font-black" dir="ltr">
            {dnaScore}
          </span>
        </div>
      </header>

      {/* Radar */}
      <section className="px-6 mb-6 animate-enter [animation-delay:80ms]">
        <div className="bg-surface border border-border rounded-3xl p-4 backdrop-blur-xl">
          <RadarChart axes={AXES} onSelect={setSelected} selected={selected} />
          <div className="mt-3 pt-4 border-t border-border">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
              محور مختار
            </p>
            <div className="flex items-baseline justify-between">
              <p className="text-lg font-black">{active.label}</p>
              <div className="flex items-baseline gap-2 font-mono" dir="ltr">
                <span className="text-2xl font-black text-primary">{active.value}</span>
                <span
                  className={`text-[11px] font-bold ${
                    active.delta >= 0 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {active.delta >= 0 ? "+" : ""}
                  {active.delta}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Axis grid */}
      <section className="px-6 mb-8 animate-enter [animation-delay:150ms]">
        <div className="grid grid-cols-3 gap-2">
          {AXES.map((a) => (
            <button
              type="button"
              key={a.key}
              onClick={() => setSelected(a.key)}
              className={`text-right rounded-xl border p-3 backdrop-blur-xl transition-all active:scale-[0.98] ${
                selected === a.key
                  ? "bg-primary/10 border-primary/40"
                  : "bg-surface border-border hover:border-white/20"
              }`}
            >
              <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
                {a.label}
              </p>
              <p className="text-lg font-black text-primary mt-1" dir="ltr">
                {a.value}
              </p>
              <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${a.value}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Injury Risk */}
      <section className="px-6 mb-8 animate-enter [animation-delay:220ms]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            خريطة خطر الإصابة
          </h3>
          <span className="flex items-center gap-1 text-[10px] font-mono text-primary uppercase">
            <AlertTriangle className="size-3" /> AI SCAN
          </span>
        </div>
        <div className="bg-surface border border-border rounded-2xl divide-y divide-border backdrop-blur-xl">
          {RISKS.map((r) => (
            <div key={r.area} className="p-4 flex items-center gap-3">
              <div
                className={`size-10 grid place-items-center rounded-xl font-black text-sm ${
                  r.pct > 35
                    ? "bg-destructive/15 text-destructive"
                    : "bg-primary/10 text-primary"
                }`}
                dir="ltr"
              >
                {r.pct}%
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="text-sm font-black">{r.area}</p>
                  <span className="text-[9px] font-mono uppercase text-muted-foreground">
                    {r.level}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">{r.note}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* AI Insights */}
      <section className="px-6 mb-8 animate-enter [animation-delay:280ms]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            بصائر ذكية
          </h3>
          <Link
            to="/coach"
            className="flex items-center gap-1 text-[10px] font-mono text-primary uppercase"
          >
            المدرب <ChevronRight className="size-3 rtl:rotate-180" />
          </Link>
        </div>
        <div className="space-y-2">
          {INSIGHTS.map((i) => (
            <div
              key={i.title}
              className="bg-surface border border-border rounded-2xl p-4 flex items-start gap-3 backdrop-blur-xl"
            >
              <div className="size-9 grid place-items-center rounded-xl bg-primary/10 text-primary">
                <i.icon className="size-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug">{i.title}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{i.hint}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Vitals ribbon */}
      <section className="px-6 mb-24 animate-enter [animation-delay:340ms]">
        <div className="grid grid-cols-4 gap-2">
          <Vital icon={Heart} label="HRV" value="64" />
          <Vital icon={Activity} label="RHR" value="52" />
          <Vital icon={Flame} label="LOAD" value="7.8" />
          <Vital icon={Brain} label="FOCUS" value="A+" />
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function Vital({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-xl p-3 backdrop-blur-xl">
      <Icon className="size-3.5 text-primary mb-2" />
      <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-black" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function RadarChart({
  axes,
  onSelect,
  selected,
}: {
  axes: Axis[];
  onSelect: (k: string) => void;
  selected: string | null;
}) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 96;
  const n = axes.length;

  const point = (i: number, r: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r] as const;
  };

  const dataPoints = axes.map((a, i) => point(i, (a.value / 100) * radius));
  const path = dataPoints.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ") + " Z";

  return (
    <div className="relative flex justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="max-w-full">
        <defs>
          <radialGradient id="dna-fill" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.05" />
          </radialGradient>
        </defs>
        {/* rings */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <polygon
            key={f}
            points={axes
              .map((_, i) => {
                const [x, y] = point(i, radius * f);
                return `${x},${y}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        {/* spokes */}
        {axes.map((_, i) => {
          const [x, y] = point(i, radius);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}
        {/* filled */}
        <path
          d={path}
          fill="url(#dna-fill)"
          stroke="var(--brand)"
          strokeWidth="2"
          style={{ filter: "drop-shadow(0 0 12px rgba(204,255,0,0.35))" }}
        />
        {/* points */}
        {dataPoints.map(([x, y], i) => {
          const isSel = axes[i].key === selected;
          return (
            <g key={i} onClick={() => onSelect(axes[i].key)} style={{ cursor: "pointer" }}>
              <circle
                cx={x}
                cy={y}
                r={isSel ? 6 : 4}
                fill={isSel ? "var(--brand)" : "#0a0a0a"}
                stroke="var(--brand)"
                strokeWidth="2"
              />
            </g>
          );
        })}
        {/* labels */}
        {axes.map((a, i) => {
          const [x, y] = point(i, radius + 22);
          return (
            <text
              key={a.key}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-muted-foreground"
              style={{
                fontSize: 10,
                fontFamily: "var(--font-mono, monospace)",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              {a.label}
            </text>
          );
        })}
        {/* center score */}
        <circle cx={cx} cy={cy} r="22" fill="rgba(0,0,0,0.6)" stroke="var(--brand)" strokeWidth="1" />
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          className="fill-primary"
          style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.1em" }}
        >
          DNA
        </text>
      </svg>
    </div>
  );
}
