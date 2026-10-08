export const WORKOUT_SESSION_META_EVENT = "aura:workout-session-meta";
export const WORKOUT_SESSION_MAX_AGE_MS = 18 * 60 * 60 * 1000;
export const WORKOUT_SESSION_DRAFT_KEY = "aura.workout-session.v1";

const WORKOUT_SESSION_META_KEY = "aura.workout-session-meta.v1";
const WORKOUT_SESSION_META_VERSION = 1 as const;

export interface WorkoutSessionMetaV1 {
  version: typeof WORKOUT_SESSION_META_VERSION;
  workoutId: string;
  day: number | null;
  safetySignature?: string;
  savedAt: string;
  index: number;
  setIdx: number;
  total: number;
  currentExerciseName: string;
}

export type WorkoutSessionMetaState = Omit<
  WorkoutSessionMetaV1,
  "version" | "savedAt"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, max: number): number | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    return null;
  }
  return value;
}

export function parseWorkoutSessionMeta(
  value: unknown,
  nowMs = Date.now(),
): WorkoutSessionMetaV1 | null {
  if (!isRecord(value) || value.version !== WORKOUT_SESSION_META_VERSION) {
    return null;
  }
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

  const safetySignature =
    value.safetySignature === undefined
      ? undefined
      : typeof value.safetySignature === "string" &&
          value.safetySignature.length > 0 &&
          value.safetySignature.length <= 500
        ? value.safetySignature
        : null;
  if (safetySignature === null) return null;

  if (typeof value.savedAt !== "string") return null;
  const savedAtMs = Date.parse(value.savedAt);
  if (!Number.isFinite(savedAtMs)) return null;
  const age = nowMs - savedAtMs;
  if (age < -5 * 60 * 1000 || age > WORKOUT_SESSION_MAX_AGE_MS) return null;

  const total = integer(value.total, 1, 40);
  if (total === null) return null;
  const index = integer(value.index, 0, total - 1);
  const setIdx = integer(value.setIdx, 1, 20);
  if (index === null || setIdx === null) return null;

  if (
    typeof value.currentExerciseName !== "string" ||
    !value.currentExerciseName ||
    value.currentExerciseName.length > 200
  ) {
    return null;
  }

  return {
    version: WORKOUT_SESSION_META_VERSION,
    workoutId: value.workoutId,
    day,
    safetySignature,
    savedAt: value.savedAt,
    index,
    setIdx,
    total,
    currentExerciseName: value.currentExerciseName,
  };
}

function emit(meta: WorkoutSessionMetaV1 | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<WorkoutSessionMetaV1 | null>(WORKOUT_SESSION_META_EVENT, {
      detail: meta,
    }),
  );
}

export function loadWorkoutSessionMeta(): WorkoutSessionMetaV1 | null {
  if (typeof window === "undefined") return null;

  const raw = localStorage.getItem(WORKOUT_SESSION_META_KEY);
  if (!raw) return null;

  if (!localStorage.getItem(WORKOUT_SESSION_DRAFT_KEY)) {
    localStorage.removeItem(WORKOUT_SESSION_META_KEY);
    emit(null);
    return null;
  }

  try {
    const meta = parseWorkoutSessionMeta(JSON.parse(raw));
    if (!meta) {
      localStorage.removeItem(WORKOUT_SESSION_META_KEY);
      emit(null);
      return null;
    }
    return meta;
  } catch {
    localStorage.removeItem(WORKOUT_SESSION_META_KEY);
    emit(null);
    return null;
  }
}

export function saveWorkoutSessionMeta(
  state: WorkoutSessionMetaState,
  savedAt = new Date().toISOString(),
) {
  if (typeof window === "undefined") return;

  const meta: WorkoutSessionMetaV1 = {
    ...state,
    version: WORKOUT_SESSION_META_VERSION,
    savedAt,
  };
  localStorage.setItem(WORKOUT_SESSION_META_KEY, JSON.stringify(meta));
  emit(meta);
}

export function clearWorkoutSessionMeta() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WORKOUT_SESSION_META_KEY);
  emit(null);
}
