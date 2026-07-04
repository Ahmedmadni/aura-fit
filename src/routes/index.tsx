import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  Flame,
  Home,
  Dumbbell,
  Plus,
  Sparkles,
  User,
  Play,
  Zap,
  Heart,
  Moon,
  TrendingUp,
  Award,
} from "lucide-react";
import heroWorkout from "@/assets/hero-workout.jpg";
import programHypertrophy from "@/assets/program-hypertrophy.jpg";
import programMobility from "@/assets/program-mobility.jpg";
import programCardio from "@/assets/program-cardio.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { property: "og:image", content: "https://id-preview--a9dca5c6-d9fa-4c34-a631-4ce02f46fcb2.lovable.app/og.jpg" },
    ],
  }),
  component: Dashboard,
});

const weeklyBars = [
  { day: "M", pct: 60 },
  { day: "T", pct: 40 },
  { day: "W", pct: 90 },
  { day: "T", pct: 100, active: true },
  { day: "F", pct: 50 },
  { day: "S", pct: 20 },
  { day: "S", pct: 10 },
];

const programs = [
  { title: "Hypertrophy I", meta: "4 Weeks · Strength", img: programHypertrophy },
  { title: "Mobilize Flux", meta: "2 Weeks · Recovery", img: programMobility },
  { title: "Peak Aerobic", meta: "6 Weeks · Cardio", img: programCardio },
];

const achievements = [
  { icon: Flame, label: "14 Day Streak", value: "STRK" },
  { icon: Award, label: "Level 12 · Athlete", value: "LVL" },
  { icon: TrendingUp, label: "+12% Consistency", value: "TRND" },
];

function Dashboard() {
  return (
    <main className="min-h-screen bg-background text-foreground max-w-[430px] mx-auto overflow-x-hidden pb-32 relative">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-32 -right-24 size-72 rounded-full bg-primary/20 blur-[100px]" aria-hidden />
      <div className="pointer-events-none absolute top-96 -left-24 size-72 rounded-full bg-cyan/10 blur-[100px]" aria-hidden />

      {/* Header */}
      <header className="relative p-6 pt-10 flex justify-between items-end animate-enter">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground mb-1.5">
            Sat · Jul 04
          </p>
          <h1 className="text-2xl font-black tracking-tight italic uppercase leading-none">
            Welcome back,<br />Alex
          </h1>
        </div>
        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 px-2.5 py-1.5 rounded-full">
          <Flame className="size-3.5 text-primary" />
          <span className="text-primary text-[10px] font-mono font-bold">STRK</span>
          <span className="text-sm font-black">14</span>
        </div>
      </header>

      {/* Readiness card */}
      <section className="relative px-6 mb-6 animate-enter [animation-delay:100ms]">
        <div className="bg-surface border border-border rounded-3xl p-5 flex items-center justify-between backdrop-blur-xl">
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                Daily Readiness
              </p>
              <p className="text-4xl font-black italic text-primary leading-none">88%</p>
            </div>
            <div className="flex gap-4">
              <Stat icon={Heart} label="HRV" value="64ms" />
              <div className="border-l border-border pl-4">
                <Stat icon={Moon} label="Sleep" value="7h 20m" />
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
              <span className="text-xs font-bold uppercase">{a.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* AI Hero Workout */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:200ms]">
        <div className="relative overflow-hidden rounded-3xl aspect-[4/5] bg-card border border-border">
          <img
            src={heroWorkout}
            alt="AI recommended kinetic power workout"
            className="absolute inset-0 w-full h-full object-cover opacity-80"
            width={832}
            height={1024}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-background/60 via-transparent to-transparent" />

          <div className="absolute bottom-0 p-6 w-full space-y-4">
            <div className="flex gap-2 flex-wrap">
              <Tag className="bg-primary text-primary-foreground">
                <Sparkles className="size-3" /> AI Pick
              </Tag>
              <Tag className="bg-white/10 backdrop-blur-md text-white border border-white/10">
                <Zap className="size-3" /> High Intensity
              </Tag>
            </div>
            <div>
              <h2 className="text-4xl font-black italic leading-[0.95] uppercase mb-2 tracking-tight">
                Kinetic Power<br />Metcon 04
              </h2>
              <p className="text-sm text-white/70 max-w-[26ch]">
                Targeting posterior chain & explosive endurance. Tuned to today's recovery.
              </p>
            </div>
            <div className="flex items-center gap-5 font-mono text-[11px] text-muted-foreground uppercase tracking-widest">
              <span>32 MIN</span>
              <span className="text-white/30">·</span>
              <span>480 KCAL</span>
              <span className="text-white/30">·</span>
              <span>LVL 4</span>
            </div>
            <button
              type="button"
              className="w-full bg-primary hover:bg-white text-primary-foreground font-black py-4 rounded-xl transition-colors uppercase tracking-widest text-sm italic active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Play className="size-4 fill-current" />
              Start Session
            </button>
          </div>
        </div>
      </section>

      {/* Weekly consistency */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:300ms]">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Weekly Consistency
          </h3>
          <span className="text-[10px] font-mono text-primary uppercase">+12% vs LW</span>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5 backdrop-blur-xl">
          <div className="flex items-end justify-between h-24 gap-2">
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
                  className={`text-[9px] font-mono uppercase ${
                    b.active ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {b.day}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-3">
            <MiniStat label="Sessions" value="5" />
            <MiniStat label="Volume" value="12.4t" />
            <MiniStat label="Cal Burn" value="2,410" />
          </div>
        </div>
      </section>

      {/* Curated programs */}
      <section className="relative mb-8 animate-enter [animation-delay:400ms]">
        <div className="px-6 flex justify-between items-center mb-4">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            Curated Programs
          </h3>
          <span className="text-[10px] font-mono text-primary uppercase">View All</span>
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
                <div className="absolute bottom-2 right-2 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Play className="size-3 fill-current" />
                </div>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                {p.meta}
              </p>
              <p className="text-sm font-black uppercase italic tracking-tight mt-0.5">
                {p.title}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Quick actions */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:500ms]">
        <div className="grid grid-cols-2 gap-3">
          <QuickCard icon={Sparkles} label="AI Coach" hint="Ask anything" accent />
          <QuickCard icon={Activity} label="Nutrition" hint="1,842 / 2,400 kcal" />
        </div>
      </section>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pb-5 pt-3 z-50 pointer-events-none">
        <div className="bg-card/80 backdrop-blur-2xl border border-border rounded-2xl p-2 flex justify-between items-center shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-auto">
          <NavItem icon={Home} label="Dash" active />
          <NavItem icon={Dumbbell} label="Programs" />
          <div className="flex-1 flex justify-center">
            <button
              type="button"
              className="size-12 bg-primary rounded-2xl flex items-center justify-center -translate-y-5 shadow-[0_10px_30px_rgba(204,255,0,0.4)] active:scale-95 transition-transform text-primary-foreground"
              aria-label="Start workout"
            >
              <Plus className="size-6" strokeWidth={3} />
            </button>
          </div>
          <NavItem icon={Sparkles} label="Coach" />
          <NavItem icon={User} label="Profile" />
        </div>
      </nav>
    </main>
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
      <p className="text-sm font-black italic">{value}</p>
    </div>
  );
}

function Tag({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-md uppercase italic tracking-wider ${className}`}
    >
      {children}
    </span>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex-1 py-2 flex flex-col items-center gap-1 transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      <span className="text-[9px] font-mono uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function QuickCard({
  icon: Icon,
  label,
  hint,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      className={`text-left rounded-2xl border p-4 backdrop-blur-xl transition-all active:scale-[0.98] ${
        accent
          ? "bg-primary/10 border-primary/30 hover:bg-primary/15"
          : "bg-surface border-border hover:border-white/20"
      }`}
    >
      <Icon className={`size-5 mb-3 ${accent ? "text-primary" : "text-foreground"}`} />
      <p className="text-sm font-black italic uppercase tracking-tight">{label}</p>
      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mt-1">
        {hint}
      </p>
    </button>
  );
}

function ReadinessRings() {
  return (
    <div className="relative size-28">
      <svg className="size-full -rotate-90" viewBox="0 0 100 100">
        {/* Outer track */}
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
        {/* Inner track */}
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
        <span className="text-[9px] font-mono text-muted-foreground uppercase">Goal</span>
        <span className="text-sm font-black italic">72%</span>
      </div>
    </div>
  );
}
