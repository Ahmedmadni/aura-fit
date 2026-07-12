/**
 * 2D posture-comparison illustrations for the Safety tab.
 * Each exercise has a CORRECT figure and one or more MISTAKE figures with
 * arrows / warning marks calling out the wrong joint.
 *
 * Pure SVG — matches the neon athlete style from athlete-2d.tsx.
 */
import { useRef, useState } from "react";


const SKIN = "#e9f5b0";
const SKIN_SHADE = "#a8c94a";
const GEAR = "#0f1116";
const GEAR_HI = "#2a2f3a";
const NEON = "#ccff00";
const DANGER = "#ff5c6b";

export type PostureExerciseId =
  | "pushup"
  | "wall-pushup"
  | "incline-pushup"
  | "knee-pushup"
  | "diamond-pushup"
  | "archer-pushup"
  | "one-arm-pushup"
  | "bodyweight-squat"
  | "goblet-squat"
  | "jump-squat"
  | "pistol-squat"
  | "lunge"
  | "reverse-lunge"
  | "wall-sit"
  | "plank"
  | "side-plank"
  | "pullup"
  | "australian-pullup"
  | "negative-pullup"
  | "weighted-pullup"
  | "burpee"
  | "mountain-climber"
  | "dumbbell-row"
  | "glute-bridge"
  | "default";

type Variant = {
  label: string;
  cue: string;
  figure: "pushup" | "squat" | "plank" | "pullup" | "lunge" | "bridge" | "row" | "default";
  mistake?: "sag" | "flare" | "knees-in" | "heels-up" | "back-round" | "hips-high" | "swing" | "knee-forward" | "neck-drop";
};

const VARIANTS: Record<PostureExerciseId, { correct: Variant; mistakes: Variant[] }> = {
  pushup: {
    correct: { label: "الوضع الصحيح", cue: "خط مستقيم من الرأس للكعب، مرفقان ٤٥°", figure: "pushup" },
    mistakes: [
      { label: "تدلي الحوض", cue: "أسفل الظهر يهبط، ضغط على الفقرات", figure: "pushup", mistake: "sag" },
      { label: "فتح المرفقين ٩٠°", cue: "إجهاد للكتف والمرفق", figure: "pushup", mistake: "flare" },
    ],
  },
  "wall-pushup": {
    correct: { label: "الوضع الصحيح", cue: "الجسم مائل بخط مستقيم، القدمان ثابتتان", figure: "pushup" },
    mistakes: [{ label: "تقوس الظهر", cue: "المؤخرة للخلف — الحمل يذهب للركبتين", figure: "pushup", mistake: "hips-high" }],
  },
  "incline-pushup": {
    correct: { label: "الوضع الصحيح", cue: "اليدان على المقعد، الجسم مائل ومستقيم", figure: "pushup" },
    mistakes: [{ label: "الوركان مرتفعان", cue: "الحوض أعلى من الكتفين", figure: "pushup", mistake: "hips-high" }],
  },
  "knee-pushup": {
    correct: { label: "الوضع الصحيح", cue: "خط مستقيم من الرأس للركبة", figure: "pushup" },
    mistakes: [{ label: "تدلي الحوض", cue: "أسفل الظهر يهبط", figure: "pushup", mistake: "sag" }],
  },
  "diamond-pushup": {
    correct: { label: "الوضع الصحيح", cue: "اليدان تحت الصدر، المرفقان قريبان من الجذع", figure: "pushup" },
    mistakes: [{ label: "فتح المرفقين", cue: "يبطل عمل الترايسبس", figure: "pushup", mistake: "flare" }],
  },
  "archer-pushup": {
    correct: { label: "الوضع الصحيح", cue: "ذراع ممتدة والأخرى مثنية بتحكم", figure: "pushup" },
    mistakes: [{ label: "الوسط ملتوٍ", cue: "الحوض يفقد المحاذاة", figure: "pushup", mistake: "sag" }],
  },
  "one-arm-pushup": {
    correct: { label: "الوضع الصحيح", cue: "قدمان متباعدتان، جذع مشدود", figure: "pushup" },
    mistakes: [{ label: "دوران الكتف", cue: "الجذع يلتف بدل الثبات", figure: "pushup", mistake: "sag" }],
  },
  "bodyweight-squat": {
    correct: { label: "الوضع الصحيح", cue: "الصدر مرفوع، الركبتان بمحاذاة الأصابع، الكعبان على الأرض", figure: "squat" },
    mistakes: [
      { label: "ميل الركبتين للداخل", cue: "خطر على الرباط الصليبي", figure: "squat", mistake: "knees-in" },
      { label: "رفع الكعبين", cue: "قصور في مرونة الكاحل", figure: "squat", mistake: "heels-up" },
    ],
  },
  "goblet-squat": {
    correct: { label: "الوضع الصحيح", cue: "الوزن قرب الصدر، الجذع مستقيم", figure: "squat" },
    mistakes: [{ label: "تقوس الظهر العلوي", cue: "الوزن يسحب الجذع للأمام", figure: "squat", mistake: "back-round" }],
  },
  "jump-squat": {
    correct: { label: "الهبوط الصحيح", cue: "امتصاص الصدمة بثني الركبتين والوركين", figure: "squat" },
    mistakes: [{ label: "هبوط بركب مفرودة", cue: "ضغط عالٍ على الغضاريف", figure: "squat", mistake: "heels-up" }],
  },
  "pistol-squat": {
    correct: { label: "الوضع الصحيح", cue: "ساق ممتدة، جذع مشدود، نزول متحكم", figure: "squat" },
    mistakes: [{ label: "دوران الركبة للداخل", cue: "فقدان محاذاة الركبة والقدم", figure: "squat", mistake: "knees-in" }],
  },
  lunge: {
    correct: { label: "الوضع الصحيح", cue: "الركبة الأمامية فوق الكاحل، الجذع عمودي", figure: "lunge" },
    mistakes: [{ label: "تقدم الركبة الأمامية", cue: "الركبة تتجاوز الأصابع بشدة", figure: "lunge", mistake: "knee-forward" }],
  },
  "reverse-lunge": {
    correct: { label: "الوضع الصحيح", cue: "خطوة طويلة للخلف، جذع مستقيم", figure: "lunge" },
    mistakes: [{ label: "قصر الخطوة", cue: "الركبة تتقدم أكثر مما ينبغي", figure: "lunge", mistake: "knee-forward" }],
  },
  "wall-sit": {
    correct: { label: "الوضع الصحيح", cue: "فخذان موازيان للأرض، ظهر ملتصق بالحائط", figure: "squat" },
    mistakes: [{ label: "ركبتان أعلى من ٩٠°", cue: "حمل زائد على مفصل الركبة", figure: "squat", mistake: "knee-forward" }],
  },
  plank: {
    correct: { label: "الوضع الصحيح", cue: "خط مستقيم من الرأس للكعب، شدّ البطن والمؤخرة", figure: "plank" },
    mistakes: [
      { label: "تدلي الحوض", cue: "ضغط على أسفل الظهر", figure: "plank", mistake: "sag" },
      { label: "رفع المؤخرة", cue: "بطل عمل الكور بالكامل", figure: "plank", mistake: "hips-high" },
    ],
  },
  "side-plank": {
    correct: { label: "الوضع الصحيح", cue: "الجسم بخط مستقيم، الورك عالٍ", figure: "plank" },
    mistakes: [{ label: "الورك يهبط", cue: "بطل عمل العضلة المائلة", figure: "plank", mistake: "sag" }],
  },
  pullup: {
    correct: { label: "الوضع الصحيح", cue: "قبضة أوسع من الكتفين، سحب حتى تجاوز الذقن", figure: "pullup" },
    mistakes: [{ label: "التأرجح", cue: "استخدام الزخم بدل العضلة", figure: "pullup", mistake: "swing" }],
  },
  "australian-pullup": {
    correct: { label: "الوضع الصحيح", cue: "الجسم بخط مستقيم، اسحب الصدر للبار", figure: "pullup" },
    mistakes: [{ label: "الحوض يهبط", cue: "الجسم غير مشدود", figure: "pullup", mistake: "sag" }],
  },
  "negative-pullup": {
    correct: { label: "الوضع الصحيح", cue: "نزول بطيء ٤-٥ ثوانٍ بتحكم كامل", figure: "pullup" },
    mistakes: [{ label: "نزول سريع", cue: "فقدان الفائدة الأساسية", figure: "pullup", mistake: "swing" }],
  },
  "weighted-pullup": {
    correct: { label: "الوضع الصحيح", cue: "مدى كامل، تنفس منتظم، حزام آمن", figure: "pullup" },
    mistakes: [{ label: "تجاهل المدى", cue: "سحب جزئي — لا يبني قوة كاملة", figure: "pullup", mistake: "swing" }],
  },
  burpee: {
    correct: { label: "الوضع الصحيح", cue: "بلانك صلب، قفزة متحكمة", figure: "pushup" },
    mistakes: [{ label: "هبوط الوركين", cue: "أسفل الظهر معرّض للإصابة", figure: "pushup", mistake: "sag" }],
  },
  "mountain-climber": {
    correct: { label: "الوضع الصحيح", cue: "بلانك عالٍ ثابت، الركبة للصدر", figure: "plank" },
    mistakes: [{ label: "رفع الوركين", cue: "الكور يفقد التفعيل", figure: "plank", mistake: "hips-high" }],
  },
  "dumbbell-row": {
    correct: { label: "الوضع الصحيح", cue: "ظهر مستوٍ، سحب الدمبل نحو الورك", figure: "row" },
    mistakes: [{ label: "تقوس أسفل الظهر", cue: "خطر على الفقرات القطنية", figure: "row", mistake: "back-round" }],
  },
  "glute-bridge": {
    correct: { label: "الوضع الصحيح", cue: "خط مستقيم من الركبة للكتف في القمة", figure: "bridge" },
    mistakes: [{ label: "فرط تقوس الظهر", cue: "الرفع من أسفل الظهر بدل المؤخرة", figure: "bridge", mistake: "back-round" }],
  },
  default: {
    correct: { label: "الوضع الصحيح", cue: "جذع مشدود، تنفس منتظم، مدى حركة كامل بتحكم", figure: "default" },
    mistakes: [
      { label: "خطأ شائع: فقدان الجذع", cue: "أسفل الظهر يتقوس ويفقد الحماية", figure: "default", mistake: "sag" },
    ],
  },
};

export function getPostureVariants(id: string) {
  return VARIANTS[id as PostureExerciseId] ?? VARIANTS.default;
}

/* ============ COMPONENT ============ */

export function PostureCompare({
  exerciseId,
  size = 160,
}: {
  exerciseId: string;
  size?: number;
}) {
  const { correct, mistakes } = getPostureVariants(exerciseId);
  return (
    <div className="space-y-3">
      <PostureCard variant={correct} tone="correct" size={size} />
      {mistakes.map((m, i) => (
        <PostureCard key={i} variant={m} tone="wrong" size={size} />
      ))}
    </div>
  );
}

function PostureCard({
  variant,
  tone,
  size,
}: {
  variant: Variant;
  tone: "correct" | "wrong";
  size: number;
}) {
  const isOk = tone === "correct";
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 flex items-center gap-4 ${
        isOk
          ? "border-primary/40 bg-primary/5"
          : "border-destructive/40 bg-destructive/5"
      }`}
    >
      {/* HUD grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          color: isOk ? NEON : DANGER,
        }}
        aria-hidden
      />

      <div className="relative shrink-0">
        <PostureFigure variant={variant} tone={tone} size={size} />
      </div>

      <div className="relative flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <StatusIcon tone={tone} />
          <p className={`font-black text-sm ${isOk ? "text-primary" : "text-destructive"}`}>
            {variant.label}
          </p>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-1.5">{variant.cue}</p>
      </div>
    </div>
  );
}

function StatusIcon({ tone }: { tone: "correct" | "wrong" }) {
  if (tone === "correct") {
    return (
      <span
        className="grid place-items-center size-6 rounded-full bg-primary text-primary-foreground shadow-[0_0_12px_rgba(204,255,0,0.6)]"
        aria-label="صحيح"
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className="grid place-items-center size-6 rounded-full bg-destructive text-destructive-foreground"
      aria-label="خطأ"
    >
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </span>
  );
}

/* ============ FIGURES ============ */

function PostureFigure({
  variant,
  tone,
  size,
}: {
  variant: Variant;
  tone: "correct" | "wrong";
  size: number;
}) {
  const uid = `pc-${variant.figure}-${variant.mistake ?? "ok"}`;
  return (
    <svg viewBox="0 0 140 140" width={size} height={size}>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </linearGradient>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GEAR_HI} />
          <stop offset="100%" stopColor={GEAR} />
        </linearGradient>
      </defs>

      {/* ground line */}
      <line x1="10" y1="128" x2="130" y2="128" stroke={tone === "correct" ? NEON : DANGER} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />

      {variant.figure === "pushup" && <PushupSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "squat" && <SquatSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "plank" && <PlankSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "pullup" && <PullupSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "lunge" && <LungeSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "bridge" && <BridgeSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "row" && <RowSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "default" && <DefaultSVG uid={uid} mistake={variant.mistake} tone={tone} />}

      {/* alignment reference line — green for correct, red dashed for wrong */}
      {variant.figure === "pushup" && (
        <AlignmentLine tone={tone} path={
          variant.mistake === "sag" ? "M28,70 Q70,105 118,70" :
          variant.mistake === "hips-high" ? "M28,72 Q70,32 118,72" :
          "M28,70 L118,70"
        } />
      )}
      {variant.figure === "plank" && (
        <AlignmentLine tone={tone} path={
          variant.mistake === "sag" ? "M22,74 Q70,110 122,74" :
          variant.mistake === "hips-high" ? "M22,76 Q70,28 122,76" :
          "M22,74 L122,74"
        } />
      )}

      {/* warning marker on wrong joint */}
      {tone === "wrong" && <WarningMarker mistake={variant.mistake} figure={variant.figure} />}
    </svg>
  );
}

function AlignmentLine({ tone, path }: { tone: "correct" | "wrong"; path: string }) {
  const color = tone === "correct" ? NEON : DANGER;
  return (
    <path
      d={path}
      stroke={color}
      strokeWidth="1.5"
      strokeDasharray="4 3"
      fill="none"
      opacity="0.85"
    />
  );
}

function WarningMarker({
  mistake,
  figure,
}: {
  mistake?: Variant["mistake"];
  figure: Variant["figure"];
}) {
  // pick a coordinate to flag per mistake+figure
  const spots: Record<string, { x: number; y: number }> = {
    "pushup-sag": { x: 70, y: 92 },
    "pushup-flare": { x: 46, y: 60 },
    "pushup-hips-high": { x: 70, y: 42 },
    "squat-knees-in": { x: 68, y: 90 },
    "squat-heels-up": { x: 92, y: 118 },
    "squat-back-round": { x: 66, y: 46 },
    "squat-knee-forward": { x: 84, y: 90 },
    "plank-sag": { x: 70, y: 96 },
    "plank-hips-high": { x: 70, y: 40 },
    "pullup-swing": { x: 90, y: 82 },
    "pullup-sag": { x: 70, y: 96 },
    "lunge-knee-forward": { x: 92, y: 92 },
    "bridge-back-round": { x: 60, y: 80 },
    "row-back-round": { x: 60, y: 62 },
    "default-sag": { x: 70, y: 90 },
  };
  const key = `${figure}-${mistake ?? ""}`;
  const spot = spots[key] ?? { x: 70, y: 70 };
  return (
    <g>
      <circle
        cx={spot.x}
        cy={spot.y}
        r="12"
        fill="none"
        stroke={DANGER}
        strokeWidth="2"
        opacity="0.9"
      >
        <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.9;0.2;0.9" dur="2s" repeatCount="indefinite" />
      </circle>
      <g transform={`translate(${spot.x - 6}, ${spot.y - 20})`}>
        <path d="M6 0 L12 12 L0 12 Z" fill={DANGER} />
        <text x="6" y="10" fontSize="9" fontWeight="900" fill="#fff" textAnchor="middle">!</text>
      </g>
    </g>
  );
}

/* ---------- individual figures ---------- */

function limb(color: string, d: string, w = 6) {
  return <path d={d} stroke={color} strokeWidth={w} strokeLinecap="round" fill="none" />;
}

function PushupSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  // hip Y based on mistake
  const hipY = mistake === "sag" ? 92 : mistake === "hips-high" ? 42 : 70;
  const elbow = mistake === "flare" ? { x: 46, y: 78 } : { x: 46, y: 92 };
  return (
    <g>
      {/* torso */}
      <path
        d={`M28 68 Q50 ${hipY - 6} 70 ${hipY} Q92 ${hipY - 4} 118 68 L118 76 Q92 ${hipY + 4} 70 ${hipY + 8} Q50 ${hipY + 2} 28 76 Z`}
        fill={`url(#${uid})`}
        stroke={GEAR}
        strokeWidth="1.5"
      />
      {/* head */}
      <circle cx="20" cy="66" r="9" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* arm */}
      {limb(SKIN_SHADE, `M32 72 L${elbow.x} ${elbow.y} L34 120`, 5)}
      <circle cx="34" cy="122" r="4" fill={`url(#${uid}-g)`} />
      {/* legs */}
      {limb(SKIN_SHADE, `M110 ${hipY + 4} L124 122`, 5)}
      {limb(SKIN_SHADE, `M112 ${hipY + 6} L116 122`, 5)}
      <ellipse cx="120" cy="124" rx="6" ry="3" fill={`url(#${uid}-g)`} />
    </g>
  );
}

function SquatSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  const kneeX = mistake === "knees-in" ? 66 : 78;
  const kneeY = mistake === "knee-forward" ? 82 : 92;
  const heelOffset = mistake === "heels-up" ? 6 : 0;
  const torsoLean = mistake === "back-round" ? 16 : 0;
  return (
    <g>
      {/* head */}
      <circle cx={70 - torsoLean * 0.5} cy={22 + torsoLean * 0.3} r="10" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* torso */}
      <path
        d={`M56 32 Q${70 - torsoLean} ${44 + torsoLean * 0.5} 84 32 L88 66 L52 66 Z`}
        fill={`url(#${uid})`}
        stroke={GEAR}
        strokeWidth="1.5"
      />
      {/* arms extended forward */}
      {limb(SKIN_SHADE, `M58 46 Q40 56 34 62`, 5)}
      {limb(SKIN_SHADE, `M84 46 Q102 56 108 62`, 5)}
      {/* hips/glutes */}
      <ellipse cx="70" cy="72" rx="22" ry="10" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* thighs */}
      {limb(SKIN_SHADE, `M58 78 L${kneeX - 12} ${kneeY}`, 9)}
      {limb(SKIN_SHADE, `M82 78 L${kneeX + 12} ${kneeY}`, 9)}
      {/* shins */}
      {limb(SKIN_SHADE, `M${kneeX - 12} ${kneeY} L${kneeX - 14} ${124 - heelOffset}`, 8)}
      {limb(SKIN_SHADE, `M${kneeX + 12} ${kneeY} L${kneeX + 14} ${124 - heelOffset}`, 8)}
      {/* feet */}
      <ellipse cx={kneeX - 14} cy={126 - heelOffset} rx="10" ry="3" fill={`url(#${uid}-g)`} />
      <ellipse cx={kneeX + 14} cy={126 - heelOffset} rx="10" ry="3" fill={`url(#${uid}-g)`} />
      {/* alignment arrow */}
      {mistake === "knees-in" && (
        <path d="M60 96 L76 96" stroke={DANGER} strokeWidth="2" markerEnd="url(#arrow)" fill="none" />
      )}
    </g>
  );
}

function PlankSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  const hipY = mistake === "sag" ? 96 : mistake === "hips-high" ? 40 : 76;
  return (
    <g>
      <circle cx="22" cy="70" r="9" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      <path
        d={`M28 74 Q50 ${hipY - 6} 74 ${hipY} Q98 ${hipY - 2} 118 76 L120 84 Q98 ${hipY + 6} 74 ${hipY + 8} Q50 ${hipY + 2} 28 82 Z`}
        fill={`url(#${uid})`}
        stroke={GEAR}
        strokeWidth="1.5"
      />
      {/* forearms */}
      {limb(SKIN_SHADE, `M30 78 L26 108`, 5)}
      {limb(SKIN_SHADE, `M26 108 L48 112`, 5)}
      {/* legs */}
      {limb(SKIN_SHADE, `M110 ${hipY + 4} L124 122`, 6)}
      <ellipse cx="122" cy="124" rx="7" ry="3" fill={`url(#${uid}-g)`} />
    </g>
  );
}

function PullupSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  const swing = mistake === "swing" ? 8 : 0;
  return (
    <g>
      {/* bar */}
      <line x1="30" y1="18" x2="110" y2="18" stroke={NEON} strokeWidth="3" />
      <circle cx="30" cy="18" r="3" fill={GEAR} />
      <circle cx="110" cy="18" r="3" fill={GEAR} />
      {/* arms */}
      {limb(SKIN_SHADE, `M50 20 L${52 + swing} 46`, 5)}
      {limb(SKIN_SHADE, `M90 20 L${88 + swing} 46`, 5)}
      {/* head */}
      <circle cx={70 + swing} cy={38} r="10" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* torso */}
      <path
        d={`M${56 + swing} 48 L${84 + swing} 48 L${88 + swing} 88 L${52 + swing} 88 Z`}
        fill={`url(#${uid})`}
        stroke={GEAR}
        strokeWidth="1.5"
      />
      {/* legs */}
      {limb(SKIN_SHADE, `M${62 + swing} 90 L${64 + swing * 1.4} 120`, 7)}
      {limb(SKIN_SHADE, `M${78 + swing} 90 L${80 + swing * 1.4} 120`, 7)}
      {/* swing arc */}
      {mistake === "swing" && (
        <path d="M55 105 Q70 118 90 105" stroke={DANGER} strokeWidth="1.5" strokeDasharray="3 2" fill="none" />
      )}
    </g>
  );
}

function LungeSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  const frontKneeX = mistake === "knee-forward" ? 96 : 84;
  return (
    <g>
      <circle cx="70" cy="20" r="10" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      <path d="M58 30 L82 30 L86 70 L54 70 Z" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* front leg */}
      {limb(SKIN_SHADE, `M78 72 L${frontKneeX} 92`, 8)}
      {limb(SKIN_SHADE, `M${frontKneeX} 92 L${frontKneeX + 6} 124`, 8)}
      <ellipse cx={frontKneeX + 6} cy="126" rx="10" ry="3" fill={`url(#${uid}-g)`} />
      {/* back leg */}
      {limb(SKIN_SHADE, `M60 72 L44 100`, 8)}
      {limb(SKIN_SHADE, `M44 100 L36 124`, 8)}
      <ellipse cx="34" cy="126" rx="9" ry="3" fill={`url(#${uid}-g)`} />
      {/* arms */}
      {limb(SKIN_SHADE, `M58 42 L46 66`, 5)}
      {limb(SKIN_SHADE, `M82 42 L94 66`, 5)}
    </g>
  );
}

function BridgeSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  const hipY = mistake === "back-round" ? 62 : 72;
  return (
    <g>
      {/* head on floor */}
      <circle cx="20" cy="110" r="9" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* upper back on floor */}
      <path d={`M28 112 L60 108 Q66 ${hipY + 4} 78 ${hipY}`} stroke={SKIN_SHADE} strokeWidth="12" fill="none" strokeLinecap="round" />
      {/* torso plate */}
      <path
        d={`M28 108 Q50 100 60 ${hipY + 10} L78 ${hipY + 2} Q80 ${hipY - 4} 76 ${hipY - 6} L62 ${hipY + 4} Q42 106 26 114 Z`}
        fill={`url(#${uid})`}
        opacity="0.85"
      />
      {/* thighs */}
      {limb(SKIN_SHADE, `M78 ${hipY} L100 ${hipY + 12}`, 10)}
      {/* shins vertical */}
      {limb(SKIN_SHADE, `M100 ${hipY + 12} L108 124`, 9)}
      <ellipse cx="108" cy="126" rx="10" ry="3" fill={`url(#${uid}-g)`} />
    </g>
  );
}

function RowSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  const backCurve = mistake === "back-round" ? "Q60 50 96 62" : "L96 60";
  return (
    <g>
      {/* bench */}
      <rect x="20" y="88" width="90" height="6" fill={`url(#${uid}-g)`} rx="2" />
      <line x1="26" y1="94" x2="26" y2="120" stroke={GEAR_HI} strokeWidth="3" />
      <line x1="104" y1="94" x2="104" y2="120" stroke={GEAR_HI} strokeWidth="3" />
      {/* torso bent */}
      <path d={`M32 62 ${backCurve} L100 68 L34 70 Z`} fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* head */}
      <circle cx="26" cy="58" r="8" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {/* support arm on bench */}
      {limb(SKIN_SHADE, `M52 72 L52 88`, 5)}
      {/* pulling arm with dumbbell */}
      {limb(SKIN_SHADE, `M90 68 L110 84`, 5)}
      <rect x="106" y="80" width="12" height="10" rx="2" fill={GEAR} />
      {/* leg supporting */}
      {limb(SKIN_SHADE, `M68 88 L74 122`, 7)}
      <ellipse cx="76" cy="124" rx="8" ry="3" fill={`url(#${uid}-g)`} />
    </g>
  );
}

function DefaultSVG({ uid, mistake, tone }: { uid: string; mistake?: Variant["mistake"]; tone: "correct" | "wrong" }) {
  const spineCurve = mistake === "sag" ? "Q70 92 72 116" : "L72 116";
  return (
    <g>
      <circle cx="70" cy="30" r="12" fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      <path d={`M56 44 L84 44 L88 88 L52 88 Z`} fill={`url(#${uid})`} stroke={GEAR} strokeWidth="1.5" />
      {limb(SKIN_SHADE, `M56 56 L40 88`, 6)}
      {limb(SKIN_SHADE, `M84 56 L100 88`, 6)}
      <path d={`M70 88 ${spineCurve}`} stroke={SKIN_SHADE} strokeWidth="10" strokeLinecap="round" fill="none" />
      {limb(SKIN_SHADE, `M60 116 L54 126`, 8)}
      {limb(SKIN_SHADE, `M80 116 L86 126`, 8)}
    </g>
  );
}

/* ============ BEFORE / AFTER SLIDER ============ */

export function PostureSlider({
  exerciseId,
  size = 260,
}: {
  exerciseId: string;
  mistakeIndex?: number;
  size?: number;
}) {
  const { correct, mistakes } = getPostureVariants(exerciseId);
  const wrong = mistakes[0] ?? correct;
  const [pos, setPos] = useState(50); // 0 = all wrong, 100 = all correct
  const boxRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = boxRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const raw = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(4, Math.min(96, raw)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    updateFromClientX(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  };

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative w-full rounded-2xl border border-border bg-card overflow-hidden select-none touch-none cursor-ew-resize"
        style={{ aspectRatio: "1 / 1", maxWidth: size, marginInline: "auto" }}
        role="slider"
        aria-label="مقارنة قبل/بعد للوضعية"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
      >
        {/* WRONG (base) — full width */}
        <div className="absolute inset-0 bg-destructive/5">
          <SliderHUD tone="wrong" />
          <div className="absolute inset-0 grid place-items-center">
            <svg viewBox="0 0 140 140" width="90%" height="90%">
              <line x1="10" y1="128" x2="130" y2="128" stroke={DANGER} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />
              <FigureBody variant={wrong} tone="wrong" />
            </svg>
          </div>
          <SliderCornerLabel tone="wrong" label="خطأ" cue={wrong.cue} side="left" />
        </div>

        {/* CORRECT (clipped by pos) */}
        <div
          className="absolute inset-0 bg-primary/5"
          style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
        >
          <SliderHUD tone="correct" />
          <div className="absolute inset-0 grid place-items-center">
            <svg viewBox="0 0 140 140" width="90%" height="90%">
              <line x1="10" y1="128" x2="130" y2="128" stroke={NEON} strokeOpacity="0.35" strokeWidth="1.5" strokeDasharray="3 3" />
              <FigureBody variant={correct} tone="correct" />
            </svg>
          </div>
          <SliderCornerLabel tone="correct" label="صحيح" cue={correct.cue} side="right" />
        </div>

        {/* Divider + handle */}
        <div
          className="absolute top-0 bottom-0 pointer-events-none"
          style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
        >
          <div className="w-[2px] h-full bg-primary/90 shadow-[0_0_12px_rgba(204,255,0,0.6)]" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-10 rounded-full bg-background border-2 border-primary grid place-items-center shadow-[0_0_18px_rgba(204,255,0,0.55)]"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={NEON} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 6 9 12 15 18" />
              <polyline points="9 6 15 12 9 18" transform="translate(0 0)" />
            </svg>
          </div>
        </div>
      </div>

      {/* Range fallback for keyboards / accessibility */}
      <div className="px-1 flex items-center gap-3">
        <span className="text-[9px] font-mono uppercase tracking-widest text-destructive">خطأ</span>
        <input
          type="range"
          min={4}
          max={96}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          className="flex-1 accent-primary"
          aria-label="نسبة المقارنة"
        />
        <span className="text-[9px] font-mono uppercase tracking-widest text-primary">صحيح</span>
      </div>
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
        اسحب المؤشر لمقارنة الوضعية
      </p>
    </div>
  );
}

function SliderHUD({ tone }: { tone: "correct" | "wrong" }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 opacity-20"
      style={{
        backgroundImage:
          "linear-gradient(currentColor 1px, transparent 1px), linear-gradient(90deg, currentColor 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        color: tone === "correct" ? NEON : DANGER,
      }}
      aria-hidden
    />
  );
}

function SliderCornerLabel({
  tone,
  label,
  cue,
  side,
}: {
  tone: "correct" | "wrong";
  label: string;
  cue: string;
  side: "left" | "right";
}) {
  const isOk = tone === "correct";
  return (
    <div className={`absolute top-2 ${side === "left" ? "left-2" : "right-2"} max-w-[45%]`}>
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-black ${
          isOk
            ? "bg-primary text-primary-foreground shadow-[0_0_10px_rgba(204,255,0,0.55)]"
            : "bg-destructive text-destructive-foreground"
        }`}
      >
        <span>{isOk ? "✓" : "✕"}</span>
        <span>{label}</span>
      </div>
      <p className={`mt-1 text-[9px] leading-tight ${isOk ? "text-primary" : "text-destructive"}`}>
        {cue}
      </p>
    </div>
  );
}

function FigureBody({ variant, tone }: { variant: Variant; tone: "correct" | "wrong" }) {
  const uid = `psl-${variant.figure}-${variant.mistake ?? "ok"}-${tone}`;
  return (
    <>
      <defs>
        <linearGradient id={uid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </linearGradient>
        <linearGradient id={`${uid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={GEAR_HI} />
          <stop offset="100%" stopColor={GEAR} />
        </linearGradient>
      </defs>
      {variant.figure === "pushup" && <PushupSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "squat" && <SquatSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "plank" && <PlankSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "pullup" && <PullupSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "lunge" && <LungeSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "bridge" && <BridgeSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "row" && <RowSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {variant.figure === "default" && <DefaultSVG uid={uid} mistake={variant.mistake} tone={tone} />}
      {tone === "wrong" && <WarningMarker mistake={variant.mistake} figure={variant.figure} />}
    </>
  );
}
