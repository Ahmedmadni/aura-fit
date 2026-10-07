/**
 * Local-first user profile + workout history.
 * localStorage remains the source used by the UI; optional cloud sync mirrors it.
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

export interface DailyReadinessCheckIn {
  dateKey: string;
  recordedAt: string;
  sleepQuality: number; // 1-5
  fatigue: number; // 1-5
  muscleSoreness: number; // 1-5
  energy: number; // 1-5
}

export function readinessDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function clampFive(value: number) {
  return Math.max(1, Math.min(5, Math.round(value)));
}

export function normalizeReadinessCheckIn(
  value: DailyReadinessCheckIn,
): DailyReadinessCheckIn {
  return {
    dateKey: value.dateKey,
    recordedAt: value.recordedAt,
    sleepQuality: clampFive(value.sleepQuality),
    fatigue: clampFive(value.fatigue),
    muscleSoreness: clampFive(value.muscleSoreness),
    energy: clampFive(value.energy),
  };
}

export interface CompletedWorkout {
  id: string;
  date: string; // ISO
  exercises: {
    id: string;
    sets: number;
    reps: string;
    completed: boolean;
    /** Explicitly skipped by the user during an active workout. */
    skipped?: boolean;
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
    /** Exercise rotation context; absent for stable exercises/legacy entries. */
    rotatedFromId?: string;
    rotationReason?: "mesocycle" | "plateau" | "manual";
  }[];
  durationSec: number;
  activeSec: number;
  calories: number;
  intensity: number; // 0-100
  performance: number; // 0-100
  /** Adaptive programming snapshot used for this completed session. */
  adaptationMode?: "progress" | "maintain" | "recovery";
  readinessScore?: number;
  /** Periodization context used for this completed session. */
  periodizationPhase?:
    | "accumulation"
    | "progression"
    | "intensification"
    | "deload";
  periodizationCycleWeek?: 1 | 2 | 3 | 4;
}

const P_KEY = "kp.profile";
const P_UPDATED_KEY = "kp.profile.updated-at";
const H_KEY = "kp.history";
const R_KEY = "kp.readiness";

export const LOCAL_DATA_CHANGED_EVENT = "aura:local-data-changed";
export type LocalDataChange =
  | { kind: "profile" }
  | { kind: "workout"; id: string }
  | { kind: "readiness"; dateKey: string };

function emitLocalDataChanged(detail: LocalDataChange) {
  if (
    typeof window === "undefined" ||
    typeof window.dispatchEvent !== "function"
  ) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<LocalDataChange>(LOCAL_DATA_CHANGED_EVENT, { detail }),
  );
}

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

export function loadProfileUpdatedAt() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(P_UPDATED_KEY);
}

export function replaceLocalProfile(
  profile: UserProfile,
  updatedAt = new Date().toISOString(),
  emit = false,
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(P_KEY, JSON.stringify({ ...DEFAULT_PROFILE, ...profile }));
  localStorage.setItem(P_UPDATED_KEY, updatedAt);
  if (emit) emitLocalDataChanged({ kind: "profile" });
}

export function saveProfile(p: Partial<UserProfile>) {
  if (typeof window === "undefined") return;
  const current = loadProfile();
  const next = { ...current, ...p };
  replaceLocalProfile(next, new Date().toISOString(), false);
  emitLocalDataChanged({ kind: "profile" });
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

export function replaceLocalHistory(
  history: CompletedWorkout[],
  emit = false,
) {
  if (typeof window === "undefined") return;
  const unique = Array.from(
    new Map(history.map((workout) => [workout.id, workout])).values(),
  )
    .sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
    )
    .slice(0, 200);
  localStorage.setItem(H_KEY, JSON.stringify(unique));
  if (emit) {
    for (const workout of unique) {
      emitLocalDataChanged({ kind: "workout", id: workout.id });
    }
  }
}

export function recordWorkout(w: CompletedWorkout) {
  if (typeof window === "undefined") return;
  const all = loadHistory().filter((item) => item.id !== w.id);
  replaceLocalHistory([w, ...all], false);
  emitLocalDataChanged({ kind: "workout", id: w.id });
}

export function loadReadinessHistory(): DailyReadinessCheckIn[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(R_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyReadinessCheckIn[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.dateKey === "string" &&
          typeof item.recordedAt === "string",
      )
      .map(normalizeReadinessCheckIn)
      .slice(0, 90);
  } catch {
    return [];
  }
}

export function readinessForDate(
  entries: DailyReadinessCheckIn[],
  dateKey: string,
): DailyReadinessCheckIn | undefined {
  return entries.find((item) => item.dateKey === dateKey);
}

export function loadTodayReadiness(
  date = new Date(),
): DailyReadinessCheckIn | undefined {
  return readinessForDate(loadReadinessHistory(), readinessDateKey(date));
}

export function replaceLocalReadinessHistory(
  entries: DailyReadinessCheckIn[],
  emit = false,
) {
  if (typeof window === "undefined") return;
  const byDate = new Map<string, DailyReadinessCheckIn>();
  for (const entry of entries) {
    const normalized = normalizeReadinessCheckIn(entry);
    const existing = byDate.get(normalized.dateKey);
    if (
      !existing ||
      new Date(normalized.recordedAt).getTime() >
        new Date(existing.recordedAt).getTime()
    ) {
      byDate.set(normalized.dateKey, normalized);
    }
  }
  const next = Array.from(byDate.values())
    .sort(
      (a, b) =>
        new Date(b.recordedAt).getTime() -
        new Date(a.recordedAt).getTime(),
    )
    .slice(0, 90);
  localStorage.setItem(R_KEY, JSON.stringify(next));
  if (emit) {
    for (const item of next) {
      emitLocalDataChanged({ kind: "readiness", dateKey: item.dateKey });
    }
  }
}

export function saveDailyReadiness(
  values: Omit<DailyReadinessCheckIn, "recordedAt"> &
    Partial<Pick<DailyReadinessCheckIn, "recordedAt">>,
) {
  if (typeof window === "undefined") return;
  const next = normalizeReadinessCheckIn({
    ...values,
    recordedAt: values.recordedAt ?? new Date().toISOString(),
  });
  const all = loadReadinessHistory().filter(
    (item) => item.dateKey !== next.dateKey,
  );
  replaceLocalReadinessHistory([next, ...all], false);
  emitLocalDataChanged({ kind: "readiness", dateKey: next.dateKey });
  return next;
}

export interface ExerciseStrengthPoint {
  workoutId: string;
  date: string;
  bestLoadKg: number;
  bestEstimated1RmKg: number;
  loadVolumeKgReps: number;
  averageRir: number | null;
}

export interface ExerciseStrengthAnalysis {
  exerciseId: string;
  points: ExerciseStrengthPoint[];
  sessions: number;
  lastLoadKg: number;
  bestLoadKg: number;
  latestEstimated1RmKg: number;
  bestEstimated1RmKg: number;
  latestLoadVolumeKgReps: number;
  totalLoadVolumeKgReps: number;
  averageRir: number | null;
  trendPercent: number;
  trend: "up" | "flat" | "down";
  plateau: boolean;
  latestLoadIsPr: boolean;
  latestEstimated1RmIsPr: boolean;
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

function validEffortValues(
  exercise: CompletedWorkout["exercises"][number],
) {
  return (
    exercise.setRir ??
    (exercise.setRpe ?? []).map((rpe) =>
      Math.max(0, Math.min(5, 10 - rpe)),
    )
  ).filter((value) => Number.isFinite(value));
}

export function exerciseStrengthPoints(
  history: CompletedWorkout[],
  exerciseId: string,
): ExerciseStrengthPoint[] {
  const points: ExerciseStrengthPoint[] = [];

  for (const workout of history) {
    const exercise = workout.exercises.find(
      (item) => item.id === exerciseId && item.completed,
    );
    if (!exercise) continue;

    const loads = exercise.setLoadsKg ?? [];
    const reps = exercise.setReps ?? [];
    const rirs =
      exercise.setRir ??
      (exercise.setRpe ?? []).map((rpe) =>
        Math.max(0, Math.min(5, 10 - rpe)),
      );

    let bestLoadKg = 0;
    let bestEstimated1RmKg = 0;
    let loadVolumeKgReps = 0;

    for (let index = 0; index < loads.length; index += 1) {
      const load = Number(loads[index] ?? 0);
      const repCount = Number(reps[index] ?? 0);
      const rir = Number(rirs[index] ?? 0);
      if (!Number.isFinite(load) || load <= 0) continue;

      bestLoadKg = Math.max(bestLoadKg, load);
      if (Number.isFinite(repCount) && repCount > 0) {
        loadVolumeKgReps += load * repCount;
        bestEstimated1RmKg = Math.max(
          bestEstimated1RmKg,
          estimateOneRepMaxKg(
            load,
            repCount,
            Number.isFinite(rir) ? rir : 0,
          ),
        );
      } else {
        bestEstimated1RmKg = Math.max(bestEstimated1RmKg, load);
      }
    }

    if (bestLoadKg <= 0) continue;
    const validRir = validEffortValues(exercise);
    points.push({
      workoutId: workout.id,
      date: workout.date,
      bestLoadKg: Math.round(bestLoadKg * 10) / 10,
      bestEstimated1RmKg: Math.round(bestEstimated1RmKg * 10) / 10,
      loadVolumeKgReps: Math.round(loadVolumeKgReps),
      averageRir: validRir.length
        ? Math.round(
            (validRir.reduce((sum, value) => sum + value, 0) /
              validRir.length) *
              10,
          ) / 10
        : null,
    });
  }

  return points.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export function analyzeExerciseStrength(
  history: CompletedWorkout[],
  exerciseId: string,
): ExerciseStrengthAnalysis | null {
  const points = exerciseStrengthPoints(history, exerciseId);
  if (!points.length) return null;

  const latest = points[points.length - 1];
  const previous = points.slice(0, -1);
  const previousBestLoad = previous.length
    ? Math.max(...previous.map((point) => point.bestLoadKg))
    : 0;
  const previousBestE1rm = previous.length
    ? Math.max(...previous.map((point) => point.bestEstimated1RmKg))
    : 0;

  const recent = points.slice(-4);
  const firstRecent = recent[0]?.bestEstimated1RmKg ?? 0;
  const lastRecent = recent[recent.length - 1]?.bestEstimated1RmKg ?? 0;
  const trendPercent =
    firstRecent > 0
      ? Math.round(((lastRecent - firstRecent) / firstRecent) * 1000) / 10
      : 0;
  const trend =
    trendPercent > 2 ? "up" : trendPercent < -2 ? "down" : "flat";

  const recentMean =
    recent.reduce((sum, point) => sum + point.bestEstimated1RmKg, 0) /
    Math.max(1, recent.length);
  const recentSpreadPercent =
    recentMean > 0
      ? ((Math.max(...recent.map((point) => point.bestEstimated1RmKg)) -
          Math.min(...recent.map((point) => point.bestEstimated1RmKg))) /
          recentMean) *
        100
      : 0;

  const latestEstimated1RmIsPr =
    previous.length === 0 ||
    latest.bestEstimated1RmKg > previousBestE1rm + 0.05;
  const latestLoadIsPr =
    previous.length === 0 || latest.bestLoadKg > previousBestLoad + 0.05;
  const plateau =
    recent.length >= 4 &&
    !latestEstimated1RmIsPr &&
    Math.abs(trendPercent) <= 1.5 &&
    recentSpreadPercent <= 3;

  const allRir = points
    .map((point) => point.averageRir)
    .filter((value): value is number => value !== null);

  return {
    exerciseId,
    points,
    sessions: points.length,
    lastLoadKg: latest.bestLoadKg,
    bestLoadKg: Math.max(...points.map((point) => point.bestLoadKg)),
    latestEstimated1RmKg: latest.bestEstimated1RmKg,
    bestEstimated1RmKg: Math.max(
      ...points.map((point) => point.bestEstimated1RmKg),
    ),
    latestLoadVolumeKgReps: latest.loadVolumeKgReps,
    totalLoadVolumeKgReps: points.reduce(
      (sum, point) => sum + point.loadVolumeKgReps,
      0,
    ),
    averageRir: allRir.length
      ? Math.round(
          (allRir.reduce((sum, value) => sum + value, 0) / allRir.length) *
            10,
        ) / 10
      : null,
    trendPercent,
    trend,
    plateau,
    latestLoadIsPr,
    latestEstimated1RmIsPr,
  };
}

export function exerciseStrengthAnalyses(
  history: CompletedWorkout[],
): ExerciseStrengthAnalysis[] {
  const ids = new Set<string>();
  for (const workout of history) {
    for (const exercise of workout.exercises) {
      if (
        exercise.completed &&
        (exercise.setLoadsKg ?? []).some((load) => load > 0)
      ) {
        ids.add(exercise.id);
      }
    }
  }

  return Array.from(ids)
    .map((exerciseId) => analyzeExerciseStrength(history, exerciseId))
    .filter(
      (analysis): analysis is ExerciseStrengthAnalysis =>
        analysis !== null,
    )
    .sort(
      (a, b) =>
        b.sessions - a.sessions ||
        b.bestEstimated1RmKg - a.bestEstimated1RmKg,
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
      if (!exercise.completed) continue;
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
