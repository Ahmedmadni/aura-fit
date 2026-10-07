import { getExercise } from "./exercise-db";
import type { PlannedExercise } from "./workout-engine";
import {
  WORKOUT_SESSION_DRAFT_KEY,
  WORKOUT_SESSION_MAX_AGE_MS,
  clearWorkoutSessionMeta,
  saveWorkoutSessionMeta,
} from "./workout-session-meta";

export { WORKOUT_SESSION_MAX_AGE_MS } from "./workout-session-meta";

const WORKOUT_SESSION_VERSION = 1 as const;

export type RecoverableWorkoutPhase = "work" | "rest";

export interface WorkoutSessionDraftV1 {
  version: typeof WORKOUT_SESSION_VERSION;
  workoutId: string;
  day: number | null;
  savedAt: string;
  plan: PlannedExercise[];
  index: number;
  setIdx: number;
  phase: RecoverableWorkoutPhase;
  remaining: number;
  completed: string[];
  skipped: string[];
  setReps: Record<string, number[]>;
  setLoadsKg: Record<string, number[]>;
  setRir: Record<string, number[]>;
  currentReps: number;
  currentLoadKg: number;
  currentRir: number | null;
  elapsed: number;
  muted: boolean;
}

export type WorkoutSessionDraftState = Omit<
  WorkoutSessionDraftV1,
  "version" | "savedAt"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(
  value: unknown,
  min: number,
  max: number,
): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function integer(
  value: unknown,
  min: number,
  max: number,
): number | null {
  const parsed = finiteNumber(value, min, max);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function optionalNumber(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  const parsed = finiteNumber(value, min, max);
  return parsed ?? undefined;
}

function stringArray(value: unknown, maxItems = 100): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item || item.length > 160) return null;
    result.push(item);
  }
  return result;
}

function numericRecord(
  value: unknown,
  min: number,
  max: number,
): Record<string, number[]> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, number[]> = {};
  const entries = Object.entries(value);
  if (entries.length > 100) return null;

  for (const [key, rawValues] of entries) {
    if (!key || key.length > 160 || !Array.isArray(rawValues)) return null;
    if (rawValues.length > 20) return null;

    const values: number[] = [];
    for (const raw of rawValues) {
      const parsed = finiteNumber(raw, min, max);
      if (parsed === null) return null;
      values.push(parsed);
    }
    result[key] = values;
  }

  return result;
}

function plannedExercise(value: unknown): PlannedExercise | null {
  if (!isRecord(value) || !isRecord(value.exercise)) return null;

  const exerciseId = value.exercise.id;
  if (typeof exerciseId !== "string") return null;
  const exercise = getExercise(exerciseId);
  if (!exercise) return null;

  const phase = value.phase;
  if (
    phase !== "warmup" &&
    phase !== "main" &&
    phase !== "accessory" &&
    phase !== "core" &&
    phase !== "cardio" &&
    phase !== "cooldown"
  ) {
    return null;
  }

  const sets = integer(value.sets, 1, 20);
  const restSeconds = integer(value.restSeconds, 0, 3600);
  const workSeconds = integer(value.workSeconds, 1, 3600);
  if (sets === null || restSeconds === null || workSeconds === null) return null;

  if (typeof value.reps !== "string" || value.reps.length > 120) return null;
  if (
    value.progressionAction !== "build-reps" &&
    value.progressionAction !== "increase-load" &&
    value.progressionAction !== "hold" &&
    value.progressionAction !== "reduce"
  ) {
    return null;
  }
  if (
    typeof value.progressionNote !== "string" ||
    value.progressionNote.length > 2500 ||
    typeof value.trackLoad !== "boolean" ||
    typeof value.targetRir !== "string" ||
    value.targetRir.length > 40
  ) {
    return null;
  }

  const rotatedFromId =
    value.rotatedFromId === undefined
      ? undefined
      : typeof value.rotatedFromId === "string"
        ? value.rotatedFromId
        : null;
  if (rotatedFromId === null) return null;

  const rotationReason =
    value.rotationReason === undefined ||
    value.rotationReason === "mesocycle" ||
    value.rotationReason === "plateau" ||
    value.rotationReason === "manual"
      ? value.rotationReason
      : null;
  if (rotationReason === null) return null;

  return {
    exercise,
    phase,
    sets,
    reps: value.reps,
    restSeconds,
    workSeconds,
    progressionAction: value.progressionAction,
    progressionNote: value.progressionNote,
    trackLoad: value.trackLoad,
    lastLoadKg: optionalNumber(value.lastLoadKg, 0, 5000),
    suggestedLoadKg: optionalNumber(value.suggestedLoadKg, 0, 5000),
    loadStepKg: optionalNumber(value.loadStepKg, 0, 500),
    targetRir: value.targetRir,
    rotatedFromId,
    rotationReason,
  };
}

export function parseWorkoutSessionDraft(
  value: unknown,
  nowMs = Date.now(),
): WorkoutSessionDraftV1 | null {
  if (!isRecord(value) || value.version !== WORKOUT_SESSION_VERSION) return null;
  if (
    typeof value.workoutId !== "string" ||
    !value.workoutId ||
    value.workoutId.length > 200
  ) {
    return null;
  }

  const day =
    value.day === null
      ? null
      : integer(value.day, 0, 6);
  if (value.day !== null && day === null) return null;

  if (typeof value.savedAt !== "string") return null;
  const savedAtMs = Date.parse(value.savedAt);
  if (!Number.isFinite(savedAtMs)) return null;
  const age = nowMs - savedAtMs;
  if (age < -5 * 60 * 1000 || age > WORKOUT_SESSION_MAX_AGE_MS) return null;

  if (!Array.isArray(value.plan) || !value.plan.length || value.plan.length > 40) {
    return null;
  }
  const plan: PlannedExercise[] = [];
  for (const raw of value.plan) {
    const parsed = plannedExercise(raw);
    if (!parsed) return null;
    plan.push(parsed);
  }

  const index = integer(value.index, 0, plan.length - 1);
  const setIdx = integer(value.setIdx, 1, plan[index ?? 0]?.sets ?? 1);
  const remaining = integer(value.remaining, 0, 3600);
  const elapsed = integer(value.elapsed, 0, 24 * 60 * 60);
  const currentReps = integer(value.currentReps, 0, 2000);
  const currentLoadKg = finiteNumber(value.currentLoadKg, 0, 5000);
  const currentRir =
    value.currentRir === null
      ? null
      : finiteNumber(value.currentRir, 0, 5);

  if (
    index === null ||
    setIdx === null ||
    remaining === null ||
    elapsed === null ||
    currentReps === null ||
    currentLoadKg === null ||
    currentRir === null && value.currentRir !== null
  ) {
    return null;
  }

  if (value.phase !== "work" && value.phase !== "rest") return null;
  if (typeof value.muted !== "boolean") return null;

  const completed = stringArray(value.completed);
  const skipped = stringArray(value.skipped);
  const setReps = numericRecord(value.setReps, 0, 2000);
  const setLoadsKg = numericRecord(value.setLoadsKg, 0, 5000);
  const setRir = numericRecord(value.setRir, 0, 5);
  if (!completed || !skipped || !setReps || !setLoadsKg || !setRir) return null;

  const planIds = new Set(plan.map((item) => item.exercise.id));
  if (
    completed.some((id) => !planIds.has(id)) ||
    skipped.some((id) => !planIds.has(id))
  ) {
    return null;
  }

  return {
    version: WORKOUT_SESSION_VERSION,
    workoutId: value.workoutId,
    day,
    savedAt: value.savedAt,
    plan,
    index,
    setIdx,
    phase: value.phase,
    remaining,
    completed,
    skipped,
    setReps,
    setLoadsKg,
    setRir,
    currentReps,
    currentLoadKg,
    currentRir,
    elapsed,
    muted: value.muted,
  };
}

export function loadRecoverableWorkoutSessionDraft(): WorkoutSessionDraftV1 | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(WORKOUT_SESSION_DRAFT_KEY);
  if (!raw) return null;

  try {
    const draft = parseWorkoutSessionDraft(JSON.parse(raw));
    if (!draft) {
      clearWorkoutSessionDraft();
      return null;
    }
    return draft;
  } catch {
    clearWorkoutSessionDraft();
    return null;
  }
}

export function loadWorkoutSessionDraft(match: {
  workoutId: string;
  day: number | null;
}): WorkoutSessionDraftV1 | null {
  const draft = loadRecoverableWorkoutSessionDraft();
  if (!draft) return null;
  if (draft.workoutId !== match.workoutId || draft.day !== match.day) {
    return null;
  }
  return draft;
}

export function saveWorkoutSessionDraft(state: WorkoutSessionDraftState) {
  if (typeof window === "undefined") return;

  const savedAt = new Date().toISOString();
  const draft: WorkoutSessionDraftV1 = {
    ...state,
    version: WORKOUT_SESSION_VERSION,
    savedAt,
  };
  localStorage.setItem(WORKOUT_SESSION_DRAFT_KEY, JSON.stringify(draft));

  const current = state.plan[state.index];
  if (current) {
    saveWorkoutSessionMeta(
      {
        workoutId: state.workoutId,
        day: state.day,
        index: state.index,
        setIdx: state.setIdx,
        total: state.plan.length,
        currentExerciseName: current.exercise.name,
      },
      savedAt,
    );
  }
}

export function clearWorkoutSessionDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WORKOUT_SESSION_DRAFT_KEY);
  clearWorkoutSessionMeta();
}
