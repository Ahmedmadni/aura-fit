/**
 * Exhaustive catalog and local workout execution contracts.
 * Checks all exercises without requesting external GIF/images or any API.
 * This does not claim biomechanical correctness of third-party illustrations.
 */
import {
  EXERCISES, getExercise,
  type Equipment, type Goal, type Injury, type Level,
} from "../src/lib/exercise-db";
import {
  generateWorkout, getExerciseProgressionPrescription, hasEquipment, isSafeFor,
} from "../src/lib/workout-engine";
import { createCustomWorkout, type CustomPlan } from "../src/lib/custom-plans";
import { DEFAULT_PROFILE, type UserProfile } from "../src/lib/user-profile";
import { resolveWorkSetTransition } from "../src/lib/workout-set-transitions";
import { validateOnboardingMeasurements } from "../src/lib/onboarding-validation";

const failures: string[] = [];
const check = (condition: unknown, explanation: string) => {
  if (!condition) failures.push(explanation);
};
const equipment: Equipment[] = [
  "none", "mat", "dumbbells", "barbell", "kettlebell",
  "resistance-band", "pullup-bar", "bench", "machine",
  "cable", "cardio-machine", "weight-plate", "wall", "chair",
  "doorway", "towel", "box", "stability-ball",
];
const profile: UserProfile = {
  ...DEFAULT_PROFILE, equipment, level: "intermediate", sessionMinutes: 45,
};
const base = generateWorkout(profile, { history: [] });
const ids = new Set<string>();
for (const exercise of EXERCISES) {
  const tag = exercise.id;
  check(Boolean(tag) && /^[a-z0-9-]+$/.test(tag), tag + ": invalid route slug");
  check(!ids.has(tag), tag + ": duplicate exercise ID");
  ids.add(tag);
  check(getExercise(tag) === exercise, tag + ": detail route does not resolve catalog entry");
  check(Boolean(exercise.name?.trim()) && Boolean(exercise.latin?.trim()), tag + ": missing name");
  check(Boolean(exercise.cue?.trim()), tag + ": missing cue");
  check(Array.isArray(exercise.instructionsAr) && exercise.instructionsAr.length >= 2,
    tag + ": no meaningful instructions");
  check(Array.isArray(exercise.safety) && exercise.safety.length > 0,
    tag + ": missing safety information");
  check(Array.isArray(exercise.primary) && exercise.primary.length > 0,
    tag + ": missing primary muscle");
  check(exercise.equipment.length > 0, tag + ": equipment filter cannot run");
  check(Number.isFinite(exercise.recommendedSets) &&
    Number.isInteger(exercise.recommendedSets) &&
    exercise.recommendedSets >= 1 && exercise.recommendedSets <= 8,
    tag + ": invalid recommended sets");
  check(Boolean(exercise.recommendedReps?.trim()) &&
    exercise.recommendedReps.length <= 80,
    tag + ": invalid recommended reps");
  check(Number.isFinite(exercise.restSeconds) && exercise.restSeconds >= 0 &&
    exercise.restSeconds <= 300, tag + ": invalid rest seconds");
  check(exercise.media.frames?.length === 3 &&
    exercise.media.frames.every((url) => typeof url === "string" &&
      url.startsWith("https://")),
    tag + ": offline fallback frames missing expected URLs");
  check(exercise.media.preferred !== "gif" || Boolean(exercise.media.gif),
    tag + ": preferred GIF has no source");
  check(hasEquipment(exercise, equipment), tag + ": full equipment profile rejected");
  check(isSafeFor(exercise, []), tag + ": incorrectly rejected without injuries");

  try {
    const prescription = getExerciseProgressionPrescription(
      tag, exercise.recommendedReps, [], base.adaptation.mode,
    );
    check(Boolean(prescription.reps) && Boolean(prescription.note) &&
      Boolean(prescription.action), tag + ": progression output invalid");

    const selected: CustomPlan = {
      id: "plan-catalog-check", title: "catalog " + tag,
      createdAt: "2026-11-12T08:00:00Z",
      updatedAt: "2026-11-12T08:00:00Z",
      slots: [{ id: tag, sets: 3, reps: exercise.recommendedReps,
        rest: Math.min(300, exercise.restSeconds) }],
    };
    const workout = createCustomWorkout(selected, profile, [], base);
    const item = workout.exercises[0];
    check(workout.exercises.length === 1 && item.exercise.id === tag &&
      item.sets === 3 && item.workSeconds > 0 &&
      Number.isFinite(workout.estimatedCalories) &&
      Number.isFinite(workout.estimatedMinutes),
      tag + ": plan does not execute correct exercise with finite timing");
    check(resolveWorkSetTransition(1, item.sets, 0, false) === "next-set",
      tag + ": zero-rest plan skipped remaining sets");
  } catch (error) {
    failures.push(tag + ": runtime exception: " + String(error));
  }

  for (const alt of exercise.alternatives) {
    check(Boolean(getExercise(alt)) && alt !== tag,
      tag + ": alternative cannot navigate: " + alt);
  }
}

const goals: Goal[] = [
  "fat-loss","muscle-gain","strength","endurance","mobility","general-fitness",
];
const levels: Level[] = ["beginner","intermediate","advanced"];
const sets: Equipment[][] = [
  ["none","mat"], ["none","mat","dumbbells","bench"], equipment,
];
let combinations = 0;
for (const level of levels) {
  for (const goal of goals) {
    for (const daysPerWeek of [2,3,4,5,6]) {
      for (const available of sets) {
        const p = {
          ...profile, level, goals: [goal],
          daysPerWeek, sessionMinutes: 30, equipment: available,
        };
        try {
          const generated = generateWorkout(p, { day: 0, history: [] });
          combinations++;
          check(generated.exercises.length > 0, `empty ${level}/${goal}/${daysPerWeek}`);
          const used = new Set<string>();
          for (const item of generated.exercises) {
            check(!used.has(item.exercise.id), `duplicate in ${level}/${goal}: ${item.exercise.id}`);
            used.add(item.exercise.id);
            check(Boolean(getExercise(item.exercise.id)) &&
              hasEquipment(item.exercise, available), `missing equipment: ${level}/${goal}/${item.exercise.id}`);
            check(Number.isFinite(item.workSeconds) && item.workSeconds > 0 &&
              Number.isInteger(item.sets) && item.sets >= 1 &&
              Number.isFinite(item.restSeconds) && item.restSeconds >= 0,
              `invalid workout timing: ${level}/${goal}/${item.exercise.id}`);
          }
        } catch (error) {
          failures.push(`plan ${level}/${goal}/${daysPerWeek}: ${String(error)}`);
        }
      }
    }
  }
}
const injuries: Injury[] = ["knee","lower-back","shoulder","wrist","ankle","neck","hip"];
for (const injury of injuries) {
  const p = { ...profile, injuries:[injury] };
  const generated = generateWorkout(p,{ day:0, history:[] });
  for (const item of generated.exercises) {
    check(isSafeFor(item.exercise, [injury]),
      `injury ${injury}: incompatible exercise ${item.exercise.id} generated`);
  }
}
check(EXERCISES.length === 302,
  "Expected 302 catalog exercises; investigate accidental additions/removals");
check(resolveWorkSetTransition(1, 3, 60, true) === "rest", "rested set transition broken");
check(resolveWorkSetTransition(1, 3, 0, true) === "next-set", "zero-rest transition broken");
check(resolveWorkSetTransition(2, 3, 0, false) === "next-set", "penultimate set skipped");
check(resolveWorkSetTransition(3, 3, 0, true) === "next-exercise", "last set ignored");
check(resolveWorkSetTransition(3, 3, 0, false) === "done", "session cannot finish");
for (const invalid of [[0,3,30,true], [4,3,30,true], [1,3,-1,true]]) {
  let threw = false;
  try { resolveWorkSetTransition(invalid[0] as number, invalid[1] as number,
    invalid[2] as number, invalid[3] as boolean); } catch { threw = true; }
  check(threw, "invalid set state accepted");
}

const cases: Array<{ age:string;height:string;weight:string;valid:boolean }> = [
  {age:"28",height:"178",weight:"76.4",valid:true},
  {age:"٢٨",height:"١٧٨٫٥",weight:"٧٦٫٥",valid:true},
  {age:"",height:"",weight:"",valid:true},
  {age:"-5",height:"170",weight:"75",valid:false},
  {age:"0",height:"170",weight:"75",valid:false},
  {age:"1000",height:"170",weight:"75",valid:false},
  {age:"28",height:"1e309",weight:"75",valid:false},
  {age:"28",height:"170",weight:"Infinity",valid:false},
  {age:"28",height:"170",weight:"0",valid:false},
  {age:"28",height:"999",weight:"75",valid:false},
  {age:"22.5",height:"178",weight:"75",valid:false},
  {age:"28",height:"178",weight:"75.456",valid:false},
];
for (const sample of cases) {
  const result = validateOnboardingMeasurements(sample);
  const valid = Object.values(result.errors).every((error) => !error);
  check(valid === sample.valid, "measurement form validation mismatch: " + JSON.stringify(sample));
}
const arabic = validateOnboardingMeasurements(cases[1]);
check(arabic.age === 28 && arabic.heightCm === 178.5 && arabic.weightKg === 76.5,
  "Arabic numbers were not normalized correctly");

if (failures.length) {
  console.error(`Comprehensive exercise/forms QA FAILED (${failures.length}):`);
  failures.slice(0, 100).forEach((failure) => console.error(" - " + failure));
  process.exitCode = 1;
} else {
  console.log(`Comprehensive exercise/forms QA PASS: ${ids.size} catalog exercises and launch mappings, ${combinations} generated training combinations, ${injuries.length} injury filters, zero-rest set transitions, Arabic/English onboarding inputs.`);
}
