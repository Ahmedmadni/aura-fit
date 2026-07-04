import { Link, useLocation } from "@tanstack/react-router";
import { Home, Dumbbell, Plus, Sparkles, User, TrendingUp } from "lucide-react";

export function BottomNav() {
  const { pathname } = useLocation();
  const items = [
    { icon: Home, label: "الرئيسية", to: "/" as const },
    { icon: Dumbbell, label: "البرامج", to: "/programs" as const },
    { icon: Sparkles, label: "المدرب", to: "/coach" as const },
    { icon: TrendingUp, label: "التقدم", to: "/progress" as const },
    { icon: User, label: "حسابي", to: "/profile" as const },
  ];

  return (
    <nav
      dir="ltr"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pb-5 pt-3 z-50 pointer-events-none"
    >
      <div className="bg-card/80 backdrop-blur-2xl border border-border rounded-2xl p-2 flex justify-between items-center shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-auto">
        <NavLink item={items[0]} active={pathname === "/"} />
        <NavLink item={items[1]} active={pathname.startsWith("/programs")} />
        <div className="flex-1 flex justify-center">
          <Link
            to="/onboarding"
            className="size-12 bg-primary rounded-2xl flex items-center justify-center -translate-y-5 shadow-[0_10px_30px_rgba(204,255,0,0.4)] active:scale-95 transition-transform text-primary-foreground"
            aria-label="ابدأ جلسة"
          >
            <Plus className="size-6" strokeWidth={3} />
          </Link>
        </div>
        <NavLink item={items[2]} active={pathname.startsWith("/coach")} />
        <NavLink item={items[4]} active={pathname.startsWith("/profile")} />
      </div>
    </nav>
  );
}

function NavLink({
  item,
  active,
}: {
  item: { icon: React.ComponentType<{ className?: string }>; label: string; to: "/" | "/programs" | "/coach" | "/progress" | "/profile" };
  active?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={`flex-1 py-2 flex flex-col items-center gap-1 transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" />
      <span className="text-[9px] font-mono uppercase tracking-tighter">{item.label}</span>
    </Link>
  );
}
