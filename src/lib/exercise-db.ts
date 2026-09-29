import manifest from "../data/workout-guide-manifest.json";
import instructionEnrichment from "../data/exercise-instructions.json";

export type Category =
  | "push"
  | "pull"
  | "legs"
  | "core"
  | "cardio"
  | "mobility"
  | "warmup"
  | "cooldown";

export type Equipment =
  | "none"
  | "mat"
  | "dumbbells"
  | "barbell"
  | "kettlebell"
  | "resistance-band"
  | "pullup-bar"
  | "bench"
  | "machine"
  | "cable"
  | "cardio-machine"
  | "weight-plate"
  | "wall"
  | "chair"
  | "doorway"
  | "towel"
  | "box"
  | "stability-ball";

export type Level = "beginner" | "intermediate" | "advanced";

export type Goal =
  | "fat-loss"
  | "muscle-gain"
  | "strength"
  | "endurance"
  | "mobility"
  | "general-fitness";

export type Muscle =
  | "chest"
  | "back"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "quads"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "adductors"
  | "hips"
  | "lower-back"
  | "core"
  | "full-body";

export type Injury =
  | "knee"
  | "lower-back"
  | "shoulder"
  | "wrist"
  | "ankle"
  | "neck"
  | "hip";

export type Location = "home" | "gym" | "outdoor";

export type Pose =
  | "push-up"
  | "squat"
  | "plank"
  | "burpee"
  | "warmup"
  | "cooldown"
  | "default";

export type ExerciseType =
  | "weight_reps"
  | "bodyweight_reps"
  | "duration"
  | "distance_duration"
  | "assisted_bodyweight";

export interface ExerciseMedia {
  kind: "frames";
  frames: [string, string, string];
  attribution: string;
  license: "CC BY-SA 4.0";
  licenseUrl: string;
  sourceUrl: string;
  sourceCommit: string;
}

export interface Exercise {
  id: string;
  name: string;
  latin: string;
  category: Category;
  level: Level;
  equipment: Equipment[];
  primary: Muscle[];
  secondary: Muscle[];
  location: Location[];
  goals: Goal[];
  /**
   * Conservative screening tags inferred from the movement name for the
   * existing workout filter. They are not medical contraindications.
   */
  contraindicated: Injury[];
  pose: Pose;
  tempo: number;
  /** Approximate planning estimate, not a measured metabolic value. */
  caloriesPerMin: number;
  recommendedSets: number;
  recommendedReps: string;
  restSeconds: number;
  cue: string;
  mistakes: string[];
  safety: string[];
  breathing: string;
  progression: string[];
  alternatives: string[];
  reference: string;
  exerciseType: ExerciseType;
  isStretch: boolean;
  media: ExerciseMedia;
  sourceInstructionsEn?: string;
  sourceInstructionStepsEn?: string[];
}

type SourceExercise = {
  id: string;
  slug: string;
  name: string;
  exerciseType: ExerciseType;
  equipment: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  isStretch: boolean;
  frames: Array<{ index: 1 | 2 | 3; path: string }>;
};

type InstructionEnrichment = {
  sourceId: string;
  sourceName: string;
  instructionsEn: string;
  stepsEn: string[];
  target: string;
  muscleGroup: string;
  secondaryMuscles: string[];
  license: "MIT";
  repository: "hasaneyldrm/exercises-dataset";
};

const SOURCE_COMMIT = "aac599224bb9780305239607ef98540b7e0ce389";
const SOURCE_REPO = "https://github.com/bryllim/workout-guide";
const ASSET_BASE =
  "https://raw.githubusercontent.com/bryllim/workout-guide/" +
  SOURCE_COMMIT +
  "/packages/workout-guide/";

const SOURCE_MANIFEST = manifest as unknown as SourceExercise[];
const INSTRUCTIONS = instructionEnrichment as Record<string, InstructionEnrichment>;

const EQUIPMENT_MAP: Record<string, Equipment> = {
  Barbell: "barbell",
  Dumbbell: "dumbbells",
  Machine: "machine",
  Cable: "cable",
  Bodyweight: "none",
  Cardio: "cardio-machine",
  Plate: "weight-plate",
  Kettlebell: "kettlebell",
  "Pull-up Bar": "pullup-bar",
  Bench: "bench",
  Wall: "wall",
  Chair: "chair",
  Doorway: "doorway",
  Towel: "towel",
  Box: "box",
  "Stability Ball": "stability-ball",
  "Resistance Band": "resistance-band",
};

const MUSCLE_MAP: Record<string, Muscle[]> = {
  Chest: ["chest"],
  Shoulders: ["shoulders"],
  "Rear Delts": ["shoulders"],
  "Upper Back": ["back"],
  Back: ["back"],
  Lats: ["back"],
  Biceps: ["biceps"],
  Triceps: ["triceps"],
  Forearms: ["forearms"],
  Quads: ["quads"],
  Hamstrings: ["hamstrings"],
  "Posterior Chain": ["hamstrings", "glutes", "lower-back"],
  Glutes: ["glutes"],
  Calves: ["calves"],
  Adductors: ["adductors"],
  Hips: ["hips"],
  Core: ["core"],
  "Lower Back": ["lower-back", "core"],
  Legs: ["quads", "glutes"],
  Mobility: ["full-body"],
};

const ARABIC_NAME_OVERRIDES: Record<string, string> = {
  "bench-press": "ضغط البنش بالبار",
  "incline-bench-press": "ضغط بنش مائل",
  "dumbbell-bench-press": "ضغط بنش بالدمبل",
  "push-up": "تمرين الضغط",
  "pull-up": "العقلة",
  squat: "القرفصاء",
  deadlift: "الرفعة الميتة",
  "romanian-deadlift": "الرفعة الرومانية",
  "overhead-press": "ضغط علوي بالبار",
  "lateral-raise": "رفع جانبي للكتف",
  "barbell-row": "تجديف بالبار",
  "lat-pulldown": "سحب علوي",
  "bicep-curl": "بايسبس كيرل",
  "tricep-pushdown": "دفع ترايسبس بالكابل",
  plank: "البلانك",
  "side-plank": "بلانك جانبي",
  crunch: "كرنش",
  "bicycle-crunch": "كرنش الدراجة",
  "mountain-climber": "متسلق الجبل",
  burpee: "بيربي",
  running: "الجري",
  walking: "المشي",
  cycling: "ركوب الدراجة",
  rowing: "جهاز التجديف",
  "jump-rope": "نط الحبل",
  inchworm: "المشي باليدين",
  "cat-cow-stretch": "تمدد القط والبقرة",
  "hamstring-stretch": "تمدد أوتار الركبة",
};

function categoryFor(raw: SourceExercise): Category {
  if (raw.isStretch || raw.primaryMuscle === "Mobility") return "mobility";
  if (raw.exerciseType === "distance_duration" || raw.equipment === "Cardio") return "cardio";
  if (["Chest", "Shoulders", "Triceps"].includes(raw.primaryMuscle)) return "push";
  if (["Rear Delts", "Upper Back", "Back", "Lats", "Biceps", "Forearms"].includes(raw.primaryMuscle))
    return "pull";
  if (
    ["Posterior Chain", "Hamstrings", "Quads", "Glutes", "Calves", "Legs", "Adductors", "Hips"].includes(
      raw.primaryMuscle,
    )
  )
    return "legs";
  return "core";
}

function levelFor(raw: SourceExercise): Level {
  const name = raw.name.toLowerCase();
  if (
    /(muscle.?up|handstand|pistol|dragon|one-arm|nordic|human flag|front lever|back lever|sissy squat|weighted pull-up|weighted dip|clap|plyo)/.test(
      name,
    )
  )
    return "advanced";
  if (
    raw.isStretch ||
    /(assisted|wall |dead bug|bird dog|glute bridge|march|walking|cat-cow|calf stretch|incline push-up)/.test(
      name,
    )
  )
    return "beginner";
  return "intermediate";
}

function screeningTagsFor(raw: SourceExercise): Injury[] {
  const name = raw.name.toLowerCase();
  const tags = new Set<Injury>();
  if (/(squat|lunge|leg press|leg extension|jump|step-up|pistol|split squat|sissy)/.test(name))
    tags.add("knee");
  if (/(jump|calf|run|sprint|rope|step-up)/.test(name)) tags.add("ankle");
  if (/(press|push-up|dip|fly|raise|pull-up|pulldown|shoulder|row)/.test(name))
    tags.add("shoulder");
  if (/(push-up|plank|handstand|bear crawl|inchworm)/.test(name)) tags.add("wrist");
  if (/(deadlift|good morning|back extension|row|sit-up|crunch|woodchop)/.test(name))
    tags.add("lower-back");
  if (/(hip|lunge|squat|adductor)/.test(name)) tags.add("hip");
  if (/neck/.test(name)) tags.add("neck");
  return [...tags];
}

function poseFor(raw: SourceExercise): Pose {
  const name = raw.name.toLowerCase();
  if (raw.isStretch) return "cooldown";
  if (/push-up|chest press|bench press/.test(name)) return "push-up";
  if (/squat|lunge|leg press|step-up/.test(name)) return "squat";
  if (/plank|dead bug|bird dog/.test(name)) return "plank";
  if (/burpee|jump|running|sprint|mountain climber/.test(name)) return "burpee";
  return "default";
}

function goalsFor(raw: SourceExercise): Goal[] {
  if (raw.isStretch) return ["mobility", "general-fitness"];
  if (raw.exerciseType === "distance_duration" || raw.equipment === "Cardio")
    return ["endurance", "fat-loss", "general-fitness"];
  if (raw.exerciseType === "weight_reps") return ["muscle-gain", "strength", "general-fitness"];
  if (raw.exerciseType === "assisted_bodyweight") return ["strength", "general-fitness"];
  return ["strength", "endurance", "general-fitness"];
}

function locationFor(raw: SourceExercise): Location[] {
  if (["Bodyweight", "Resistance Band", "Wall", "Chair", "Doorway", "Towel"].includes(raw.equipment))
    return ["home", "gym", "outdoor"];
  if (
    ["Dumbbell", "Kettlebell", "Pull-up Bar", "Bench", "Box", "Stability Ball"].includes(
      raw.equipment,
    )
  )
    return ["home", "gym"];
  return ["gym"];
}

function tempoFor(raw: SourceExercise) {
  if (raw.isStretch) return 5;
  if (raw.exerciseType === "distance_duration") return 1.5;
  if (raw.exerciseType === "duration") return 3;
  return 3;
}

function caloriesFor(raw: SourceExercise) {
  if (raw.isStretch) return 3;
  if (raw.exerciseType === "distance_duration" || raw.equipment === "Cardio") return 9;
  if (raw.exerciseType === "bodyweight_reps") return 7;
  if (raw.exerciseType === "assisted_bodyweight") return 6;
  return 6;
}

function defaultsFor(raw: SourceExercise) {
  if (raw.isStretch) return { sets: 2, reps: "30-45 ثانية", rest: 15 };
  if (raw.exerciseType === "distance_duration") return { sets: 1, reps: "10-20 دقيقة", rest: 30 };
  if (raw.exerciseType === "duration") return { sets: 3, reps: "30-60 ثانية", rest: 30 };
  if (raw.exerciseType === "weight_reps") return { sets: 3, reps: "8-12", rest: 75 };
  return { sets: 3, reps: "10-15", rest: 60 };
}

function toExercise(raw: SourceExercise): Exercise {
  const defaults = defaultsFor(raw);
  const sourceInstructions = INSTRUCTIONS[raw.slug];
  const primary = MUSCLE_MAP[raw.primaryMuscle] ?? ["full-body"];
  const secondary = [...new Set(raw.secondaryMuscles.flatMap((muscle) => MUSCLE_MAP[muscle] ?? []))].filter(
    (muscle) => !primary.includes(muscle),
  );
  const frames = [...raw.frames]
    .sort((a, b) => a.index - b.index)
    .map((frame) => ASSET_BASE + frame.path) as [string, string, string];

  const cue = raw.isStretch
    ? "نفّذ " + raw.name + " ببطء وبدون ارتداد، وراجع الإطارات الثلاثة بالترتيب قبل البدء."
    : "نفّذ " + raw.name + " بتحكم، وراجع الإطارات الثلاثة بالترتيب 1 ← 2 ← 3 قبل زيادة السرعة أو المقاومة.";

  return {
    id: raw.slug,
    name: ARABIC_NAME_OVERRIDES[raw.slug] ?? raw.name,
    latin: raw.name,
    category: categoryFor(raw),
    level: levelFor(raw),
    equipment: [EQUIPMENT_MAP[raw.equipment] ?? "none"],
    primary,
    secondary,
    location: locationFor(raw),
    goals: goalsFor(raw),
    contraindicated: screeningTagsFor(raw),
    pose: poseFor(raw),
    tempo: tempoFor(raw),
    caloriesPerMin: caloriesFor(raw),
    recommendedSets: defaults.sets,
    recommendedReps: defaults.reps,
    restSeconds: defaults.rest,
    cue,
    mistakes: raw.isStretch
      ? ["الارتداد أثناء التمدد", "الدخول في مدى يسبب ألماً حاداً"]
      : ["التسرع على حساب التحكم", "زيادة المقاومة قبل ثبات نمط الحركة"],
    safety: [
      "أوقف الحركة عند الألم الحاد أو الدوار.",
      "ابدأ بمقاومة ومدى حركة يمكنك التحكم بهما.",
      "إشارات الفحص داخل التطبيق احترازية وليست تشخيصاً طبياً.",
    ],
    breathing: raw.isStretch
      ? "تنفس ببطء وبشكل طبيعي طوال التمدد."
      : "ازفر خلال مرحلة الجهد وخذ شهيقاً أثناء العودة بشكل متحكم.",
    progression: [raw.slug],
    alternatives: [],
    reference: sourceInstructions
      ? "Workout Guide (" +
        raw.name +
        ") + matched technique text from exercises-dataset (" +
        sourceInstructions.sourceName +
        ")."
      : "Workout Guide (" + raw.name + ") — visual frames and structured exercise metadata.",
    exerciseType: raw.exerciseType,
    isStretch: raw.isStretch,
    media: {
      kind: "frames",
      frames,
      attribution: "Bryl Lim / Everkinetic",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
      sourceUrl: SOURCE_REPO,
      sourceCommit: SOURCE_COMMIT,
    },
    sourceInstructionsEn: sourceInstructions?.instructionsEn || undefined,
    sourceInstructionStepsEn: sourceInstructions?.stepsEn?.length ? sourceInstructions.stepsEn : undefined,
  };
}

const BASE_EXERCISES = SOURCE_MANIFEST.map(toExercise);

export const EXERCISES: Exercise[] = BASE_EXERCISES.map((exercise) => ({
  ...exercise,
  alternatives: BASE_EXERCISES.filter(
    (candidate) =>
      candidate.id !== exercise.id &&
      candidate.category === exercise.category &&
      candidate.primary[0] === exercise.primary[0],
  )
    .slice(0, 3)
    .map((candidate) => candidate.id),
}));

const LEGACY_ID_ALIASES: Record<string, string> = {
  pushup: "push-up",
  pullup: "pull-up",
  "bodyweight-squat": "squat",
  "dynamic-warmup": "inchworm",
  "static-cooldown": "cat-cow-stretch",
};

export function getExercise(id: string): Exercise | undefined {
  const resolved = LEGACY_ID_ALIASES[id] ?? id;
  return EXERCISES.find((exercise) => exercise.id === resolved);
}

export function progressionLadder(id: string): Exercise[] {
  const exercise = getExercise(id);
  if (!exercise) return [];
  return exercise.progression
    .map((progressionId) => getExercise(progressionId))
    .filter((candidate): candidate is Exercise => Boolean(candidate));
}

export const LEVEL_LABEL_AR: Record<Level, string> = {
  beginner: "مبتدئ",
  intermediate: "متوسط",
  advanced: "متقدم",
};

export const CATEGORY_LABEL_AR: Record<Category, string> = {
  push: "دفع",
  pull: "سحب",
  legs: "أرجل",
  core: "كور",
  cardio: "كارديو",
  mobility: "مرونة",
  warmup: "إحماء",
  cooldown: "استرداد",
};

export const MUSCLE_LABEL_AR: Record<Muscle, string> = {
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
};

export const EQUIPMENT_LABEL_AR: Record<Equipment, string> = {
  none: "بدون معدات",
  mat: "حصيرة",
  dumbbells: "دمبل",
  barbell: "باربل",
  kettlebell: "كيتل بيل",
  "resistance-band": "شريط مقاومة",
  "pullup-bar": "بار عقلة",
  bench: "بنش",
  machine: "جهاز",
  cable: "كابل",
  "cardio-machine": "جهاز كارديو",
  "weight-plate": "قرص أوزان",
  wall: "حائط",
  chair: "كرسي",
  doorway: "مدخل باب",
  towel: "منشفة",
  box: "صندوق",
  "stability-ball": "كرة ثبات",
};
