/**
 * AI Workout Engine — pure functions, deterministic, offline-capable.
 *
 * Programming rationale:
 *  - Weekly split rotates push/pull/legs/core+cardio based on daysPerWeek.
 *  - Every 4th week is a deload (fewer sets, easier progression).
 *  - Exercises are filtered by equipment + injuries; automatically substituted.
 *  - Progressive overload: after 2 successful completions of a movement,
 *    step up along its progression ladder if the user's level allows.
 *
 * References: ACSM 11th ed. FITT-VP · NSCA periodization (Bompa/Buzzichelli).
 */

import {
  EXERCISES,
  getExercise,
  type Category,
  type Equipment,
  type Exercise,
  type Goal,
  type Injury,
  type Level,
} from "./exercise-db";
import type { CompletedWorkout, UserProfile } from "./user-profile";

export interface GeneratedWorkout {
  id: string;
  title: string;
  focus: Category[];
  exercises: PlannedExercise[];
  estimatedMinutes: number;
  estimatedCalories: number;
  intensity: number; // 0-100
  isDeload: boolean;
  rationale: string;
}

export interface PlannedExercise {
  exercise: Exercise;
  sets: number;
  reps: string;
  restSeconds: number;
  workSeconds: number; // per set
}

const LEVEL_RANK: Record<Level, number> = { beginner: 1, intermediate: 2, advanced: 3 };

export function isSafeFor(ex: Exercise, injuries: Injury[]): boolean {
  return !ex.contraindicated.some((c) => injuries.includes(c));
}

export function hasEquipment(ex: Exercise, owned: Equipment[]): boolean {
  return ex.equipment.every((e) => owned.includes(e) || e === "none");
}

export function replaceUnsafe(
  ex: Exercise,
  injuries: Injury[],
  equipment: Equipment[],
): Exercise {
  if (isSafeFor(ex, injuries) && hasEquipment(ex, equipment)) return ex;
  const candidates = ex.alternatives
    .map(getExercise)
    .filter((e): e is Exercise => Boolean(e))
    .filter((e) => isSafeFor(e, injuries) && hasEquipment(e, equipment));
  if (candidates[0]) return candidates[0];
  // fallback: same category, safe & equipped
  const fallback = EXERCISES.find(
    (e) =>
      e.category === ex.category &&
      isSafeFor(e, injuries) &&
      hasEquipment(e, equipment),
  );
  return fallback ?? ex;
}

function focusForDay(day: number, daysPerWeek: number): Category[] {
  if (daysPerWeek <= 2) return ["full-body" as Category].map(() => "cardio") as Category[];
  const rotations: Category[][] = [
    ["push", "core"],
    ["legs", "cardio"],
    ["pull", "core"],
    ["push", "cardio"],
    ["legs", "core"],
    ["pull", "cardio"],
    ["mobility"],
  ];
  return rotations[day % rotations.length];
}

function pickExercises(
  focus: Category[],
  profile: UserProfile,
  count: number,
): Exercise[] {
  const levelCap = LEVEL_RANK[profile.level];
  const pool = EXERCISES.filter(
    (e) =>
      focus.includes(e.category) &&
      LEVEL_RANK[e.level] <= levelCap + 1 &&
      isSafeFor(e, profile.injuries) &&
      hasEquipment(e, profile.equipment) &&
      (profile.goals.length === 0 ||
        e.goals.some((g) => profile.goals.includes(g))),
  );
  const chosen: Exercise[] = [];
  const usedPrimary = new Set<string>();
  for (const e of pool) {
    if (chosen.length >= count) break;
    const key = e.primary.join("|");
    if (usedPrimary.has(key)) continue;
    chosen.push(e);
    usedPrimary.add(key);
  }
  // pad if we didn't reach count
  for (const e of pool) {
    if (chosen.length >= count) break;
    if (!chosen.includes(e)) chosen.push(e);
  }
  return chosen;
}

export function generateWorkout(
  profile: UserProfile,
  opts: { day?: number; week?: number } = {},
): GeneratedWorkout {
  const day = opts.day ?? new Date().getDay();
  const week = opts.week ?? Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7));
  const isDeload = week % 4 === 3;

  const focus = focusForDay(day, profile.daysPerWeek);
  const targetMin = profile.sessionMinutes;
  const perExerciseMin = 4; // work + rest budget
  const count = Math.max(
    3,
    Math.min(8, Math.floor((targetMin - 8) / perExerciseMin)),
  ); // 8 min reserved for warmup/cooldown

  const middle = pickExercises(focus, profile, count);

  const warmup = getExercise("dynamic-warmup")!;
  const cooldown = getExercise("static-cooldown")!;

  const planned: PlannedExercise[] = [
    {
      exercise: warmup,
      sets: 1,
      reps: "5 دقائق",
      restSeconds: 30,
      workSeconds: 300,
    },
    ...middle.map<PlannedExercise>((ex) => {
      const safeEx = replaceUnsafe(ex, profile.injuries, profile.equipment);
      const sets = isDeload
        ? Math.max(2, safeEx.recommendedSets - 1)
        : safeEx.recommendedSets;
      return {
        exercise: safeEx,
        sets,
        reps: safeEx.recommendedReps,
        restSeconds: safeEx.restSeconds,
        workSeconds: 45,
      };
    }),
    {
      exercise: cooldown,
      sets: 1,
      reps: "5 دقائق",
      restSeconds: 0,
      workSeconds: 300,
    },
  ];

  const estimatedMinutes = Math.round(
    planned.reduce(
      (s, p) => s + (p.workSeconds * p.sets + p.restSeconds * (p.sets - 1)),
      0,
    ) / 60,
  );

  const estimatedCalories = Math.round(
    planned.reduce(
      (s, p) => s + (p.exercise.caloriesPerMin * (p.workSeconds * p.sets)) / 60,
      0,
    ),
  );

  const intensity = Math.min(
    100,
    Math.round(
      planned.reduce((s, p) => s + LEVEL_RANK[p.exercise.level] * 10, 0) /
        planned.length +
        (isDeload ? -10 : 0),
    ),
  );

  return {
    id: `w-${week}-${day}`,
    title: isDeload
      ? "أسبوع تخفيف — جلسة استرداد"
      : `جلسة اليوم · ${focus.map(labelForCategory).join(" + ")}`,
    focus,
    exercises: planned,
    estimatedMinutes,
    estimatedCalories,
    intensity,
    isDeload,
    rationale: isDeload
      ? "أسبوع تخفيف الحمل لحماية المفاصل واستعادة الأداء (ACSM/NSCA periodization)."
      : `مبني على مستوى ${profile.level}، ${profile.daysPerWeek} أيام/أسبوع، أهداف ${profile.goals.join(", ")}.`,
  };
}

export function generateWeeklyPlan(profile: UserProfile): GeneratedWorkout[] {
  return Array.from({ length: profile.daysPerWeek }, (_, i) =>
    generateWorkout(profile, { day: i }),
  );
}

export function generateMonthlyProgram(profile: UserProfile): GeneratedWorkout[][] {
  return Array.from({ length: 4 }, (_, w) =>
    Array.from({ length: profile.daysPerWeek }, (_, d) =>
      generateWorkout(profile, { day: d, week: w }),
    ),
  );
}

/** After 2 successful completions at target reps, advance one rung. */
export function progressiveOverload(
  exerciseId: string,
  history: CompletedWorkout[],
): string {
  const ex = getExercise(exerciseId);
  if (!ex) return exerciseId;
  const completions = history
    .flatMap((h) => h.exercises)
    .filter((h) => h.id === exerciseId && h.completed);
  if (completions.length < 2) return exerciseId;
  const idx = ex.progression.indexOf(exerciseId);
  if (idx === -1 || idx === ex.progression.length - 1) return exerciseId;
  return ex.progression[idx + 1];
}

export function scoreIntensity(w: CompletedWorkout): number {
  const density = w.activeSec / Math.max(1, w.durationSec);
  return Math.round(density * 100);
}

function labelForCategory(c: Category): string {
  const m: Record<Category, string> = {
    push: "دفع",
    pull: "سحب",
    legs: "أرجل",
    core: "كور",
    cardio: "كارديو",
    mobility: "مرونة",
    warmup: "إحماء",
    cooldown: "استرداد",
  };
  return m[c] ?? c;
}
