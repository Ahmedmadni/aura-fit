import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Settings,
  Award,
  Crown,
  Bell,
  Users,
  Gift,
  LogOut,
  ChevronLeft,
  Zap,
} from "lucide-react";
import { BottomNav } from "@/components/bottom-nav";
import { PageShell } from "@/components/page-shell";
import { FontSizeSetting } from "@/components/font-size-setting";

export const Route = createFileRoute("/profile")({
  component: Profile,
});

const badges = ["🔥", "💪", "⚡", "🏆", "🎯", "🥇"];

const menu = [
  { icon: Crown, label: "الاشتراك المميز", hint: "ترقية", accent: true },
  { icon: Bell, label: "الإشعارات", hint: "٥ مُفعلة" },
  { icon: Users, label: "المجتمع والأصدقاء", hint: "٢٣ صديق" },
  { icon: Gift, label: "دعوة الأصدقاء", hint: "اربح نقاط" },
  { icon: Settings, label: "الإعدادات", hint: "" },
  { icon: LogOut, label: "تسجيل الخروج", hint: "" },
];

function Profile() {
  return (
    <PageShell>
      {/* Hero */}
      <section className="relative p-6 pt-10 animate-enter">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
            حسابي
          </h1>
          <button
            type="button"
            className="size-10 rounded-full bg-surface border border-border grid place-items-center text-muted-foreground"
            aria-label="الإعدادات"
          >
            <Settings className="size-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 mb-6">
          <div className="size-20 rounded-3xl bg-gradient-to-br from-primary to-brand-dim grid place-items-center text-3xl font-black text-primary-foreground">
            أ
          </div>
          <div>
            <h2 className="text-2xl font-black leading-tight">أحمد المهدي</h2>
            <p className="text-xs text-muted-foreground">عضو منذ يناير ٢٠٢٦</p>
            <div className="flex items-center gap-1 mt-1">
              <Crown className="size-3 text-primary" />
              <span className="text-[10px] font-mono uppercase text-primary font-bold">
                عضوية مميزة
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4">
          <FontSizeSetting />
        </div>

        {/* Level bar */}
        <div className="bg-surface border border-border rounded-2xl p-4 backdrop-blur-xl">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-primary" />
              <span className="text-sm font-black">المستوى ١٢</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground" dir="ltr">
              1,840 / 2,400 XP
            </span>
          </div>
          <div className="h-2 bg-white/5 rounded-full overflow-hidden" dir="ltr">
            <div
              className="h-full bg-primary rounded-full shadow-[0_0_10px_rgba(204,255,0,0.5)]"
              style={{ width: "76%" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">٥٦٠ نقطة للمستوى التالي</p>
        </div>
      </section>

      {/* Stats grid */}
      <section className="relative px-6 mb-6 grid grid-cols-3 gap-3 animate-enter [animation-delay:100ms]">
        <MiniCard label="جلسة" value="147" />
        <MiniCard label="ساعة" value="82" />
        <MiniCard label="سعرة" value="34k" />
      </section>

      {/* Badges */}
      <section className="relative px-6 mb-6 animate-enter [animation-delay:200ms]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">
            الإنجازات
          </h3>
          <span className="text-[10px] font-mono text-primary uppercase">عرض الكل</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {badges.map((b, i) => (
            <div
              key={i}
              className="flex-shrink-0 size-16 rounded-2xl bg-surface border border-border grid place-items-center text-2xl backdrop-blur-xl"
            >
              {b}
            </div>
          ))}
        </div>
      </section>

      {/* Menu */}
      <section className="relative px-6 mb-8 animate-enter [animation-delay:300ms]">
        <div className="bg-surface border border-border rounded-2xl divide-y divide-border backdrop-blur-xl overflow-hidden">
          {menu.map((m) => (
            <button
              key={m.label}
              type="button"
              className={`w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-right ${
                m.accent ? "bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`size-9 rounded-xl grid place-items-center ${
                    m.accent
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface border border-border text-muted-foreground"
                  }`}
                >
                  <m.icon className="size-4" />
                </div>
                <span
                  className={`text-sm font-bold ${m.accent ? "text-primary" : "text-foreground"}`}
                >
                  {m.label}
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                {m.hint && (
                  <span className="text-[10px] font-mono uppercase tracking-widest">{m.hint}</span>
                )}
                <ChevronLeft className="size-4" />
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Redo onboarding CTA */}
      <section className="relative px-6 mb-6 animate-enter [animation-delay:400ms]">
        <Link
          to="/onboarding"
          className="w-full flex items-center justify-center gap-2 bg-surface border border-dashed border-border rounded-2xl py-4 text-sm font-bold text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
        >
          <Zap className="size-4" />
          إعادة ضبط الأهداف
        </Link>
      </section>

      <BottomNav />
    </PageShell>
  );
}

function MiniCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-3 text-center backdrop-blur-xl">
      <p className="text-xl font-black" dir="ltr">
        {value}
      </p>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
        {label}
      </p>
    </div>
  );
}
