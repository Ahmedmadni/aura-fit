import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  Flame,
  Sparkles,
  Play,
  Zap,
  Heart,
  Moon,
  TrendingUp,
  Award,
  Dna,
} from "lucide-react";
import heroWorkout from "@/assets/hero-workout.jpg";
import programHypertrophy from "@/assets/program-hypertrophy.jpg";
import programMobility from "@/assets/program-mobility.jpg";
import programCardio from "@/assets/program-cardio.jpg";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

const weeklyBars = [
  { day: "س", pct: 60 },
  { day: "ح", pct: 40 },
  { day: "ن", pct: 90 },
  { day: "ث", pct: 100, active: true },
  { day: "ر", pct: 50 },
  { day: "خ", pct: 20 },
  { day: "ج", pct: 10 },
];

const programs = [
  { title: "تضخيم عضلي", meta: "٤ أسابيع · قوة", img: programHypertrophy },
  { title: "مرونة ديناميكية", meta: "٢ أسبوع · استشفاء", img: programMobility },
  { title: "ذروة هوائية", meta: "٦ أسابيع · كارديو", img: programCardio },
];

const achievements = [
  { icon: Flame, label: "١٤ يوم متواصل", value: "STRK" },
  { icon: Award, label: "المستوى ١٢ · محترف", value: "LVL" },
  { icon: TrendingUp, label: "+١٢٪ ثبات", value: "TRND" },
];

function Dashboard() {
  return (
    <PageShell>
      {/* Header */}
      <header className="relative p-6 pt-10 flex justify-between items-end animate-enter">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
            السبت · ٠٤ يوليو
          </p>
          <h1 className="text-3xl font-black tracking-tight leading-none">
            أهلاً بعودتك،
            <br />
            أحمد
          </h1>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-full">
          <Flame className="size-3.5 text-primary" />
          <span className="text-primary text-[10px] font-mono font-bold">STRK</span>
          <span className="text-sm font-black">14</span>
        </div>
      </header>

      {/* Readiness */}
      <section className="relative px-6 mb-6 animate-enter [animation-delay:100ms]">
        <div className="bg-surface border border-border rounded-3xl p-5 flex items-center justify-between backdrop-blur-xl">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                جاهزية اليوم
              </p>
              <p className="text-4xl font-black text-primary leading-none" dir="ltr">
                88%
              </p>
            </div>
            <div className="flex gap-4">
              <Stat icon={Heart} label="HRV" value="64ms" />
              <div className="border-r border-border pr-4">
                <Stat icon={Moon} label="النوم" value="7س 20د" />
              </div>
            </div>
          </div>
          <ReadinessRings />
        </div>
      </section>

      {/* Achievements strip */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:150ms]">
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {achievements.map((a) => (
            <div
              key={a.label}
              className="flex-shrink-0 flex items-center gap-2 bg-surface border border-border rounded-xl px-3 py-2 backdrop-blur-xl"
            >
              <a.icon className="size-3.5 text-primary" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                {a.value}
              </span>
              <span className="text-xs font-bold">{a.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* AI Hero Workout */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:200ms]">
        <div className="relative overflow-hidden rounded-3xl aspect-[4/5] bg-card border border-border">
          <img
            src={heroWorkout}
            alt="تمرين اليوم المُقترح بالذكاء الاصطناعي"
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            width={832}
            height={1024}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-bl from-background/60 via-transparent to-transparent" />

          <div className="absolute bottom-0 p-6 w-full space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Tag className="bg-primary text-primary-foreground">
                <Sparkles className="size-3" /> اختيار الذكاء
              </Tag>
              <Tag className="bg-white/10 backdrop-blur-md text-white border border-white/10">
                <Zap className="size-3" /> شدة عالية
              </Tag>
            </div>
            <div>
              <h2 className="text-4xl font-black leading-[1] mb-2 tracking-tight">
                قوة كينيتك
                <br />
                ميتكون ٠٤
              </h2>
              <p className="text-sm text-white/70 max-w-[26ch]">
                يستهدف السلسلة الخلفية والتحمل الانفجاري. مُصمم حسب استشفاء اليوم.
              </p>
            </div>
            <div
              className="flex items-center gap-5 font-mono text-[11px] text-muted-foreground uppercase tracking-widest"
              dir="ltr"
            >
              <span>32 MIN</span>
              <span className="text-white/30">·</span>
              <span>480 KCAL</span>
              <span className="text-white/30">·</span>
              <span>LVL 4</span>
            </div>
            <Link
              to="/workout"
              className="w-full bg-primary hover:bg-white text-primary-foreground font-black py-4 rounded-xl transition-colors uppercase tracking-widest text-sm active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Play className="size-4 fill-current" />
              ابدأ الجلسة
            </Link>

          </div>
        </div>
      </section>

      {/* Weekly consistency */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:300ms]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            ثبات الأسبوع
          </h3>
          <span className="text-[10px] font-mono text-primary uppercase" dir="ltr">
            +12% vs LW
          </span>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 backdrop-blur-xl">
          <div className="flex items-end justify-between h-24 gap-2" dir="ltr">
            {weeklyBars.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 bg-white/5 rounded-t-md overflow-hidden relative flex items-end">
                  <div
                    className={`w-full rounded-t-md transition-all ${
                      b.active
                        ? "bg-primary shadow-[0_0_20px_rgba(204,255,0,0.4)]"
                        : "bg-white/20"
                    }`}
                    style={{ height: `${b.pct}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] font-bold ${
                    b.active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {b.day}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
            <MiniStat label="جلسات" value="5" />
            <MiniStat label="حجم" value="12.4t" />
            <MiniStat label="حرق" value="2,410" />
          </div>
        </div>
      </section>

      {/* Curated programs */}
      <section className="relative mb-8 animate-enter [animation-delay:400ms]">
        <div className="px-6 flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            برامج مختارة
          </h3>
          <span className="text-[10px] font-mono text-primary uppercase">عرض الكل</span>
        </div>
        <div className="flex gap-4 overflow-x-auto px-6 no-scrollbar">
          {programs.map((p) => (
            <article key={p.title} className="min-w-[170px] group cursor-pointer">
              <div className="aspect-square rounded-2xl bg-card border border-border overflow-hidden mb-3 relative">
                <img
                  src={p.img}
                  alt={p.title}
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
                  loading="lazy"
                  width={512}
                  height={512}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                <div className="absolute bottom-2 left-2 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Play className="size-3 fill-current" />
                </div>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {p.meta}
              </p>
              <p className="text-sm font-black tracking-tight mt-0.5">{p.title}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:500ms]">
        <div className="grid grid-cols-2 gap-3">
          <QuickLink to="/dna" icon={Dna} label="الحمض الرياضي" hint="تحليل ذكي متكامل" accent />
          <QuickLink to="/coach" icon={Sparkles} label="المدرب الذكي" hint="اسألني أي شيء" />
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 mb-0.5">
        <Icon className="size-2.5 text-muted-foreground" />
        <p className="text-[10px] font-mono text-muted-foreground uppercase">{label}</p>
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-0.5">
        {label}
      </p>
      <p className="text-sm font-black" dir="ltr">
        {value}
      </p>
    </div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md uppercase tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}

type QuickProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  accent?: boolean;
};

function QuickLink({ to, ...props }: QuickProps & { to: "/dna" | "/coach" | "/nutrition" }) {
  const { icon: Icon, label, hint, accent } = props;
  return (
    <Link
      to={to}
      className={`text-right rounded-2xl border p-4 backdrop-blur-xl transition-all active:scale-[0.98] block ${
        accent
          ? "bg-primary/10 border-primary/30 hover:bg-primary/15"
          : "bg-surface border-border hover:border-white/20"
      }`}
    >
      <Icon className={`size-5 mb-3 ${accent ? "text-primary" : "text-foreground"}`} />
      <p className="text-sm font-black tracking-tight">{label}</p>
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
        {hint}
      </p>
    </Link>
  );
}

function ReadinessRings() {
  return (
    <div className="relative size-28">
      <svg className="size-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--brand)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="264"
          strokeDashoffset="32"
          style={{ filter: "drop-shadow(0 0 8px rgba(204,255,0,0.5))" }}
        />
        <circle cx="50" cy="50" r="30" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="50"
          cy="50"
          r="30"
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="188"
          strokeDashoffset="70"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-mono text-muted-foreground uppercase">هدف</span>
        <span className="text-sm font-black" dir="ltr">
          72%
        </span>
      </div>
    </div>
  );
}
