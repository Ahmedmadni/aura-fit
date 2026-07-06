/**
 * Realistic human-figure demonstrations for the workout player.
 * Each pose animates between two keyframes (concentric ↔ eccentric)
 * to visualize the actual motion once the timer starts.
 *
 * More anatomically proportioned than the HUD icons in athlete-2d.tsx:
 * defined head/hair, neck, shoulders, chest, waist, quads, calves.
 */

type Pose =
  | "push-up"
  | "squat"
  | "plank"
  | "burpee"
  | "warmup"
  | "cooldown"
  | "default";

type Props = {
  pose: Pose;
  running: boolean;
  /** seconds per full rep cycle (down + up) */
  tempo?: number;
  size?: number;
};

const SKIN = "#f0c9a3";
const SKIN_SHADE = "#c48a5f";
const HAIR = "#1a1410";
const OUTFIT = "#0f1116";
const OUTFIT_HI = "#2a2f3a";
const NEON = "#ccff00";
const FLOOR = "rgba(204,255,0,0.5)";

export function AnimatedAthlete({ pose, running, tempo = 3, size = 260 }: Props) {
  const dur = `${tempo}s`;
  return (
    <svg
      viewBox="0 0 260 240"
      width={size}
      height={(size * 240) / 260}
      className="drop-shadow-[0_16px_28px_rgba(204,255,0,0.18)]"
      role="img"
      aria-label="عرض توضيحي للحركة"
    >
      <defs>
        <linearGradient id="skinG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKIN} />
          <stop offset="100%" stopColor={SKIN_SHADE} />
        </linearGradient>
        <linearGradient id="outfitG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={OUTFIT_HI} />
          <stop offset="100%" stopColor={OUTFIT} />
        </linearGradient>
        <radialGradient id="spot" cx="0.5" cy="1" r="0.7">
          <stop offset="0%" stopColor="rgba(204,255,0,0.15)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Spotlight + floor */}
      <rect x="0" y="0" width="260" height="240" fill="url(#spot)" />
      <line x1="20" y1="215" x2="240" y2="215" stroke={FLOOR} strokeWidth="1.5" />
      <line x1="20" y1="215" x2="240" y2="215" stroke={NEON} strokeDasharray="2 6" strokeWidth="1" opacity="0.4" />

      {/* Pose */}
      {(pose === "push-up") && <PushUpBody dur={dur} running={running} />}
      {(pose === "squat") && <SquatBody dur={dur} running={running} />}
      {(pose === "plank") && <PlankBody dur={dur} running={running} />}
      {(pose === "burpee") && <BurpeeBody dur={dur} running={running} />}
      {(pose === "warmup") && <WarmupBody dur={dur} running={running} />}
      {(pose === "cooldown") && <CooldownBody dur={dur} running={running} />}
      {(pose === "default") && <SquatBody dur={dur} running={running} />}

      {/* Motion HUD */}
      {running && (
        <g fill={NEON} opacity="0.7" fontFamily="ui-monospace, monospace" fontSize="8">
          <text x="18" y="20">◉ MOTION · LIVE</text>
          <text x="200" y="20">{tempo.toFixed(1)}s/rep</text>
        </g>
      )}
    </svg>
  );
}

/* ---------- Shared human primitives ---------- */

function Person({
  headCx = 130,
  headCy = 60,
  hair = true,
}: {
  headCx?: number;
  headCy?: number;
  hair?: boolean;
}) {
  return (
    <g>
      {/* Neck */}
      <rect x={headCx - 5} y={headCy + 8} width="10" height="10" fill="url(#skinG)" />
      {/* Head */}
      <ellipse cx={headCx} cy={headCy} rx="12" ry="14" fill="url(#skinG)" />
      {/* Hair */}
      {hair && (
        <path
          d={`M${headCx - 12} ${headCy - 4} Q${headCx} ${headCy - 20} ${headCx + 12} ${headCy - 4} Q${headCx + 8} ${headCy - 12} ${headCx} ${headCy - 14} Q${headCx - 8} ${headCy - 12} ${headCx - 12} ${headCy - 4} Z`}
          fill={HAIR}
        />
      )}
      {/* Face hint */}
      <circle cx={headCx - 4} cy={headCy - 1} r="1" fill="#2a1a10" />
      <circle cx={headCx + 4} cy={headCy - 1} r="1" fill="#2a1a10" />
    </g>
  );
}

/* ---------- PUSH-UP: body pivots at feet, chest lowers ---------- */

function PushUpBody({ dur, running }: { dur: string; running: boolean }) {
  return (
    <g transform="translate(0,0)">
      <g style={{ transformOrigin: "220px 210px" }}>
        {running && (
          <animateTransform
            attributeName="transform"
            type="rotate"
            values="-8 220 210; 4 220 210; -8 220 210"
            dur={dur}
            repeatCount="indefinite"
          />
        )}
        {/* Legs (from feet 220,215 to hips ~90,175) */}
        <path d="M85 165 L235 210 L235 218 L85 175 Z" fill="url(#outfitG)" />
        {/* Shorts */}
        <path d="M78 158 L145 168 L148 185 L82 178 Z" fill={OUTFIT} />
        {/* Torso */}
        <path d="M50 150 Q90 142 145 152 L142 175 Q90 172 48 170 Z" fill="url(#skinG)" />
        {/* Ab lines */}
        <line x1="90" y1="155" x2="90" y2="172" stroke={SKIN_SHADE} strokeWidth="0.8" opacity="0.6" />
        <line x1="75" y1="160" x2="105" y2="160" stroke={SKIN_SHADE} strokeWidth="0.5" opacity="0.5" />
        {/* Shoulder + arm supporting */}
        <ellipse cx="48" cy="155" rx="12" ry="10" fill="url(#skinG)" />
        <path d="M42 158 Q35 180 40 210 L58 212 Q56 182 58 160 Z" fill="url(#skinG)" />
        {/* Bicep bulge */}
        <ellipse cx="48" cy="180" rx="6" ry="9" fill={SKIN_SHADE} opacity="0.35" />
        {/* Head */}
        <Person headCx={40} headCy={140} />
        {/* Hand */}
        <ellipse cx="49" cy="212" rx="9" ry="5" fill="url(#skinG)" />
      </g>
      {/* Foot pivot */}
      <ellipse cx="235" cy="215" rx="10" ry="4" fill={OUTFIT} />
    </g>
  );
}

/* ---------- SQUAT: hips drop, knees bend ---------- */

function SquatBody({ dur, running }: { dur: string; running: boolean }) {
  return (
    <g>
      {/* Head + torso group descends */}
      <g>
        {running && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 22; 0 0"
            dur={dur}
            repeatCount="indefinite"
          />
        )}
        <Person headCx={130} headCy={45} />
        {/* Shoulders */}
        <ellipse cx="110" cy="78" rx="12" ry="9" fill="url(#skinG)" />
        <ellipse cx="150" cy="78" rx="12" ry="9" fill="url(#skinG)" />
        {/* Arms forward for balance */}
        <path d="M100 82 Q80 105 78 135 L92 138 Q95 108 112 88 Z" fill="url(#skinG)" />
        <path d="M160 82 Q180 105 182 135 L168 138 Q165 108 148 88 Z" fill="url(#skinG)" />
        {/* Torso with chest+abs */}
        <path d="M105 78 Q130 72 155 78 L162 145 Q130 155 98 145 Z" fill="url(#skinG)" />
        {/* Chest shadow */}
        <path d="M110 82 Q130 90 150 82 Q148 100 130 105 Q112 100 110 82 Z" fill={SKIN_SHADE} opacity="0.3" />
        {/* Ab lines */}
        <line x1="130" y1="105" x2="130" y2="145" stroke={SKIN_SHADE} strokeWidth="0.8" opacity="0.5" />
        {/* Shorts */}
        <path d="M98 143 L162 143 L167 168 L93 168 Z" fill={OUTFIT} />
      </g>
      {/* Thighs — squat down keyframes rotate at hip */}
      <g>
        {running && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 12; 0 0"
            dur={dur}
            repeatCount="indefinite"
          />
        )}
        <path d="M95 165 Q80 190 92 210 L118 210 Q116 190 118 165 Z" fill="url(#skinG)" />
        <path d="M142 165 Q144 190 142 210 L168 210 Q180 190 165 165 Z" fill="url(#skinG)" />
        {/* Quad definition */}
        <ellipse cx="105" cy="188" rx="8" ry="15" fill={SKIN_SHADE} opacity="0.25" />
        <ellipse cx="155" cy="188" rx="8" ry="15" fill={SKIN_SHADE} opacity="0.25" />
      </g>
      {/* Calves + feet stationary */}
      <path d="M92 210 L96 235 L118 235 L118 210 Z" fill="url(#skinG)" />
      <path d="M142 210 L142 235 L164 235 L168 210 Z" fill="url(#skinG)" />
      <ellipse cx="107" cy="237" rx="14" ry="4" fill={OUTFIT} />
      <ellipse cx="153" cy="237" rx="14" ry="4" fill={OUTFIT} />
    </g>
  );
}

/* ---------- PLANK: subtle breathing hold ---------- */

function PlankBody({ dur, running }: { dur: string; running: boolean }) {
  return (
    <g transform="translate(0,10)">
      <g>
        {running && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -2; 0 0"
            dur={dur}
            repeatCount="indefinite"
          />
        )}
        {/* Legs */}
        <path d="M120 165 L235 200 L235 208 L120 175 Z" fill="url(#outfitG)" />
        {/* Shorts */}
        <path d="M110 158 L165 168 L168 185 L112 178 Z" fill={OUTFIT} />
        {/* Torso */}
        <path d="M65 150 Q110 142 165 152 L162 175 Q110 172 63 170 Z" fill="url(#skinG)" />
        <line x1="110" y1="155" x2="110" y2="172" stroke={SKIN_SHADE} strokeWidth="0.8" opacity="0.5" />
        {/* Supporting forearm */}
        <path d="M55 168 L90 168 L90 210 L55 210 Z" fill="url(#skinG)" />
        <path d="M60 150 Q52 170 58 200 L78 200 Q80 170 72 150 Z" fill="url(#skinG)" />
        {/* Head */}
        <Person headCx={60} headCy={138} />
      </g>
      <ellipse cx="235" cy="212" rx="10" ry="4" fill={OUTFIT} />
      <ellipse cx="72" cy="212" rx="20" ry="4" fill={OUTFIT} />
    </g>
  );
}

/* ---------- BURPEE: jump ↔ down ---------- */

function BurpeeBody({ dur, running }: { dur: string; running: boolean }) {
  return (
    <g>
      <g>
        {running && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -40; 0 0; 0 20; 0 0"
            dur={dur}
            repeatCount="indefinite"
          />
        )}
        <Person headCx={130} headCy={48} />
        {/* Arms up */}
        <path d="M105 78 Q85 40 78 20 L92 15 Q102 40 115 82 Z" fill="url(#skinG)" />
        <path d="M155 78 Q175 40 182 20 L168 15 Q158 40 145 82 Z" fill="url(#skinG)" />
        {/* Torso */}
        <path d="M108 78 Q130 72 152 78 L158 148 Q130 158 102 148 Z" fill="url(#skinG)" />
        <line x1="130" y1="105" x2="130" y2="148" stroke={SKIN_SHADE} strokeWidth="0.8" opacity="0.5" />
        {/* Shorts */}
        <path d="M102 146 L158 146 L162 170 L98 170 Z" fill={OUTFIT} />
        {/* Legs bent */}
        <path d="M98 168 Q88 195 98 215 L120 215 Q118 195 122 168 Z" fill="url(#skinG)" />
        <path d="M138 168 Q142 195 140 215 L162 215 Q172 195 162 168 Z" fill="url(#skinG)" />
      </g>
    </g>
  );
}

/* ---------- WARMUP: side-to-side jog ---------- */

function WarmupBody({ dur, running }: { dur: string; running: boolean }) {
  return (
    <g>
      <g>
        {running && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="-15 0; 15 0; -15 0"
            dur={dur}
            repeatCount="indefinite"
          />
        )}
        <Person headCx={130} headCy={50} />
        <ellipse cx="112" cy="82" rx="12" ry="9" fill="url(#skinG)" />
        <ellipse cx="148" cy="82" rx="12" ry="9" fill="url(#skinG)" />
        {/* Arms swinging */}
        <path d="M102 82 Q88 110 92 145 L106 148 Q106 115 114 88 Z" fill="url(#skinG)">
          {running && <animateTransform attributeName="transform" type="rotate" values="-25 105 82; 25 105 82; -25 105 82" dur={dur} repeatCount="indefinite" />}
        </path>
        <path d="M158 82 Q172 110 168 145 L154 148 Q154 115 146 88 Z" fill="url(#skinG)">
          {running && <animateTransform attributeName="transform" type="rotate" values="25 155 82; -25 155 82; 25 155 82" dur={dur} repeatCount="indefinite" />}
        </path>
        <path d="M108 82 Q130 76 152 82 L160 150 Q130 160 100 150 Z" fill="url(#skinG)" />
        <path d="M100 148 L160 148 L164 172 L96 172 Z" fill={OUTFIT} />
        {/* Legs alternating */}
        <path d="M100 170 L108 215 L124 215 L128 170 Z" fill="url(#skinG)">
          {running && <animateTransform attributeName="transform" type="translate" values="0 0; 0 -8; 0 0" dur={dur} repeatCount="indefinite" />}
        </path>
        <path d="M132 170 L136 215 L152 215 L160 170 Z" fill="url(#skinG)">
          {running && <animateTransform attributeName="transform" type="translate" values="0 -8; 0 0; 0 -8" dur={dur} repeatCount="indefinite" />}
        </path>
      </g>
    </g>
  );
}

/* ---------- COOLDOWN: seated forward fold, gentle breathing ---------- */

function CooldownBody({ dur, running }: { dur: string; running: boolean }) {
  return (
    <g>
      <g>
        {running && (
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0 0; 0 -3; 0 0"
            dur={dur}
            repeatCount="indefinite"
          />
        )}
        <Person headCx={110} headCy={130} />
        {/* Torso hinged forward */}
        <path d="M100 145 Q130 138 172 148 L180 172 Q130 178 92 172 Z" fill="url(#skinG)" />
        {/* Arms reaching to toes */}
        <path d="M102 155 Q125 178 180 200 L185 208 Q125 190 96 168 Z" fill="url(#skinG)" />
        {/* Legs straight seated */}
        <path d="M170 168 L235 200 L238 210 L168 185 Z" fill="url(#outfitG)" />
        <path d="M172 148 L230 168 L232 178 L170 165 Z" fill={OUTFIT} />
      </g>
      <ellipse cx="238" cy="212" rx="10" ry="4" fill={OUTFIT} />
    </g>
  );
}
