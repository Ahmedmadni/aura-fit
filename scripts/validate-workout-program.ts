import {
  generateWeeklyPlan,
  getWeeklyMuscleCoverage,
  getWeeklyVolumeStatus,
  MAJOR_MUSCLES,
} from "../src/lib/workout-engine";
import { type Equipment, type Goal } from "../src/lib/exercise-db";
import {
  DEFAULT_PROFILE,
  type UserProfile,
} from "../src/lib/user-profile";

const FULL_EQUIPMENT: Equipment[] = [
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

const failures: string[] = [];
const fail = (message: string) => failures.push(message);

for (const daysPerWeek of [2, 3, 4, 5, 6]) {
  const goals: Goal[] = daysPerWeek >= 5 ? ["muscle-gain"] : ["general-fitness"];
  const profile: UserProfile = {
    ...DEFAULT_PROFILE,
    level: "intermediate",
    goals,
    equipment: FULL_EQUIPMENT,
    daysPerWeek,
    sessionMinutes: 45,
  };

  const plan = generateWeeklyPlan(profile);
  if (plan.length !== daysPerWeek) {
    fail(`${daysPerWeek}d: expected ${daysPerWeek} workouts, got ${plan.length}`);
  }

  plan.forEach((workout, index) => {
    const ids = workout.exercises.map((item) => item.exercise.id);
    if (new Set(ids).size !== ids.length) {
      fail(`${daysPerWeek}d day ${index + 1}: duplicate exercise inside session`);
    }
    if (!workout.exercises.some((item) => item.phase === "warmup")) {
      fail(`${daysPerWeek}d day ${index + 1}: no warm-up`);
    }
    if (!workout.exercises.some((item) => item.phase === "main")) {
      fail(`${daysPerWeek}d day ${index + 1}: no main exercise`);
    }
    if (!workout.exercises.some((item) => item.phase === "cooldown")) {
      fail(`${daysPerWeek}d day ${index + 1}: no cooldown`);
    }

    const phases = workout.exercises.map((item) => item.phase);
    const firstMain = phases.indexOf("main");
    const lastWarmup = phases.lastIndexOf("warmup");
    const firstCooldown = phases.indexOf("cooldown");
    if (firstMain !== -1 && lastWarmup > firstMain) {
      fail(`${daysPerWeek}d day ${index + 1}: warm-up appears after main work`);
    }
    if (
      firstCooldown !== -1 &&
      phases.slice(firstCooldown + 1).some((phase) => phase !== "cooldown")
    ) {
      fail(`${daysPerWeek}d day ${index + 1}: work appears after cooldown starts`);
    }
  });

  const volume = getWeeklyVolumeStatus(plan, profile);
  for (const item of volume) {
    if (item.status === "low") {
      fail(
        `${daysPerWeek}d: ${item.muscle} effective volume ${item.effectiveSets} is below minimum ${item.min}`,
      );
    }
    if (item.status === "high") {
      fail(
        `${daysPerWeek}d: ${item.muscle} effective volume ${item.effectiveSets} exceeds maximum ${item.max}`,
      );
    }
  }

  const coverage = getWeeklyMuscleCoverage(plan);
  for (const muscle of MAJOR_MUSCLES) {
    const item = coverage.find((entry) => entry.muscle === muscle);
    if (!item || item.days < 2) {
      fail(`${daysPerWeek}d: ${muscle} covered on only ${item?.days ?? 0} day(s)`);
    }
  }

  console.log(
    `${daysPerWeek} days: ` +
      coverage
        .filter((item) => MAJOR_MUSCLES.includes(item.muscle))
        .map((item) => `${item.muscle}=${item.days}x`)
        .join(", ") +
      " | volume " +
      volume.map((item) => `${item.muscle}=${item.effectiveSets}/${item.min}-${item.max}`).join(", "),
  );
}

if (failures.length) {
  console.error("\nWorkout programming quality gate FAILED:\n");
  failures.forEach((message) => console.error("- " + message));
  process.exit(1);
}

console.log("\nWorkout programming quality gate PASS.");
