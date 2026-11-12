/**
 * Optional, device-only exercise motion library.
 *
 * Each exercise ID can have one explicitly chosen licensed video or GIF.
 * Files live in IndexedDB as Blob values, never in localStorage, Supabase,
 * training backups or the cloud. Android's SAF picker grants access only to
 * the selected file. Browser/device deletion removes local media.
 *
 * Source identification is USER-CURATED: checking a file's container and
 * metadata does not prove that its movement matches the exercise.
 */
import { getExercise } from "./exercise-db";

export const LOCAL_MOTION_CHANGED_EVENT = "aura-local-motion-changed";
export const LOCAL_MOTION_MAX_BYTES = 80 * 1024 * 1024;
const DB = "aura-fit-local-exercise-motion";
const STORE = "motions";
const VERSION = 1;

export type LocalMotionKind = "mp4" | "webm" | "gif";
export interface LocalExerciseMotion {
  exerciseId: string;
  blob: Blob;
  kind: LocalMotionKind;
  fileName: string;
  storedAt: number;
}

function openStore(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("متصفح هذا الجهاز لا يدعم حفظ مقاطع التمارين محليًا."));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE, { keyPath: "exerciseId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح مكتبة الفيديو المحلية."));
    request.onblocked = () => reject(new Error("أغلق علامات التبويب الأخرى للتطبيق ثم حاول مرة أخرى."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("تعذرت قراءة الفيديو المحلي."));
  });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("تعذر حفظ الملف."));
    transaction.onabort = () => reject(transaction.error ?? new Error("أُلغي حفظ الملف."));
  });
}

function notify(exerciseId: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(LOCAL_MOTION_CHANGED_EVENT, { detail: { exerciseId } }));
  }
}

export async function loadLocalExerciseMotion(exerciseId: string): Promise<LocalExerciseMotion | null> {
  if (!getExercise(exerciseId)) return null;
  const db = await openStore();
  try {
    const tx = db.transaction(STORE, "readonly");
    const record = await requestResult<LocalExerciseMotion | undefined>(
      tx.objectStore(STORE).get(exerciseId),
    );
    if (!record || record.exerciseId !== exerciseId || !(record.blob instanceof Blob) ||
        !["mp4", "webm", "gif"].includes(record.kind)) return null;
    return record;
  } finally {
    db.close();
  }
}

async function inspectFile(file: File): Promise<LocalMotionKind> {
  if (!file || file.size < 24 || file.size > LOCAL_MOTION_MAX_BYTES) {
    throw new Error("اختر ملف حركة صالحًا لا يتجاوز 80 ميجابايت.");
  }
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...head.slice(start, end));
  const extension = file.name.toLowerCase().split(".").pop();
  let kind: LocalMotionKind;
  if (extension === "mp4" && ascii(4, 8) === "ftyp") kind = "mp4";
  else if (extension === "webm" && head[0] === 0x1a && head[1] === 0x45 &&
    head[2] === 0xdf && head[3] === 0xa3) kind = "webm";
  else if (extension === "gif" && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) kind = "gif";
  else throw new Error("الصيغة غير مدعومة أو محتوى الملف لا يطابق امتداده. استخدم MP4 أو WebM أو GIF.");

  // Validate decodability before overwriting a previously working file.
  const temporary = URL.createObjectURL(file);
  try {
    if (kind === "gif") {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();
        const timeout = window.setTimeout(() => reject(new Error("انتهت مهلة قراءة الصورة.")), 15000);
        image.onload = () => { clearTimeout(timeout); if (image.naturalWidth) resolve();
          else reject(new Error("ملف GIF ليس صورة صالحة.")); };
        image.onerror = () => { clearTimeout(timeout); reject(new Error("فشل فك ترميز GIF.")); };
        image.src = temporary;
      });
    } else {
      await new Promise<void>((resolve, reject) => {
        const video = document.createElement("video");
        video.muted = true;
        video.preload = "metadata";
        const cleanup = () => { video.removeAttribute("src"); video.load(); };
        const timeout = window.setTimeout(() => {
          cleanup(); reject(new Error("انتهت مهلة قراءة الفيديو. جرّب MP4 بترميز H.264."));
        }, 18000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          if (!video.videoWidth || !video.videoHeight ||
              !Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 1200) {
            cleanup(); reject(new Error("الفيديو بلا صورة أو مدته غير صالحة (الحد 20 دقيقة)."));
            return;
          }
          cleanup(); resolve();
        };
        video.onerror = () => {
          clearTimeout(timeout); cleanup();
          reject(new Error("الفيديو غير قابل للتشغيل على هذا الجهاز. جرّب MP4 بترميز H.264."));
        };
        video.src = temporary;
        video.load();
      });
    }
  } finally {
    URL.revokeObjectURL(temporary);
  }
  return kind;
}

/**
 * Import is always attached to an existing catalog ID. No URL matching,
 * heuristic cross-exercise mapping or automatic reassignment.
 */
export async function importLocalExerciseMotion(
  exerciseId: string,
  file: File,
): Promise<LocalExerciseMotion> {
  if (!getExercise(exerciseId)) throw new Error("التمرين غير موجود في المكتبة.");
  const kind = await inspectFile(file);
  const mime = kind === "mp4" ? "video/mp4" : kind === "webm" ? "video/webm" : "image/gif";
  const entry: LocalExerciseMotion = {
    exerciseId,
    kind,
    // Android SAF can return application/octet-stream. Restore the verified
    // content type so Chrome/WebView can decode this blob URL.
    blob: file.type === mime ? file : new Blob([file], { type: mime }),
    fileName: file.name.slice(0, 180),
    storedAt: Date.now(),
  };
  const db = await openStore();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const completion = completed(tx);
    tx.objectStore(STORE).put(entry);
    await completion;
  } catch (error) {
    if (error instanceof DOMException && error.name === "QuotaExceededError") {
      throw new Error("لا توجد مساحة كافية لحفظ الحركة؛ امسح بعض الملفات المحلية أولًا.");
    }
    throw error;
  } finally {
    db.close();
  }
  notify(exerciseId);
  return entry;
}

export async function deleteLocalExerciseMotion(exerciseId: string): Promise<void> {
  if (!getExercise(exerciseId)) return;
  const db = await openStore();
  try {
    const tx = db.transaction(STORE, "readwrite");
    const completion = completed(tx);
    tx.objectStore(STORE).delete(exerciseId);
    await completion;
  } finally {
    db.close();
  }
  notify(exerciseId);
}

export async function countLocalExerciseMotions(): Promise<number> {
  const db = await openStore();
  try {
    return await requestResult<number>(db.transaction(STORE, "readonly").objectStore(STORE).count());
  } finally {
    db.close();
  }
}
