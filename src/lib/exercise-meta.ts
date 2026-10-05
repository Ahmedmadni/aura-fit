/**
 * Lightweight exercise metadata safe to load in the app shell.
 *
 * Keep heavyweight exercise construction, media manifests and workout-guide
 * frames inside exercise-db/workout-engine so the dashboard can paint before
 * those modules are requested.
 */
export const EXERCISE_COUNT = 302;

export const MUSCLE_LABEL_AR = {
  chest: "الصدر",
  back: "الظهر",
  shoulders: "الأكتاف",
  biceps: "البايسبس",
  triceps: "الترايسبس",
  forearms: "الساعد",
  quads: "الفخذ الأمامي",
  hamstrings: "أوتار الركبة",
  glutes: "المؤخرة",
  calves: "السمانة",
  adductors: "العضلات الضامة",
  hips: "الحوض",
  "lower-back": "أسفل الظهر",
  core: "الجذع",
  "full-body": "كامل الجسم",
} as const;

export type ExerciseMuscleKey = keyof typeof MUSCLE_LABEL_AR;
