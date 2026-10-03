import {
  DEFAULT_PROFILE,
  loadHistory,
  loadProfile,
  loadTodayReadiness,
  readinessDateKey,
  recordWorkout,
  saveDailyReadiness,
  saveProfile,
} from "../src/lib/user-profile";
import {
  generateWeeklyPlan,
  isSafeFor,
} from "../src/lib/workout-engine";
import type { Equipment } from "../src/lib/exercise-db";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, String(value));
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  get length() {
    return this.values.size;
  }
}

Object.defineProperty(globalThis, "window", {
  value: {},
  configurable: true,
});
Object.defineProperty(globalThis, "localStorage", {
  value: new MemoryStorage(),
  configurable: true,
});

const equipment: Equipment[] = [
  "none",
  "mat",
  "dumbbells",
  "barbell",
  "kettlebell",
  "resistance-band",
  "pullup-bar",
  "bench",
  "machine",
  "cable",
  "cardio-machine",
  "weight-plate",
  "wall",
  "chair",
  "doorway",
  "towel",
  "box",
  "stability-ball",
];

saveProfile({
  ...DEFAULT_PROFILE,
  name: "Smoke User",
  level: "intermediate",
  goals: ["muscle-gain"],
  equipment,
  injuries: ["knee"],
  daysPerWeek: 3,
  sessionMinutes: 45,
});

const profile = loadProfile();
if (profile.name !== "Smoke User" || !profile.injuries.includes("knee")) {
  throw new Error("profile persistence failed");
}

const today = readinessDateKey();
saveDailyReadiness({
  dateKey: today,
  sleepQuality: 4,
  fatigue: 2,
  muscleSoreness: 2,
  energy: 4,
});
const readiness = loadTodayReadiness();
if (!readiness || readiness.dateKey !== today) {
  throw new Error("daily readiness persistence failed");
}

const plan = generateWeeklyPlan(profile, [], readiness);
if (plan.length !== 3) {
  throw new Error("expected a 3-day generated plan");
}
for (const workout of plan) {
  const unsafe = workout.exercises.filter(
    (item) => !isSafeFor(item.exercise, profile.injuries),
  );
  if (unsafe.length) {
    throw new Error(
      "unsafe exercise leaked into persisted-user plan: " +
        unsafe.map((item) => item.exercise.id).join(","),
    );
  }
}

const first = plan[0];
recordWorkout({
  id: "smoke-workout",
  date: new Date().toISOString(),
  exercises: first.exercises.map((item) => ({
    id: item.exercise.id,
    sets: item.sets,
    reps: item.reps,
    completed: true,
    progressionAction: item.progressionAction,
  })),
  durationSec: Math.max(60, first.estimatedMinutes * 60),
  activeSec: Math.max(60, first.estimatedMinutes * 45),
  calories: first.estimatedCalories,
  intensity: first.intensity,
  performance: 100,
  adaptationMode: first.adaptation.mode,
  readinessScore: first.adaptation.readinessScore,
  periodizationPhase: first.periodization.phase,
  periodizationCycleWeek: first.periodization.cycleWeek,
});

const history = loadHistory();
if (history.length !== 1 || history[0].id !== "smoke-workout") {
  throw new Error("workout history persistence failed");
}

const nextPlan = generateWeeklyPlan(loadProfile(), history, loadTodayReadiness());
if (
  nextPlan.some((workout) =>
    workout.exercises.some(
      (item) => !isSafeFor(item.exercise, profile.injuries),
    ),
  )
) {
  throw new Error("injury filter was lost after recording workout history");
}

console.log(
  "User journey smoke PASS: profile -> injury filter -> readiness -> plan -> completed workout -> regenerated plan.",
);
