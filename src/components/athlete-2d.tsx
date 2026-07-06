/**
 * 2D illustrative athlete graphics — filled silhouettes with anatomical
 * shading rather than stick figures. Used across the Motion Coach views.
 */

type Pose =
  | "pull-up"
  | "push-up"
  | "squat"
  | "deadlift"
  | "plank"
  | "burpee"
  | "lunge"
  | "shoulder-press"
  | "default";

const SKIN = "#e9f5b0";
const SKIN_SHADE = "#a8c94a";
const GEAR = "#0f1116";
const GEAR_HI = "#2a2f3a";
const NEON = "#ccff00";

/* ---------- SHARED PRIMITIVES ---------- */

function BodyGradient({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={SKIN} />
        <stop offset="100%" stopColor={SKIN_SHADE} />
      </linearGradient>
      <linearGradient id={`${id}-gear`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={GEAR_HI} />
        <stop offset="100%" stopColor={GEAR} />
      </linearGradient>
    </defs>
  );
}

/* ---------- FULL POSE (large HUD figure) ---------- */

export type PoseSpot = { x: number; y: number; r?: number; label?: string };

export function AthletePose2D({
  pose,
  size = 240,
  spot,
}: {
  pose: Pose;
  size?: number;
  spot?: PoseSpot | null;
}) {
  const uid = `p-${pose}`;
  return (
    <svg viewBox="0 0 200 260" width={size} height={(size * 260) / 200} className="drop-shadow-[0_10px_25px_rgba(204,255,0,0.15)]">
      <BodyGradient id={uid} />
      {pose === "pull-up" && <PullUpFigure uid={uid} />}
      {pose === "push-up" && <PushUpFigure uid={uid} />}
      {pose === "squat" && <SquatFigure uid={uid} />}
      {pose === "deadlift" && <DeadliftFigure uid={uid} />}
      {pose === "plank" && <PlankFigure uid={uid} />}
      {pose === "burpee" && <BurpeeFigure uid={uid} />}
      {pose === "lunge" && <LungeFigure uid={uid} />}
      {pose === "shoulder-press" && <PressFigure uid={uid} />}
      {pose === "default" && <SquatFigure uid={uid} />}
      {spot && (
        <g pointerEvents="none">
          <circle
            cx={spot.x}
            cy={spot.y}
            r={spot.r ?? 22}
            fill="none"
            stroke={NEON}
            strokeWidth="2"
            opacity="0.9"
          >
            <animate attributeName="r" values={`${(spot.r ?? 22) - 4};${(spot.r ?? 22) + 6};${(spot.r ?? 22) - 4}`} dur="1.6s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;1;0.4" dur="1.6s" repeatCount="indefinite" />
          </circle>
          <circle cx={spot.x} cy={spot.y} r="3" fill={NEON} />
          {spot.label && (
            <text
              x={spot.x + (spot.r ?? 22) + 6}
              y={spot.y + 3}
              fill={NEON}
              fontSize="8"
              fontFamily="ui-monospace, monospace"
            >
              {spot.label}
            </text>
          )}
        </g>
      )}
    </svg>
  );
}

/* ---------- SMALL ICON (list rows) ---------- */

export function AthleteIcon2D({ pose, size = 40 }: { pose: Pose; size?: number }) {
  const uid = `i-${pose}`;
  return (
    <svg viewBox="0 0 200 260" width={size} height={(size * 260) / 200}>
      <BodyGradient id={uid} />
      <g opacity="0.95">
        {pose === "pull-up" && <PullUpFigure uid={uid} mini />}
        {pose === "push-up" && <PushUpFigure uid={uid} mini />}
        {pose === "squat" && <SquatFigure uid={uid} mini />}
        {pose === "deadlift" && <DeadliftFigure uid={uid} mini />}
        {pose === "plank" && <PlankFigure uid={uid} mini />}
        {pose === "burpee" && <BurpeeFigure uid={uid} mini />}
        {pose === "lunge" && <LungeFigure uid={uid} mini />}
        {pose === "shoulder-press" && <PressFigure uid={uid} mini />}
      </g>
    </svg>
  );
}

/* ---------- INDIVIDUAL POSES ---------- */

function Head({ cx, cy, r = 12 }: { cx: number; cy: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={SKIN} />
      <path d={`M${cx - r} ${cy - 2} a${r} ${r} 0 0 1 ${r * 2} 0 Z`} fill="#1a1d24" opacity="0.9" />
    </>
  );
}

function PullUpFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      {/* Bar */}
      <rect x="20" y="18" width="160" height="8" rx="2" fill={`url(#${uid}-gear)`} />
      <rect x="20" y="18" width="160" height="2" fill={NEON} opacity="0.5" />
      {/* Arms up */}
      <path d="M85 26 Q78 60 90 95 L110 95 Q122 60 115 26 Z" fill={`url(#${uid})`} />
      {/* Torso */}
      <path d="M78 95 Q100 90 122 95 L128 160 Q100 170 72 160 Z" fill={`url(#${uid})`} />
      {/* Shorts */}
      <path d="M72 158 L128 158 L132 190 Q100 198 68 190 Z" fill={GEAR} />
      {/* Legs bent */}
      <path d="M72 188 Q60 220 78 240 L92 240 Q88 220 92 188 Z" fill={`url(#${uid})`} />
      <path d="M108 188 Q112 220 108 240 L122 240 Q140 220 128 188 Z" fill={`url(#${uid})`} />
      {/* Head */}
      <Head cx={100} cy={38} r={13} />
      {!mini && (
        <g fill={NEON} opacity="0.7">
          <circle cx="88" cy="26" r="3">
            <animate attributeName="r" values="2;5;2" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx="112" cy="26" r="3">
            <animate attributeName="r" values="2;5;2" dur="1.8s" begin="0.3s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </g>
  );
}

function PushUpFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      {/* Floor line */}
      <rect x="10" y="215" width="180" height="2" fill={NEON} opacity="0.4" />
      {/* Body plank */}
      <path d="M35 155 L172 175 L180 195 L45 190 Z" fill={`url(#${uid})`} />
      {/* Shorts */}
      <path d="M115 172 L172 178 L178 200 L120 195 Z" fill={GEAR} />
      {/* Legs */}
      <path d="M160 185 L195 210 L188 218 L155 200 Z" fill={`url(#${uid})`} />
      {/* Arm supporting */}
      <path d="M40 155 Q35 180 42 210 L58 212 Q55 180 55 158 Z" fill={`url(#${uid})`} />
      <path d="M55 155 Q75 175 78 210 L92 212 Q88 180 68 155 Z" fill={`url(#${uid})`} />
      {/* Head */}
      <Head cx={30} cy={155} r={12} />
      {!mini && (
        <path d="M42 214 Q50 224 60 214" stroke={NEON} strokeWidth="2" fill="none" opacity="0.6">
          <animate attributeName="d" values="M42 214 Q50 224 60 214;M42 214 Q50 218 60 214;M42 214 Q50 224 60 214" dur="1.5s" repeatCount="indefinite" />
        </path>
      )}
    </g>
  );
}

function SquatFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      <rect x="10" y="240" width="180" height="2" fill={NEON} opacity="0.4" />
      {/* Head */}
      <Head cx={100} cy={42} r={13} />
      {/* Torso leaning forward */}
      <path d="M78 55 Q100 50 122 55 L135 130 Q100 140 65 130 Z" fill={`url(#${uid})`} />
      {/* Arms forward */}
      <path d="M78 70 Q55 100 55 140 L70 145 Q75 105 90 78 Z" fill={`url(#${uid})`} />
      <path d="M122 70 Q145 100 145 140 L130 145 Q125 105 110 78 Z" fill={`url(#${uid})`} />
      {/* Thighs squatting */}
      <path d="M68 128 Q55 175 78 200 L108 200 Q102 175 95 128 Z" fill={GEAR} />
      <path d="M132 128 Q145 175 122 200 L108 200 Q108 175 108 128 Z" fill={GEAR} opacity="0.9" />
      {/* Calves */}
      <path d="M78 198 L80 240 L100 240 L102 198 Z" fill={`url(#${uid})`} />
      <path d="M108 198 L110 240 L128 240 L122 198 Z" fill={`url(#${uid})`} />
      {!mini && (
        <g stroke={NEON} strokeWidth="1.5" fill="none" opacity="0.6">
          <path d="M55 145 L45 155">
            <animate attributeName="opacity" values="0;0.8;0" dur="1.2s" repeatCount="indefinite" />
          </path>
          <path d="M145 145 L155 155">
            <animate attributeName="opacity" values="0;0.8;0" dur="1.2s" repeatCount="indefinite" />
          </path>
        </g>
      )}
    </g>
  );
}

function DeadliftFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      <rect x="10" y="240" width="180" height="2" fill={NEON} opacity="0.4" />
      {/* Barbell */}
      <rect x="30" y="180" width="140" height="6" rx="1" fill={`url(#${uid}-gear)`} />
      <circle cx="35" cy="183" r="18" fill={GEAR} stroke={NEON} strokeWidth="1.5" />
      <circle cx="165" cy="183" r="18" fill={GEAR} stroke={NEON} strokeWidth="1.5" />
      <circle cx="35" cy="183" r="4" fill={NEON} opacity="0.6" />
      <circle cx="165" cy="183" r="4" fill={NEON} opacity="0.6" />
      {/* Head */}
      <Head cx={100} cy={55} r={13} />
      {/* Back straight torso hinged */}
      <path d="M80 68 Q100 62 120 68 L135 145 Q100 155 65 145 Z" fill={`url(#${uid})`} />
      {/* Arms down to bar */}
      <path d="M75 145 Q68 170 70 185 L82 185 Q82 170 88 148 Z" fill={`url(#${uid})`} />
      <path d="M125 145 Q132 170 130 185 L118 185 Q118 170 112 148 Z" fill={`url(#${uid})`} />
      {/* Legs slightly bent */}
      <path d="M68 143 Q60 190 75 240 L98 240 Q95 195 92 143 Z" fill={GEAR} />
      <path d="M132 143 Q140 190 125 240 L102 240 Q105 195 108 143 Z" fill={GEAR} />
    </g>
  );
}

function PlankFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      <rect x="10" y="215" width="180" height="2" fill={NEON} opacity="0.4" />
      <Head cx={32} cy={158} r={12} />
      {/* Long straight body */}
      <path d="M38 158 L172 172 L180 192 L45 188 Z" fill={`url(#${uid})`} />
      <path d="M115 170 L172 176 L178 196 L120 192 Z" fill={GEAR} />
      {/* Forearms grounded */}
      <path d="M20 178 L60 178 L60 210 L20 210 Z" fill={`url(#${uid})`} />
      <path d="M25 158 Q22 178 30 200 L48 200 Q50 178 42 158 Z" fill={`url(#${uid})`} />
      {/* Legs straight */}
      <path d="M160 188 L195 210 L188 216 L155 200 Z" fill={`url(#${uid})`} />
      {!mini && (
        <line x1="35" y1="145" x2="188" y2="180" stroke={NEON} strokeDasharray="3 4" strokeWidth="1" opacity="0.6">
          <animate attributeName="stroke-dashoffset" values="0;14" dur="1s" repeatCount="indefinite" />
        </line>
      )}
    </g>
  );
}

function BurpeeFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      <rect x="10" y="240" width="180" height="2" fill={NEON} opacity="0.4" />
      <Head cx={100} cy={38} r={13} />
      {/* Torso jumping */}
      <path d="M80 52 Q100 48 120 52 L128 120 Q100 128 72 120 Z" fill={`url(#${uid})`} />
      {/* Arms up spread */}
      <path d="M78 60 Q50 40 40 20 L52 15 Q68 35 92 65 Z" fill={`url(#${uid})`} />
      <path d="M122 60 Q150 40 160 20 L148 15 Q132 35 108 65 Z" fill={`url(#${uid})`} />
      {/* Shorts */}
      <path d="M72 118 L128 118 L132 155 L68 155 Z" fill={GEAR} />
      {/* Legs bent (mid-air) */}
      <path d="M72 152 Q60 190 70 225 L92 225 Q90 195 92 152 Z" fill={`url(#${uid})`} />
      <path d="M108 152 Q110 195 108 225 L130 225 Q140 190 128 152 Z" fill={`url(#${uid})`} />
      {!mini && (
        <g fill={NEON}>
          <circle cx="60" cy="240" r="2" opacity="0.6">
            <animate attributeName="cy" values="240;250;240" dur="1s" repeatCount="indefinite" />
          </circle>
          <circle cx="140" cy="240" r="2" opacity="0.6">
            <animate attributeName="cy" values="240;250;240" dur="1s" begin="0.3s" repeatCount="indefinite" />
          </circle>
        </g>
      )}
    </g>
  );
}

function LungeFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      <rect x="10" y="240" width="180" height="2" fill={NEON} opacity="0.4" />
      <Head cx={100} cy={42} r={13} />
      {/* Torso upright */}
      <path d="M80 55 Q100 50 120 55 L128 128 Q100 135 72 128 Z" fill={`url(#${uid})`} />
      {/* Arms at sides */}
      <path d="M75 65 Q60 100 68 140 L82 140 Q82 100 88 68 Z" fill={`url(#${uid})`} />
      <path d="M125 65 Q140 100 132 140 L118 140 Q118 100 112 68 Z" fill={`url(#${uid})`} />
      {/* Front leg bent 90° */}
      <path d="M100 128 Q60 150 50 200 L72 210 Q88 165 108 138 Z" fill={GEAR} />
      <path d="M50 200 L45 240 L72 240 L72 210 Z" fill={`url(#${uid})`} />
      {/* Back leg extended */}
      <path d="M100 128 Q140 150 165 210 L148 220 Q125 175 105 138 Z" fill={GEAR} opacity="0.9" />
      <path d="M148 218 L172 238 L158 240 L138 222 Z" fill={`url(#${uid})`} />
    </g>
  );
}

function PressFigure({ uid, mini }: { uid: string; mini?: boolean }) {
  return (
    <g>
      <rect x="10" y="240" width="180" height="2" fill={NEON} opacity="0.4" />
      <Head cx={100} cy={55} r={13} />
      {/* Arms up with dumbbells */}
      <path d="M78 68 Q65 40 68 15 L82 15 Q86 40 92 70 Z" fill={`url(#${uid})`} />
      <path d="M122 68 Q135 40 132 15 L118 15 Q114 40 108 70 Z" fill={`url(#${uid})`} />
      {/* Dumbbells */}
      <g fill={`url(#${uid}-gear)`}>
        <rect x="58" y="6" width="24" height="16" rx="2" />
        <rect x="118" y="6" width="24" height="16" rx="2" />
        <rect x="66" y="10" width="8" height="8" fill={NEON} opacity="0.7" />
        <rect x="126" y="10" width="8" height="8" fill={NEON} opacity="0.7" />
      </g>
      {/* Torso */}
      <path d="M80 65 Q100 60 120 65 L130 145 Q100 155 70 145 Z" fill={`url(#${uid})`} />
      {/* Shorts */}
      <path d="M70 142 L130 142 L133 175 L68 175 Z" fill={GEAR} />
      {/* Legs */}
      <path d="M72 172 L78 240 L98 240 L100 172 Z" fill={`url(#${uid})`} />
      <path d="M100 172 L102 240 L122 240 L128 172 Z" fill={`url(#${uid})`} />
      {!mini && (
        <g stroke={NEON} strokeWidth="1.5" fill="none" opacity="0.6">
          <path d="M70 10 L70 2">
            <animate attributeName="opacity" values="0;0.8;0" dur="1.2s" repeatCount="indefinite" />
          </path>
          <path d="M130 10 L130 2">
            <animate attributeName="opacity" values="0;0.8;0" dur="1.2s" repeatCount="indefinite" />
          </path>
        </g>
      )}
    </g>
  );
}

/* ---------- 2D ANATOMICAL MUSCLE MAP ---------- */

export type MuscleFocus = "chest" | "back" | "legs" | "shoulder" | "arms" | "core" | "full";

export function MuscleAnatomy2D({ primary, focus }: { primary: string; focus?: MuscleFocus | null }) {
  const isBack = focus ? focus === "back" : /ظهر/.test(primary);
  const isChest = focus ? focus === "chest" : /صدر/.test(primary);
  const isLegs = focus ? focus === "legs" : /فخذ|أرجل|ساق|مؤخر|أوتار/.test(primary);
  const isShoulder = focus ? focus === "shoulder" : /كتف/.test(primary);
  const isArms = focus ? focus === "arms" : /باي|ترايس|ذراع/.test(primary);
  const isCore = focus ? focus === "core" : /بطن|جذع/.test(primary);
  const isFull = focus ? focus === "full" : /كامل/.test(primary);

  const hi = (on: boolean) => (on ? NEON : "#2a2f3a");
  const glow = (on: boolean) => (on ? "url(#pulse)" : "none");

  return (
    <svg viewBox="0 0 200 320" className="w-40 h-64">
      <defs>
        <radialGradient id="body-bg" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0%" stopColor="#1a1d24" />
          <stop offset="100%" stopColor="#0a0b0f" />
        </radialGradient>
        <linearGradient id="pulse" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ccff00" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#ccff00" stopOpacity="0.4" />
        </linearGradient>
      </defs>

      {/* Body silhouette (front view) */}
      <g fill="url(#body-bg)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2">
        {/* Head */}
        <ellipse cx="100" cy="30" rx="18" ry="22" />
        {/* Neck */}
        <path d="M90 50 L90 62 L110 62 L110 50 Z" />
        {/* Torso */}
        <path d="M62 65 Q100 58 138 65 L142 165 Q100 178 58 165 Z" />
        {/* Arms */}
        <path d="M62 68 Q42 110 40 175 L58 178 Q62 118 76 72 Z" />
        <path d="M138 68 Q158 110 160 175 L142 178 Q138 118 124 72 Z" />
        {/* Hands */}
        <ellipse cx="49" cy="185" rx="10" ry="12" />
        <ellipse cx="151" cy="185" rx="10" ry="12" />
        {/* Waist / hips */}
        <path d="M60 162 L140 162 L138 200 L62 200 Z" />
        {/* Legs */}
        <path d="M62 198 Q56 250 68 310 L92 310 Q92 250 98 198 Z" />
        <path d="M138 198 Q144 250 132 310 L108 310 Q108 250 102 198 Z" />
      </g>

      {/* Muscle groups (2D anatomical shapes) */}
      <g>
        {/* Pectorals */}
        <path
          d="M72 75 Q100 72 128 75 Q130 100 100 108 Q70 100 72 75 Z"
          fill={hi(isChest || isFull)}
          opacity={isChest || isFull ? 0.85 : 0.25}
        >
          {(isChest || isFull) && (
            <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />
          )}
        </path>
        <line x1="100" y1="75" x2="100" y2="108" stroke="rgba(0,0,0,0.4)" strokeWidth="1" />

        {/* Deltoids */}
        <ellipse cx="66" cy="72" rx="10" ry="9" fill={hi(isShoulder || isFull)} opacity={isShoulder || isFull ? 0.85 : 0.25}>
          {(isShoulder || isFull) && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </ellipse>
        <ellipse cx="134" cy="72" rx="10" ry="9" fill={hi(isShoulder || isFull)} opacity={isShoulder || isFull ? 0.85 : 0.25}>
          {(isShoulder || isFull) && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </ellipse>

        {/* Biceps */}
        <ellipse cx="55" cy="105" rx="7" ry="14" fill={hi(isArms)} opacity={isArms ? 0.85 : 0.25}>
          {isArms && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </ellipse>
        <ellipse cx="145" cy="105" rx="7" ry="14" fill={hi(isArms)} opacity={isArms ? 0.85 : 0.25}>
          {isArms && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </ellipse>

        {/* Abs (6-pack) */}
        <g fill={hi(isCore || isFull)} opacity={isCore || isFull ? 0.85 : 0.28}>
          <rect x="88" y="112" width="10" height="10" rx="2" />
          <rect x="102" y="112" width="10" height="10" rx="2" />
          <rect x="88" y="125" width="10" height="10" rx="2" />
          <rect x="102" y="125" width="10" height="10" rx="2" />
          <rect x="88" y="138" width="10" height="10" rx="2" />
          <rect x="102" y="138" width="10" height="10" rx="2" />
          {(isCore || isFull) && (
            <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />
          )}
        </g>

        {/* Obliques (also hint at back / lats along side) */}
        <path d="M64 100 Q60 135 68 160 L78 160 Q76 130 78 100 Z" fill={hi(isBack)} opacity={isBack ? 0.8 : 0.22}>
          {isBack && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </path>
        <path d="M136 100 Q140 135 132 160 L122 160 Q124 130 122 100 Z" fill={hi(isBack)} opacity={isBack ? 0.8 : 0.22}>
          {isBack && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </path>

        {/* Quadriceps */}
        <path d="M68 205 Q60 250 72 285 L92 285 Q90 250 92 205 Z" fill={hi(isLegs || isFull)} opacity={isLegs || isFull ? 0.85 : 0.25}>
          {(isLegs || isFull) && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </path>
        <path d="M132 205 Q140 250 128 285 L108 285 Q110 250 108 205 Z" fill={hi(isLegs || isFull)} opacity={isLegs || isFull ? 0.85 : 0.25}>
          {(isLegs || isFull) && <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />}
        </path>
      </g>

      {/* HUD markers */}
      <g stroke={NEON} strokeWidth="0.8" opacity="0.5" fill="none">
        <line x1="10" y1="30" x2="80" y2="30" strokeDasharray="2 3" />
        <line x1="10" y1="90" x2="60" y2="90" strokeDasharray="2 3" />
        <line x1="10" y1="230" x2="65" y2="230" strokeDasharray="2 3" />
        <text x="10" y="27" fill={NEON} fontSize="6" fontFamily="monospace">C1 · CRANIUM</text>
        <text x="10" y="87" fill={NEON} fontSize="6" fontFamily="monospace">T1 · THORAX</text>
        <text x="10" y="227" fill={NEON} fontSize="6" fontFamily="monospace">L4 · FEMUR</text>
      </g>
    </svg>
  );
}
