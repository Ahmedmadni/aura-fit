import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Play, Clock, Flame, TrendingUp } from "lucide-react";
import programHypertrophy from "@/assets/program-hypertrophy.jpg";
import programMobility from "@/assets/program-mobility.jpg";
import programCardio from "@/assets/program-cardio.jpg";
import heroWorkout from "@/assets/hero-workout.jpg";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell, PageHeader } from "@/components/page-shell";

export const Route = createFileRoute("/programs")({
  component: Programs,
});

const categories = [
  "الكل",
  "خسارة الوزن",
  "بناء العضلات",
  "كارديو",
  "مرونة",
  "تأهيل",
  "منزل",
  "كبار السن",
];

const programs = [
  {
    title: "تحويل ٣٠ يوم",
    meta: "خسارة الوزن",
    dur: "30 د",
    burn: "420",
    lvl: "متوسط",
    img: heroWorkout,
    tag: "الأكثر شعبية",
  },
  {
    title: "تضخيم عضلي I",
    meta: "بناء العضلات",
    dur: "45 د",
    burn: "380",
    lvl: "متقدم",
    img: programHypertrophy,
  },
  {
    title: "مرونة ديناميكية",
    meta: "استشفاء",
    dur: "20 د",
    burn: "180",
    lvl: "مبتدئ",
    img: programMobility,
  },
  {
    title: "ذروة هوائية",
    meta: "كارديو",
    dur: "35 د",
    burn: "540",
    lvl: "متقدم",
    img: programCardio,
  },
  {
    title: "تأهيل الركبة",
    meta: "تأهيل",
    dur: "25 د",
    burn: "150",
    lvl: "علاجي",
    img: programMobility,
  },
  {
    title: "قوة منزلية",
    meta: "بدون معدات",
    dur: "30 د",
    burn: "320",
    lvl: "مبتدئ",
    img: programHypertrophy,
  },
];

function Programs() {
  const [active, setActive] = useState("الكل");
  return (
    <PageShell>
      <PageHeader eyebrow="المكتبة" title={"برامج\nمتكاملة"} />

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-6 mb-6 animate-enter [animation-delay:100ms]">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setActive(c)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              active === c
                ? "bg-primary text-primary-foreground"
                : "bg-surface border border-border text-muted-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Featured */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:200ms]">
        <div className="relative overflow-hidden rounded-3xl aspect-[16/10] bg-card border border-border">
          <img
            src={heroWorkout}
            alt="البرنامج المميز"
            className="absolute inset-0 w-full h-full object-cover opacity-70"
            width={832}
            height={520}
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
          <div className="absolute bottom-0 p-5 w-full">
            <span className="inline-block bg-primary text-primary-foreground text-[10px] font-black px-2 py-1 rounded-md uppercase mb-2">
              مميز
            </span>
            <h2 className="text-2xl font-black leading-tight mb-1">تحدي ٩٠ يوم للتحول</h2>
            <p className="text-xs text-white/70">برنامج شامل بالذكاء الاصطناعي مع مدرب افتراضي</p>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:300ms]">
        <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-4">
          كل البرامج
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {programs.map((p) => (
            <article
              key={p.title}
              className="group cursor-pointer rounded-2xl bg-surface border border-border overflow-hidden backdrop-blur-xl"
            >
              <div className="aspect-square relative">
                <img
                  src={p.img}
                  alt={p.title}
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                  loading="lazy"
                  width={300}
                  height={300}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
                {p.tag && (
                  <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[9px] font-black px-2 py-0.5 rounded uppercase">
                    {p.tag}
                  </span>
                )}
                <div className="absolute bottom-2 left-2 size-8 rounded-full bg-primary text-primary-foreground grid place-items-center">
                  <Play className="size-3 fill-current" />
                </div>
              </div>
              <div className="p-3">
                <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  {p.meta}
                </p>
                <h4 className="text-sm font-black tracking-tight mb-2">{p.title}</h4>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" /> {p.dur}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Flame className="size-3" /> {p.burn}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[9px] text-primary font-bold">
                  <TrendingUp className="size-3" /> {p.lvl}
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <BottomNav />
    </PageShell>
  );
}
