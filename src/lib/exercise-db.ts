import manifest from "../data/workout-guide-manifest.json";
import instructionEnrichment from "../data/exercise-instructions.json";
import arabicNames from "../data/exercise-arabic-names.json";
import mediaMap from "../data/exercise-media-map.json";
import { MUSCLE_LABEL_AR as LIGHTWEIGHT_MUSCLE_LABEL_AR } from "./exercise-meta";

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

export const INJURY_LABEL_AR: Record<Injury, string> = {
  knee: "الركبة",
  "lower-back": "أسفل الظهر",
  shoulder: "الكتف",
  wrist: "الرسغ",
  ankle: "الكاحل",
  neck: "الرقبة",
  hip: "الورك",
};

export const INJURY_SCREENING_NOTE_AR =
  "هذه اختيارات احترازية لتصفية الحركات في التطبيق، وليست تشخيصًا أو تصريحًا طبيًا لممارسة التمرين.";

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

export type TrainingRole =
  | "warmup"
  | "main"
  | "accessory"
  | "core"
  | "cardio"
  | "mobility"
  | "cooldown";

export type MovementFamily =
  | "horizontal-press"
  | "vertical-press"
  | "chest-fly"
  | "horizontal-pull"
  | "vertical-pull"
  | "squat"
  | "hinge"
  | "lunge"
  | "hip-extension"
  | "knee-extension"
  | "knee-flexion"
  | "calf-raise"
  | "biceps-curl"
  | "triceps-extension"
  | "lateral-raise"
  | "rear-delt"
  | "core-flexion"
  | "core-stability"
  | "carry"
  | "cardio"
  | "mobility"
  | "other";

export type MatchConfidence = "exact" | "high" | "review" | "none";

export interface ExerciseMedia {
  preferred: "gif" | "video" | "frames";
  gif?: string;
  video?: string;
  poster: string;
  frames: [string, string, string];
  sourceExerciseId?: string;
  sourceName?: string;
  sourceAttribution?: string;
  sourceUrl?: string;
  sourceCommit?: string;
  matchConfidence: MatchConfidence;
  candidateSourceExerciseId?: string;
  candidateSourceName?: string;
  fallback: {
    attribution: string;
    license: "CC BY-SA 4.0";
    licenseUrl: string;
    sourceUrl: string;
    sourceCommit: string;
  };
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
  trainingRole: TrainingRole;
  movementFamily: MovementFamily;
  media: ExerciseMedia;
  descriptionAr: string;
  instructionsAr: string[];
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

type MediaMapMeta = {
  sourceRepository: "hasaneyldrm/exercises-dataset";
  sourceCommit: string;
  rawBase: string;
  fallbackRepository: "bryllim/workout-guide";
  generatedFrom: number;
  auraExerciseCount: number;
};

type MediaMapEntry = {
  source?: "hasaneyldrm/exercises-dataset";
  sourceExerciseId?: string;
  sourceName?: string;
  gif?: string;
  poster?: string;
  matchConfidence: MatchConfidence;
  equipment?: string;
  target?: string;
  candidateSourceExerciseId?: string;
  candidateSourceName?: string;
};

type ExerciseMediaMap = {
  _meta: MediaMapMeta;
} & Record<string, MediaMapEntry | MediaMapMeta>;

const SOURCE_COMMIT = "aac599224bb9780305239607ef98540b7e0ce389";
const SOURCE_REPO = "https://github.com/bryllim/workout-guide";
const ASSET_BASE =
  "https://raw.githubusercontent.com/bryllim/workout-guide/" +
  SOURCE_COMMIT +
  "/packages/workout-guide/";

const SOURCE_MANIFEST = manifest as unknown as SourceExercise[];
const INSTRUCTIONS = instructionEnrichment as Record<string, InstructionEnrichment>;
const MEDIA_MAP = mediaMap as unknown as ExerciseMediaMap;
const MEDIA_META = MEDIA_MAP._meta;
const MEDIA_SOURCE_URL = "https://github.com/" + MEDIA_META.sourceRepository;

function resolvePreferredAsset(path?: string) {
  if (!path) return undefined;
  return /^https?:\/\//.test(path) ? path : MEDIA_META.rawBase + path;
}

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

const ARABIC_NAMES = arabicNames as Record<string, string>;

const SOURCE_MUSCLE_LABEL_AR: Record<string, string> = {
  Chest: "الصدر",
  Shoulders: "الأكتاف",
  "Rear Delts": "الكتف الخلفي",
  "Upper Back": "أعلى الظهر",
  Back: "الظهر",
  Lats: "عضلات الظهر العريضة",
  Biceps: "البايسبس",
  Triceps: "الترايسبس",
  Forearms: "الساعد",
  Quads: "الفخذ الأمامي",
  Hamstrings: "أوتار الركبة",
  "Posterior Chain": "السلسلة الخلفية",
  Glutes: "عضلات المؤخرة",
  Calves: "السمانة",
  Adductors: "العضلات الضامة",
  Hips: "الورك",
  Core: "عضلات الجذع",
  "Lower Back": "أسفل الظهر",
  Legs: "الأرجل",
  Mobility: "الحركة والمرونة",
};

const SOURCE_EQUIPMENT_LABEL_AR: Record<string, string> = {
  Barbell: "البار",
  Dumbbell: "الدمبل",
  Machine: "الجهاز",
  Cable: "الكابل",
  Bodyweight: "وزن الجسم",
  Cardio: "جهاز الكارديو",
  Plate: "قرص الأوزان",
  Kettlebell: "الكيتل بيل",
  "Pull-up Bar": "بار العقلة",
  Bench: "البنش",
  Wall: "الحائط",
  Chair: "الكرسي",
  Doorway: "مدخل الباب",
  Towel: "المنشفة",
  Box: "الصندوق",
  "Stability Ball": "كرة الثبات",
  "Resistance Band": "شريط المقاومة",
};

function descriptionFor(raw: SourceExercise, nameAr: string) {
  const muscle = SOURCE_MUSCLE_LABEL_AR[raw.primaryMuscle] ?? "العضلات المستهدفة";
  const equipment = SOURCE_EQUIPMENT_LABEL_AR[raw.equipment] ?? "المعدات المناسبة";
  if (raw.isStretch) {
    return nameAr + " تمرين مرونة وحركة يركز على " + muscle + "، ويُنفذ باستخدام " + equipment + " مع مدى مريح وتحكم كامل دون ارتداد.";
  }
  if (raw.exerciseType === "distance_duration") {
    return nameAr + " تمرين لياقة وتحمل يركز على " + muscle + "، ويُنفذ باستخدام " + equipment + " مع الحفاظ على إيقاع يمكن التحكم فيه ووضعية مستقرة.";
  }
  if (raw.exerciseType === "duration") {
    return nameAr + " تمرين يعتمد على الزمن ويستهدف " + muscle + "، مع أهمية تثبيت الوضع والمحاذاة طوال مدة الجولة.";
  }
  return nameAr + " تمرين مقاومة يستهدف " + muscle + " بشكل أساسي ويُنفذ باستخدام " + equipment + " عبر مدى حركة متحكم ومتوافق مع الإطارات الأصلية للتمرين.";
}

function instructionsFor(raw: SourceExercise): string[] {
  if (raw.isStretch) {
    return [
      "ابدأ من الوضع الموضح في الإطار الأول، واضبط الجسم في وضع مريح ومستقر قبل زيادة مدى التمدد.",
      "انتقل تدريجيًا عبر الإطار الثاني نحو مدى التمدد من دون ارتداد أو ضغط مفاجئ على المفاصل.",
      "اثبت عند المدى المريح الموضح في الإطار الثالث مع تنفس هادئ، ثم ارجع ببطء إلى وضع البداية.",
      "يجب أن يكون الإحساس شدًا مريحًا لا ألمًا حادًا؛ قلّل المدى فورًا إذا ظهر ألم أو تنميل.",
    ];
  }
  if (raw.exerciseType === "distance_duration") {
    return [
      "ابدأ بإيقاع سهل يسمح لك بتثبيت الوضع والتنفس قبل رفع الشدة أو السرعة.",
      "حافظ على الجذع مستقرًا واتبع نمط الحركة الموضح في الإطارات من دون مبالغة في مدى المفاصل.",
      "ارفع الشدة تدريجيًا مع الحفاظ على نفس جودة الحركة، ثم اخفضها تدريجيًا في نهاية الجولة.",
      "استخدم الزمن أو المسافة كهدف للجولة، وليس السرعة وحدها، وأوقف التمرين عند الدوار أو الألم الحاد.",
    ];
  }
  if (raw.exerciseType === "duration") {
    return [
      "اتخذ وضع البداية كما في الإطار الأول وثبّت نقاط الارتكاز قبل بدء احتساب الزمن.",
      "انتقل إلى الوضع المطلوب كما توضحه الإطارات التالية مع إبقاء الجذع والمفاصل في محاذاة مستقرة.",
      "حافظ على الوضع طوال المدة المحددة من دون حبس النفس أو انهيار القوام.",
      "أنهِ الجولة عند فقدان المحاذاة الجيدة، ثم استرح قبل التكرار.",
    ];
  }
  if (raw.exerciseType === "assisted_bodyweight") {
    return [
      "اضبط وسيلة المساعدة بحيث تسمح لك بأداء الحركة كاملة مع تحكم واضح من البداية إلى النهاية.",
      "ابدأ من الإطار الأول، وثبّت الجذع والكتفين أو الحوض بحسب مسار الحركة.",
      "تحرك عبر الإطارين الثاني والثالث بسلاسة، من دون دفع مفاجئ أو ارتداد من الجهاز.",
      "عد ببطء إلى البداية وحافظ على نفس المسار في كل تكرار قبل تقليل مقدار المساعدة.",
    ];
  }
  if (raw.exerciseType === "bodyweight_reps") {
    return [
      "ابدأ من الوضع الموضح في الإطار الأول، وثبّت الجذع ونقاط الارتكاز قبل بدء التكرار.",
      "حرّك الجسم عبر المسار الموضح في الإطار الثاني مع الحفاظ على المحاذاة ومنع الاندفاع بالزخم.",
      "أكمل المدى إلى الإطار الثالث فقط بالقدر الذي يمكنك التحكم فيه من دون ألم أو فقدان للوضع.",
      "ارجع ببطء عبر نفس المسار وكرّر مع جودة حركة ثابتة بدل مطاردة عدد التكرارات.",
    ];
  }
  return [
    "اضبط المقاومة في مستوى يمكنك التحكم فيه، ثم اتخذ وضع البداية الموضح في الإطار الأول.",
    "ثبّت الجذع والمفاصل غير المشاركة مباشرة في الحركة، وابدأ تحريك المقاومة عبر المسار الموضح في الإطار الثاني.",
    "أكمل المدى إلى الإطار الثالث من دون ارتداد أو تغيير مفاجئ في وضع الجسم.",
    "أعد المقاومة ببطء إلى البداية، وحافظ على نفس المسار والإيقاع في كل تكرار قبل زيادة الوزن.",
  ];
}

function mistakesFor(raw: SourceExercise): string[] {
  if (raw.isStretch) return ["الارتداد أثناء التمدد", "الدخول في مدى يسبب ألمًا حادًا", "حبس النفس أثناء الثبات"];
  if (raw.exerciseType === "distance_duration")
    return ["رفع السرعة قبل ثبات التقنية", "فقدان وضع الجذع مع التعب", "تجاهل الألم أو الدوار"];
  if (raw.exerciseType === "duration")
    return ["الاستمرار بعد انهيار الوضع", "حبس النفس", "شد الرقبة أو المفاصل بلا داعٍ"];
  if (raw.exerciseType === "weight_reps")
    return ["استخدام وزن أعلى من القدرة على التحكم", "الاعتماد على الزخم بدل العضلة المستهدفة", "اختصار مدى الحركة بسبب ثقل المقاومة"];
  return ["التسرع على حساب التحكم", "فقدان محاذاة الجذع أو المفاصل", "اختصار المدى قبل إتقان الحركة"];
}

function breathingFor(raw: SourceExercise) {
  if (raw.isStretch) return "تنفس ببطء وبشكل طبيعي، وازفر تدريجيًا عند الدخول إلى مدى التمدد.";
  if (raw.exerciseType === "distance_duration")
    return "حافظ على تنفس منتظم ومتوافق مع الإيقاع، وتجنب حبس النفس عند رفع الشدة.";
  if (raw.exerciseType === "duration")
    return "تنفس بصورة هادئة ومستمرة طوال زمن الثبات أو الحركة.";
  return "ازفر أثناء مرحلة الجهد أو الدفع/السحب، وخذ شهيقًا أثناء العودة المتحكم بها.";
}

const WARMUP_EXERCISE_IDS = new Set([
  "inchworm",
  "arm-circles",
  "leg-swings-stretch",
  "torso-twist-stretch",
  "worlds-greatest-stretch",
  "high-knees",
  "jumping-jack",
]);

const COOLDOWN_EXERCISE_IDS = new Set([
  "cat-cow-stretch",
  "doorway-chest-stretch",
  "childs-pose",
  "kneeling-hip-flexor-stretch",
  "hamstring-stretch",
  "standing-quad-stretch",
  "seated-forward-fold-stretch",
  "cross-body-shoulder-stretch",
  "wall-calf-stretch",
  "butterfly-stretch",
]);

const MAIN_MOVEMENT_PATTERN =
  /(bench press|chest press|overhead press|shoulder press|push press|push-up|pull-up|chin-up|row|pulldown|deadlift|squat|leg press|lunge|split squat|step-up|hip thrust|glute bridge|dip|good morning|rack pull|landmine press|kettlebell swing)/;

function movementFamilyFor(raw: SourceExercise): MovementFamily {
  const name = raw.name.toLowerCase();

  if (raw.isStretch || raw.primaryMuscle === "Mobility") return "mobility";
  if (raw.exerciseType === "distance_duration" || raw.equipment === "Cardio") {
    return "cardio";
  }
  if (/(bench press|chest press|push-up|push up|floor press)/.test(name)) {
    return "horizontal-press";
  }
  if (/(overhead press|shoulder press|push press|military press|landmine press)/.test(name)) {
    return "vertical-press";
  }
  if (/(fly|flye|pec deck)/.test(name) && /(chest|cable|dumbbell|machine)/.test(name)) {
    return "chest-fly";
  }
  if (/(row)/.test(name)) return "horizontal-pull";
  if (/(pull-up|pull up|chin-up|chin up|pulldown|pull down)/.test(name)) {
    return "vertical-pull";
  }
  if (/(deadlift|good morning|romanian|rdl|rack pull)/.test(name)) {
    return "hinge";
  }
  if (/(lunge|split squat|step-up|step up|curtsy)/.test(name)) {
    return "lunge";
  }
  if (/(hip thrust|glute bridge|frog pump|hip extension)/.test(name)) {
    return "hip-extension";
  }
  if (/(leg extension|sissy squat)/.test(name)) return "knee-extension";
  if (/(leg curl|hamstring curl|nordic)/.test(name)) return "knee-flexion";
  if (/(calf raise|calf press)/.test(name)) return "calf-raise";
  if (/(squat|leg press|hack squat)/.test(name)) return "squat";
  if (/(biceps curl|bicep curl|hammer curl|preacher curl|spider curl|concentration curl)/.test(name)) {
    return "biceps-curl";
  }
  if (/(triceps|tricep|pushdown|push-down|skull crusher|skullcrusher|dip)/.test(name)) {
    return "triceps-extension";
  }
  if (/(lateral raise|side raise)/.test(name)) return "lateral-raise";
  if (/(rear delt|reverse fly|reverse flye|face pull)/.test(name)) return "rear-delt";
  if (/(crunch|sit-up|sit up|v-up|v up|leg raise|knee raise)/.test(name)) {
    return "core-flexion";
  }
  if (/(plank|dead bug|bird dog|pallof|hollow|l-sit|l sit)/.test(name)) {
    return "core-stability";
  }
  if (/(carry|farmer|suitcase)/.test(name)) return "carry";
  return "other";
}

function trainingRoleFor(raw: SourceExercise): TrainingRole {
  if (WARMUP_EXERCISE_IDS.has(raw.slug)) return "warmup";
  if (COOLDOWN_EXERCISE_IDS.has(raw.slug)) return "cooldown";
  if (raw.exerciseType === "distance_duration" || raw.equipment === "Cardio") return "cardio";
  if (raw.primaryMuscle === "Core") return "core";
  if (raw.isStretch || raw.primaryMuscle === "Mobility") return "mobility";
  if (MAIN_MOVEMENT_PATTERN.test(raw.name.toLowerCase())) return "main";
  return "accessory";
}

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
  const mediaMapping = MEDIA_MAP[raw.slug] as MediaMapEntry | undefined;
  const hasVerifiedPreferredMedia =
    mediaMapping?.source === "hasaneyldrm/exercises-dataset" &&
    (mediaMapping.matchConfidence === "exact" || mediaMapping.matchConfidence === "high") &&
    Boolean(mediaMapping.gif && mediaMapping.poster);
  const primary = MUSCLE_MAP[raw.primaryMuscle] ?? ["full-body"];
  const secondary = [...new Set(raw.secondaryMuscles.flatMap((muscle) => MUSCLE_MAP[muscle] ?? []))].filter(
    (muscle) => !primary.includes(muscle),
  );
  const frames = [...raw.frames]
    .sort((a, b) => a.index - b.index)
    .map((frame) => ASSET_BASE + frame.path) as [string, string, string];

  const nameAr = ARABIC_NAMES[raw.slug] ?? raw.name;
  const cue = raw.isStretch
    ? "نفّذ " + nameAr + " ببطء وبدون ارتداد، وابقَ داخل مدى مريح يمكنك التحكم فيه."
    : "نفّذ " + nameAr + " بتحكم، واتبع مسار الحركة المعروض قبل زيادة السرعة أو المقاومة.";

  return {
    id: raw.slug,
    name: nameAr,
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
    descriptionAr: descriptionFor(raw, nameAr),
    instructionsAr: instructionsFor(raw),
    mistakes: mistakesFor(raw),
    safety: [
      "أوقف الحركة عند الألم الحاد أو الدوار.",
      "ابدأ بمقاومة ومدى حركة يمكنك التحكم بهما.",
      "إشارات الفحص داخل التطبيق احترازية وليست تشخيصاً طبياً.",
    ],
    breathing: breathingFor(raw),
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
    trainingRole: trainingRoleFor(raw),
    movementFamily: movementFamilyFor(raw),
    media: {
      preferred: hasVerifiedPreferredMedia ? "gif" : "frames",
      gif: hasVerifiedPreferredMedia ? resolvePreferredAsset(mediaMapping?.gif) : undefined,
      poster:
        (hasVerifiedPreferredMedia ? resolvePreferredAsset(mediaMapping?.poster) : undefined) ??
        frames[0],
      frames,
      sourceExerciseId: hasVerifiedPreferredMedia ? mediaMapping?.sourceExerciseId : undefined,
      sourceName: hasVerifiedPreferredMedia ? mediaMapping?.sourceName : undefined,
      sourceAttribution: hasVerifiedPreferredMedia
        ? "© Gym visual — https://gymvisual.com/"
        : undefined,
      sourceUrl: hasVerifiedPreferredMedia ? MEDIA_SOURCE_URL : undefined,
      sourceCommit: hasVerifiedPreferredMedia ? MEDIA_META.sourceCommit : undefined,
      matchConfidence: mediaMapping?.matchConfidence ?? "none",
      candidateSourceExerciseId: mediaMapping?.candidateSourceExerciseId,
      candidateSourceName: mediaMapping?.candidateSourceName,
      fallback: {
        attribution: "Bryl Lim / Everkinetic",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: SOURCE_REPO,
        sourceCommit: SOURCE_COMMIT,
      },
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
      candidate.movementFamily === exercise.movementFamily &&
      candidate.primary[0] === exercise.primary[0] &&
      candidate.trainingRole === exercise.trainingRole &&
      candidate.exerciseType === exercise.exerciseType &&
      candidate.equipment.some((item) =>
        exercise.equipment.includes(item),
      ),
  )
    .sort((a, b) => {
      const aSameEquipment = a.equipment.some((item) =>
        exercise.equipment.includes(item),
      );
      const bSameEquipment = b.equipment.some((item) =>
        exercise.equipment.includes(item),
      );
      if (aSameEquipment !== bSameEquipment) return aSameEquipment ? -1 : 1;
      return a.id.localeCompare(b.id);
    })
    .slice(0, 6)
    .map((candidate) => candidate.id),
}));

const LEGACY_ID_ALIASES: Record<string, string> = {
  pushup: "push-up",
  pullup: "pull-up",
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

export const MUSCLE_LABEL_AR: Record<Muscle, string> =
  LIGHTWEIGHT_MUSCLE_LABEL_AR;

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


export const MOVEMENT_FAMILY_LABEL_AR: Record<MovementFamily, string> = {
  "horizontal-press": "ضغط أفقي",
  "vertical-press": "ضغط رأسي",
  "chest-fly": "تفتيح الصدر",
  "horizontal-pull": "سحب أفقي",
  "vertical-pull": "سحب رأسي",
  squat: "سكوات / دفع الرجل",
  hinge: "Hinge / سلسلة خلفية",
  lunge: "اندفاع أحادي",
  "hip-extension": "مد الورك",
  "knee-extension": "مد الركبة",
  "knee-flexion": "ثني الركبة",
  "calf-raise": "سمانة",
  "biceps-curl": "بايسبس Curl",
  "triceps-extension": "ترايسبس",
  "lateral-raise": "رفرفة جانبية",
  "rear-delt": "كتف خلفي",
  "core-flexion": "ثني الجذع",
  "core-stability": "ثبات الجذع",
  carry: "حمل ومشي",
  cardio: "كارديو",
  mobility: "حركة ومرونة",
  other: "نمط عام",
};

export const TRAINING_ROLE_LABEL_AR: Record<TrainingRole, string> = {
  warmup: "إحماء",
  main: "تمرين أساسي",
  accessory: "تمرين مساعد",
  core: "كور",
  cardio: "كارديو",
  mobility: "حركة ومرونة",
  cooldown: "تهدئة",
};

export const EXERCISE_TYPE_LABEL_AR: Record<ExerciseType, string> = {
  weight_reps: "مقاومة وتكرارات",
  bodyweight_reps: "وزن الجسم وتكرارات",
  duration: "تمرين زمني",
  distance_duration: "مسافة أو زمن",
  assisted_bodyweight: "وزن الجسم بمساعدة",
};

export const LOCATION_LABEL_AR: Record<Location, string> = {
  home: "المنزل",
  gym: "صالة الجيم",
  outdoor: "الخارج",
};

export const GOAL_LABEL_AR: Record<Goal, string> = {
  "fat-loss": "خفض الدهون",
  "muscle-gain": "بناء العضلات",
  strength: "زيادة القوة",
  endurance: "رفع التحمل",
  mobility: "تحسين الحركة",
  "general-fitness": "اللياقة العامة",
};
