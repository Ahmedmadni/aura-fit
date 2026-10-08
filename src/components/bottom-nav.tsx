import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Home, Dumbbell, Play, Apple, User } from "lucide-react";
import {
  WORKOUT_SESSION_META_EVENT,
  loadWorkoutSessionMeta,
  type WorkoutSessionMetaV1,
} from "@/lib/workout-session-meta";

type NavPath = "/" | "/exercises" | "/workout" | "/nutrition" | "/profile";

export function BottomNav() {
  const { pathname } = useLocation();
  const [activeSession, setActiveSession] =
    useState<WorkoutSessionMetaV1 | null>(null);

  useEffect(() => {
    const refreshActiveSession = () => {
      setActiveSession(loadWorkoutSessionMeta());
    };

    refreshActiveSession();
    window.addEventListener(
      WORKOUT_SESSION_META_EVENT,
      refreshActiveSession,
    );
    return () => {
      window.removeEventListener(
        WORKOUT_SESSION_META_EVENT,
        refreshActiveSession,
      );
    };
  }, []);

  const items: {
    icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
    label: string;
    to: NavPath;
  }[] = [
    { icon: Home, label: "الرئيسية", to: "/" },
    { icon: Dumbbell, label: "التمارين", to: "/exercises" },
    { icon: Apple, label: "التغذية", to: "/nutrition" },
    { icon: User, label: "حسابي", to: "/profile" },
  ];

  return (
    <nav
      dir="ltr"
      aria-label="التنقل الرئيسي"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pb-5 pt-3 z-50 pointer-events-none"
      style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
    >
      <div className="bg-card/80 backdrop-blur-2xl border border-border rounded-2xl p-2 flex justify-between items-center shadow-[0_20px_60px_rgba(0,0,0,0.5)] pointer-events-auto">
        <NavLink item={items[0]} active={pathname === "/"} />
        <NavLink item={items[1]} active={pathname.startsWith("/exercise")} />
        <div className="flex-1 flex justify-center">
          <Link
            to="/workout"
            search={{ day: activeSession?.day ?? undefined }}
            className={
              "relative size-12 bg-primary rounded-2xl flex items-center justify-center -translate-y-5 shadow-[0_10px_30px_rgba(204,255,0,0.4)] active:scale-95 transition-transform text-primary-foreground " +
              (activeSession && !pathname.startsWith("/workout")
                ? "ring-2 ring-cyan/60"
                : "")
            }
            aria-label={activeSession ? "فتح الجلسة المحفوظة" : "ابدأ جلسة"}
            aria-current={pathname.startsWith("/workout") ? "page" : undefined}
          >
            <Play className="size-5 fill-current" strokeWidth={3} aria-hidden="true" />
            {activeSession && !pathname.startsWith("/workout") && (
              <>
                <span
                  className="absolute -right-1 -top-1 size-3 rounded-full border-2 border-background bg-cyan"
                  aria-hidden="true"
                />
                <span className="sr-only">جلسة محفوظة</span>
              </>
            )}
          </Link>
        </div>
        <NavLink item={items[2]} active={pathname.startsWith("/nutrition")} />
        <NavLink item={items[3]} active={pathname.startsWith("/profile")} />
      </div>
    </nav>
  );
}

function NavLink({
  item,
  active,
}: {
  item: { icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>; label: string; to: NavPath };
  active?: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      aria-current={active ? "page" : undefined}
      className={`flex-1 min-h-11 py-2 flex flex-col items-center justify-center gap-1 transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="text-[9px] font-mono uppercase tracking-tighter">{item.label}</span>
    </Link>
  );
}
