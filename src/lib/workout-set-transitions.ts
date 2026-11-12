/**
 * Pure session progression rule shared by the workout player and its tests.
 * Every prescribed set must be recorded, including when restSeconds = 0.
 */
export type WorkSetTransition = "rest" | "next-set" | "next-exercise" | "done";

export function resolveWorkSetTransition(
  currentSet: number,
  totalSets: number,
  restSeconds: number,
  hasNextExercise: boolean,
): WorkSetTransition {
  if (!Number.isInteger(currentSet) || !Number.isInteger(totalSets) ||
      currentSet < 1 || totalSets < 1 || currentSet > totalSets ||
      !Number.isFinite(restSeconds) || restSeconds < 0) {
    throw new Error("Invalid workout set transition state");
  }
  if (currentSet < totalSets) return restSeconds > 0 ? "rest" : "next-set";
  return hasNextExercise ? "next-exercise" : "done";
}
