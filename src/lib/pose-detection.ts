/**
 * Pose-detection architecture stubs.
 *
 * No CV runs today. This file defines the interfaces the future implementation
 * (MediaPipe/TFJS/MoveNet) will fulfill — so UI, scoring, and voice-feedback
 * layers can be built against a stable contract now.
 */

export interface Keypoint {
  name:
    | "nose"
    | "leftShoulder" | "rightShoulder"
    | "leftElbow" | "rightElbow"
    | "leftWrist" | "rightWrist"
    | "leftHip" | "rightHip"
    | "leftKnee" | "rightKnee"
    | "leftAnkle" | "rightAnkle";
  x: number; // normalized 0-1
  y: number; // normalized 0-1
  score: number; // confidence 0-1
}

export interface PoseFrame {
  ts: number;
  keypoints: Keypoint[];
}

export interface FormFeedback {
  score: number; // 0-100
  issues: { joint: Keypoint["name"]; message: string; severity: "low" | "high" }[];
  cues: string[];
}

export interface PoseDetector {
  start(videoEl: HTMLVideoElement): Promise<void>;
  stop(): void;
  onFrame(cb: (frame: PoseFrame) => void): () => void;
}

export interface FormAnalyzer {
  analyze(frame: PoseFrame, exerciseId: string): FormFeedback;
}

/** No-op detector so callers can wire the pipeline immediately. */
export const noopDetector: PoseDetector = {
  async start() {
    /* future: init tfjs/mediapipe */
  },
  stop() {},
  onFrame() {
    return () => {};
  },
};

export const noopAnalyzer: FormAnalyzer = {
  analyze() {
    return { score: 0, issues: [], cues: [] };
  },
};

export function speakCue(text: string) {
  if (typeof window === "undefined") return;
  if (!("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    u.rate = 1;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore */
  }
}
