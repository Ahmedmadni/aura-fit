import pushup from "../../public/motion/pushup.mp4.asset.json";
import squat from "../../public/motion/squat.mp4.asset.json";
import plank from "../../public/motion/plank.mp4.asset.json";
import warmup from "../../public/motion/warmup.mp4.asset.json";
import cooldown from "../../public/motion/cooldown.mp4.asset.json";
import burpee from "../../public/motion/burpee.mp4.asset.json";
import pushupEx from "../assets/exercises/pushup.mp4.asset.json";
import lungeEx from "../assets/exercises/lunge.mp4.asset.json";
import pullupEx from "../assets/exercises/pullup.mp4.asset.json";
import squatEx from "../assets/exercises/bodyweight-squat.mp4.asset.json";
import plankEx from "../assets/exercises/plank.mp4.asset.json";
import burpeeEx from "../assets/exercises/burpee.mp4.asset.json";
import wallPushupEx from "../assets/exercises/wall-pushup.mp4.asset.json";

export type ExerciseVideoStatus = "ready" | "temporary" | "pending";

type ExerciseVideo = {
  src: string | null;
  status: ExerciseVideoStatus;
};

const temporaryByPattern: Record<string, string> = {
  "push-up": pushup.url,
  squat: squat.url,
  plank: plank.url,
  burpee: burpee.url,
  warmup: warmup.url,
  cooldown: cooldown.url,
  default: squat.url,
};

/**
 * One explicit slot per exercise. Replace a null with its generated asset URL
 * as each approved production batch is completed.
 */
export const EXERCISE_VIDEO_SLOTS: Record<string, ExerciseVideo> = {
  "wall-pushup": { src: wallPushupEx.url, status: "ready" },
  "incline-pushup": { src: null, status: "pending" },
  "knee-pushup": { src: null, status: "pending" },
  pushup: { src: pushupEx.url, status: "ready" },
  "diamond-pushup": { src: null, status: "pending" },
  "archer-pushup": { src: null, status: "pending" },
  "one-arm-pushup": { src: null, status: "pending" },
  "band-row": { src: null, status: "pending" },
  "australian-pullup": { src: null, status: "pending" },
  "negative-pullup": { src: null, status: "pending" },
  pullup: { src: pullupEx.url, status: "ready" },
  "weighted-pullup": { src: null, status: "pending" },
  "dumbbell-row": { src: null, status: "pending" },
  "bodyweight-squat": { src: squatEx.url, status: "ready" },
  "goblet-squat": { src: null, status: "pending" },
  "jump-squat": { src: null, status: "pending" },
  "pistol-squat": { src: null, status: "pending" },
  lunge: { src: lungeEx.url, status: "ready" },
  "reverse-lunge": { src: null, status: "pending" },
  "wall-sit": { src: null, status: "pending" },
  "glute-bridge": { src: null, status: "pending" },
  plank: { src: plankEx.url, status: "ready" },
  "side-plank": { src: null, status: "pending" },
  "dead-bug": { src: null, status: "pending" },
  "bird-dog": { src: null, status: "pending" },
  "mountain-climber": { src: null, status: "pending" },
  burpee: { src: burpeeEx.url, status: "ready" },
  "high-knees": { src: null, status: "pending" },
  "jumping-jack": { src: null, status: "pending" },
  "dynamic-warmup": { src: warmup.url, status: "temporary" },
  "cat-cow": { src: null, status: "pending" },
  "child-pose": { src: null, status: "pending" },
  "static-cooldown": { src: cooldown.url, status: "temporary" },
  "hip-opener": { src: null, status: "pending" },
};

export function resolveExerciseVideo(exerciseId: string | undefined, pose: string) {
  const exact = exerciseId ? EXERCISE_VIDEO_SLOTS[exerciseId] : undefined;
  if (exact?.src) return exact;

  return {
    src: temporaryByPattern[pose] ?? temporaryByPattern.default,
    status: "temporary" as const,
  };
}