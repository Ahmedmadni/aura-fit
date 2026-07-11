/**
 * Local achievements + XP system.
 * XP curve: level n requires 100 * n * (n+1) / 2 total XP (triangular).
 */

import { currentStreak, loadHistory, type CompletedWorkout } from "./user-profile";

export interface Achievement {
  id: string;
  title: string;
  desc: string;
  icon: string;
  unlocked: boolean;
}

const A_KEY = "kp.achievements";

const CATALOG: Omit<Achievement, "unlocked">[] = [
  { id: "first-workout", title: "الخطوة الأولى", desc: "أكمل أول جلسة", icon: "🎯" },
  { id: "streak-3", title: "الإصرار", desc: "٣ أيام متتالية", icon: "🔥" },
  { id: "streak-7", title: "أسبوع كامل", desc: "٧ أيام متتالية", icon: "🏆" },
  { id: "streak-30", title: "شهر أسطوري", desc: "٣٠ يوماً متتالية", icon: "👑" },
  { id: "sessions-10", title: "الرياضي الصاعد", desc: "١٠ جلسات مكتملة", icon: "💪" },
  { id: "sessions-50", title: "المخضرم", desc: "٥٠ جلسة مكتملة", icon: "⭐" },
  { id: "sessions-100", title: "الأسطورة", desc: "١٠٠ جلسة مكتملة", icon: "💎" },
  { id: "high-intensity", title: "الطاقة القصوى", desc: "جلسة بشدة 90+", icon: "⚡" },
];

export function totalXp(history: CompletedWorkout[]): number {
  return history.reduce(
    (s, w) => s + Math.round(w.calories * 0.5 + w.performance * 2),
    0,
  );
}

export function levelFromXp(xp: number): { level: number; next: number; progress: number } {
  let level = 1;
  while ((100 * level * (level + 1)) / 2 <= xp) level++;
  const prev = (100 * (level - 1) * level) / 2;
  const next = (100 * level * (level + 1)) / 2;
  return { level, next, progress: (xp - prev) / (next - prev) };
}

export function computeAchievements(history: CompletedWorkout[] = loadHistory()): Achievement[] {
  const sessions = history.length;
  const streak = currentStreak(history);
  const maxIntensity = history.reduce((m, w) => Math.max(m, w.intensity), 0);
  const unlockMap: Record<string, boolean> = {
    "first-workout": sessions >= 1,
    "streak-3": streak >= 3,
    "streak-7": streak >= 7,
    "streak-30": streak >= 30,
    "sessions-10": sessions >= 10,
    "sessions-50": sessions >= 50,
    "sessions-100": sessions >= 100,
    "high-intensity": maxIntensity >= 90,
  };
  return CATALOG.map((a) => ({ ...a, unlocked: !!unlockMap[a.id] }));
}

export function checkNewAchievements(history: CompletedWorkout[]): Achievement[] {
  if (typeof window === "undefined") return [];
  const current = computeAchievements(history).filter((a) => a.unlocked);
  const seen: string[] = JSON.parse(localStorage.getItem(A_KEY) ?? "[]");
  const fresh = current.filter((a) => !seen.includes(a.id));
  localStorage.setItem(A_KEY, JSON.stringify(current.map((a) => a.id)));
  return fresh;
}
