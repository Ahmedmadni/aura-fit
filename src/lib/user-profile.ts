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
    /** External load used for each set in kilograms. */
    setLoadsKg?: number[];
    /** Repetitions in reserve reported after each set (0-5). */
    setRir?: number[];
    /** RPE derived/recorded for each set (typically 10 - RIR). */
    setRpe?: number[];
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

export interface ExerciseStrengthSummary {
  exerciseId: string;
  sessions: number;
  lastLoadKg: number;
  bestLoadKg: number;
  bestEstimated1RmKg: number;
  averageRir: number | null;
  latestEstimated1RmKg: number;
}

export function estimateOneRepMaxKg(
  loadKg: number,
  reps: number,
  rir = 0,
): number {
  if (!Number.isFinite(loadKg) || loadKg <= 0) return 0;
  const effectiveReps = Math.max(
    1,
    Math.min(20, Math.round(reps + Math.max(0, Math.min(5, rir)))),
  );
  return Math.round(loadKg * (1 + effectiveReps / 30) * 10) / 10;
}

export function exerciseStrengthSummaries(
  history: CompletedWorkout[],
): ExerciseStrengthSummary[] {
  const byExercise = new Map<
    string,
    {
      sessions: Set<string>;
      lastLoadKg: number;
      bestLoadKg: number;
      bestEstimated1RmKg: number;
      latestEstimated1RmKg: number;
      rirValues: number[];
      sawLatest: boolean;
    }
  >();

  for (const workout of history) {
    for (const exercise of workout.exercises) {
      const loads = exercise.setLoadsKg ?? [];
      const reps = exercise.setReps ?? [];
      const rirs =
        exercise.setRir ??
        (exercise.setRpe ?? []).map((rpe) =>
          Math.max(0, Math.min(5, 10 - rpe)),
        );
      if (!loads.some((load) => Number.isFinite(load) && load > 0)) continue;

      const current =
        byExercise.get(exercise.id) ?? {
          sessions: new Set<string>(),
          lastLoadKg: 0,
          bestLoadKg: 0,
          bestEstimated1RmKg: 0,
          latestEstimated1RmKg: 0,
          rirValues: [],
          sawLatest: false,
        };
      current.sessions.add(workout.id);

      for (let index = 0; index < loads.length; index += 1) {
        const load = Number(loads[index] ?? 0);
        if (!Number.isFinite(load) || load <= 0) continue;
        const repCount = Number(reps[index] ?? 0);
        const rir = Number(rirs[index] ?? 0);
        const e1rm =
          repCount > 0
            ? estimateOneRepMaxKg(
                load,
                repCount,
                Number.isFinite(rir) ? rir : 0,
              )
            : load;

        if (!current.sawLatest) {
          current.lastLoadKg = load;
          current.latestEstimated1RmKg = Math.max(
            current.latestEstimated1RmKg,
            e1rm,
          );
        }
        current.bestLoadKg = Math.max(current.bestLoadKg, load);
        current.bestEstimated1RmKg = Math.max(
          current.bestEstimated1RmKg,
          e1rm,
        );
        if (Number.isFinite(rir)) current.rirValues.push(rir);
      }

      if (current.lastLoadKg > 0) current.sawLatest = true;
      byExercise.set(exercise.id, current);
    }
  }

  return Array.from(byExercise, ([exerciseId, data]) => ({
    exerciseId,
    sessions: data.sessions.size,
    lastLoadKg: Math.round(data.lastLoadKg * 10) / 10,
    bestLoadKg: Math.round(data.bestLoadKg * 10) / 10,
    bestEstimated1RmKg: Math.round(data.bestEstimated1RmKg * 10) / 10,
    averageRir: data.rirValues.length
      ? Math.round(
          (data.rirValues.reduce((sum, value) => sum + value, 0) /
            data.rirValues.length) *
            10,
        ) / 10
      : null,
    latestEstimated1RmKg:
      Math.round(data.latestEstimated1RmKg * 10) / 10,
  })).sort(
    (a, b) =>
      b.bestEstimated1RmKg - a.bestEstimated1RmKg ||
      b.sessions - a.sessions,
  );
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
