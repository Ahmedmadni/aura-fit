/**
 * Local-first user profile + workout history.
 * Persisted to localStorage; portable to Lovable Cloud later without API changes.
 */

import type { Equipment, Goal, Injury, Level } from "./exercise-db";

export interface UserProfile {
  name?: string;
  level: Level;
  goals: Goal[];
  equipment: Equipment[];
  injuries: Injury[];
  daysPerWeek: number;
  sessionMinutes: number;
  sleepQuality: number; // 1-5
  fatigue: number; // 1-5
  age?: number;
  weightKg?: number;
  heightCm?: number;
  gender?: "male" | "female";
}

export interface CompletedWorkout {
  id: string;
  date: string; // ISO
  exercises: {
    id: string;
    sets: number;
    reps: string;
    completed: boolean;
    /** Actual repetitions completed in each set. Absent on legacy/timed entries. */
    setReps?: number[];
    /** Prescription used for this session; optional for legacy entries. */
    progressionAction?: "build-reps" | "increase-load" | "hold" | "reduce";
  }[];
  durationSec: number;
  activeSec: number;
  calories: number;
  intensity: number; // 0-100
  performance: number; // 0-100
  /** Adaptive programming snapshot used for this completed session. */
  adaptationMode?: "progress" | "maintain" | "recovery";
  readinessScore?: number;
}

const P_KEY = "kp.profile";
const H_KEY = "kp.history";

export const DEFAULT_PROFILE: UserProfile = {
  level: "beginner",
  goals: ["general-fitness"],
  equipment: ["none", "mat"],
  injuries: [],
  daysPerWeek: 3,
  sessionMinutes: 30,
  sleepQuality: 4,
  fatigue: 2,
};

export function loadProfile(): UserProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(P_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function saveProfile(p: Partial<UserProfile>) {
  if (typeof window === "undefined") return;
  const current = loadProfile();
  const next = { ...current, ...p };
  localStorage.setItem(P_KEY, JSON.stringify(next));
}

export function loadHistory(): CompletedWorkout[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(H_KEY);
    return raw ? (JSON.parse(raw) as CompletedWorkout[]) : [];
  } catch {
    return [];
  }
}

export function recordWorkout(w: CompletedWorkout) {
  if (typeof window === "undefined") return;
  const all = loadHistory();
  all.unshift(w);
  localStorage.setItem(H_KEY, JSON.stringify(all.slice(0, 200)));
}

export interface DailyExerciseBest {
  exerciseId: string;
  bestSet: number;
  totalSets: number;
  previousBest: number | null;
  isPersonalBest: boolean;
}

export function dailyExerciseBests(
  history: CompletedWorkout[],
  dateKey: string,
): DailyExerciseBest[] {
  const today = new Map<string, { bestSet: number; totalSets: number }>();
  const previous = new Map<string, number>();

  for (const workout of history) {
    const isSelectedDay = workout.date.slice(0, 10) === dateKey;
    for (const exercise of workout.exercises) {
      const validSets = (exercise.setReps ?? []).filter(
        (value) => Number.isFinite(value) && value >= 0,
      );
      if (!validSets.length) continue;
      const best = Math.max(...validSets);
      if (isSelectedDay) {
        const existing = today.get(exercise.id);
        today.set(exercise.id, {
          bestSet: Math.max(existing?.bestSet ?? 0, best),
          totalSets: (existing?.totalSets ?? 0) + validSets.length,
        });
      } else if (workout.date.slice(0, 10) < dateKey) {
        previous.set(exercise.id, Math.max(previous.get(exercise.id) ?? 0, best));
      }
    }
  }

  return Array.from(today, ([exerciseId, result]) => {
    const previousBest = previous.get(exerciseId) ?? null;
    return {
      exerciseId,
      ...result,
      previousBest,
      isPersonalBest: previousBest === null || result.bestSet > previousBest,
    };
  }).sort((a, b) => b.bestSet - a.bestSet);
}

export function currentStreak(history: CompletedWorkout[]): number {
  if (!history.length) return 0;
  const days = new Set(history.map((w) => w.date.slice(0, 10)));
  let streak = 0;
  const d = new Date();
  for (;;) {
    const key = d.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      // allow today to be missing without breaking a yesterday streak
      if (streak === 0) {
        d.setDate(d.getDate() - 1);
        const key2 = d.toISOString().slice(0, 10);
        if (days.has(key2)) {
          streak++;
          d.setDate(d.getDate() - 1);
          continue;
        }
      }
      break;
    }
  }
  return streak;
}
