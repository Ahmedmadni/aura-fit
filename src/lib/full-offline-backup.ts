/**
 * A portable, binary, offline-only Aura Fit backup format.
 *
 * Layout (little-endian):
 *   ASCII "AURA-FIT-FULL-ARCHIVE-V1\n"
 *   uint32 manifest JSON byte length
 *   UTF-8 JSON manifest: training v1 + per-exercise media metadata/hashes
 *   concatenated original MP4/WebM/GIF byte streams (manifest order)
 *
 * Blob.slice keeps large media in binary form, never embeds base64 in JSON,
 * and neither exports nor imports any cloud credentials.
 */
import {
  createLocalBackup, parseLocalBackup, restoreLocalBackup,
  serializeLocalBackup, type AuraLocalBackupV1,
} from "./local-backup";
import {
  commitLocalExerciseMotions,
  listLocalExerciseMotions,
  LOCAL_MOTION_MAX_BYTES,
  type LocalExerciseMotion,
  type LocalMotionKind,
} from "./local-exercise-videos";
import { getExercise } from "./exercise-db";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const MAGIC = ENCODER.encode("AURA-FIT-FULL-ARCHIVE-V1\n");
export const FULL_BACKUP_SUFFIX = ".afbackup";
export const MAX_FULL_BACKUP_BYTES = 512 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 10 * 1024 * 1024;
const MAX_MEDIA_COUNT = 302;
const HASH_FORMAT = /^[0-9a-f]{64}$/;

interface MotionManifest {
  exerciseId: string;
  kind: LocalMotionKind;
  fileName: string;
  bytes: number;
  sha256: string;
}
interface BackupManifest {
  format: "aura-fit-offline-full";
  version: 1;
  createdAt: string;
  training: AuraLocalBackupV1;
  media: MotionManifest[];
}
export interface ParsedFullBackup {
  training: AuraLocalBackupV1;
  records: LocalExerciseMotion[];
  mediaCount: number;
  totalBytes: number;
  createdAt: string;
}
export type BackupProgress = (completed: number, total: number) => void;

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, "0")).join("");
}
async function digest(blob: Blob): Promise<string> {
  // Upper bound is 80 MiB for each motion, not the whole archive.
  return hex(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
}
function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function mime(kind: LocalMotionKind) {
  return kind === "gif" ? "image/gif" : kind === "mp4" ? "video/mp4" : "video/webm";
}
async function validHeader(blob: Blob, kind: LocalMotionKind): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 32).arrayBuffer());
  const text = (start: number, end: number) =>
    String.fromCharCode(...head.slice(start, end));
  if (kind === "gif") return ["GIF87a", "GIF89a"].includes(text(0, 6));
  if (kind === "mp4") return text(4, 8) === "ftyp";
  return head[0] === 0x1a && head[1] === 0x45 &&
    head[2] === 0xdf && head[3] === 0xa3;
}
function validateManifest(value: unknown): BackupManifest {
  if (!isObject(value) || value.format !== "aura-fit-offline-full" ||
      value.version !== 1 || typeof value.createdAt !== "string" ||
      !Number.isFinite(Date.parse(value.createdAt)) ||
      !Array.isArray(value.media) || value.media.length > MAX_MEDIA_COUNT) {
    throw new Error("تنسيق الحزمة الاحتياطية غير صحيح أو غير مدعوم.");
  }
  const training = parseLocalBackup(JSON.stringify(value.training));
  const seen = new Set<string>();
  const entries: MotionManifest[] = value.media.map((input) => {
    if (!isObject(input) || typeof input.exerciseId !== "string" ||
        !getExercise(input.exerciseId) || seen.has(input.exerciseId) ||
        !["mp4", "webm", "gif"].includes(String(input.kind)) ||
        typeof input.fileName !== "string" || input.fileName.length > 180 ||
        !input.fileName || typeof input.bytes !== "number" ||
        !Number.isSafeInteger(input.bytes) ||
        input.bytes < 24 || input.bytes > LOCAL_MOTION_MAX_BYTES ||
        typeof input.sha256 !== "string" || !HASH_FORMAT.test(input.sha256)) {
      throw new Error("تفاصيل أحد مقاطع التمارين في النسخة غير صالحة.");
    }
    seen.add(input.exerciseId);
    return {
      exerciseId: input.exerciseId,
      kind: input.kind as LocalMotionKind,
      fileName: input.fileName,
      bytes: input.bytes as number,
      sha256: input.sha256,
    };
  });
  return {
    format: "aura-fit-offline-full",
    version: 1,
    createdAt: value.createdAt,
    training,
    media: entries,
  };
}

/**
 * Preserve every local video up to the explicit 512MiB archive ceiling. If
 * storage is larger, refuse rather than silently exclude media and claim the
 * backup is complete.
 */
export async function createFullBackup(
  progress?: BackupProgress,
): Promise<{ archive: Blob; mediaCount: number; totalBytes: number }> {
  if (!crypto?.subtle) throw new Error("هذا الجهاز لا يدعم فحص سلامة الملفات SHA-256.");
  const records = await listLocalExerciseMotions();
  if (records.length > MAX_MEDIA_COUNT) throw new Error("عدد ملفات الفيديو يتجاوز حد الحزمة.");
  const media: MotionManifest[] = [];
  const blobs: Blob[] = [];
  let sum = MAGIC.length + 4 + MAX_MANIFEST_BYTES;
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    if (!await validHeader(record.blob, record.kind)) {
      throw new Error("ملف حركة غير صالح: " + record.exerciseId);
    }
    sum += record.blob.size;
    if (sum > MAX_FULL_BACKUP_BYTES) {
      throw new Error("حجم الملفات المحلية يتجاوز 512 ميجابايت. احتفظ بملفات الفيديو الأصلية خارج التطبيق قبل تحديثه.");
    }
    media.push({
      exerciseId: record.exerciseId,
      kind: record.kind,
      fileName: record.fileName,
      bytes: record.blob.size,
      sha256: await digest(record.blob),
    });
    blobs.push(record.blob);
    progress?.(index + 1, records.length);
  }
  const manifest: BackupManifest = {
    format: "aura-fit-offline-full",
    version: 1,
    createdAt: new Date().toISOString(),
    training: createLocalBackup(),
    media,
  };
  const manifestBytes = ENCODER.encode(JSON.stringify(manifest));
  if (manifestBytes.length > MAX_MANIFEST_BYTES) {
    throw new Error("بيانات سجل التدريب تتجاوز الحد المسموح للحزمة.");
  }
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, manifestBytes.length, true);
  const archive = new Blob([MAGIC, length, manifestBytes, ...blobs],
    { type: "application/octet-stream" });
  if (archive.size > MAX_FULL_BACKUP_BYTES) {
    throw new Error("الحزمة أكبر من 512 ميجابايت؛ لن نحذف أي فيديو منها بشكل صامت.");
  }
  return { archive, mediaCount: media.length, totalBytes: archive.size };
}

/**
 * Full validation, including SHA-256 for ALL videos, happens before any
 * localStorage or IndexedDB mutation. No partial/corrupt archive is accepted.
 */
export async function inspectFullBackup(
  file: Blob,
  progress?: BackupProgress,
): Promise<ParsedFullBackup> {
  if (!crypto?.subtle || file.size > MAX_FULL_BACKUP_BYTES ||
      file.size < MAGIC.length + 4) {
    throw new Error("حزمة النسخة غير صالحة أو تتجاوز الحد الأقصى 512 ميجابايت.");
  }
  const prefix = new Uint8Array(await file.slice(0, MAGIC.length + 4).arrayBuffer());
  if (!MAGIC.every((value, index) => value === prefix[index])) {
    throw new Error("هذا الملف ليس حزمة Aura Fit احتياطية مدعومة.");
  }
  const manifestSize = new DataView(prefix.buffer).getUint32(MAGIC.length, true);
  if (!manifestSize || manifestSize > MAX_MANIFEST_BYTES ||
      MAGIC.length + 4 + manifestSize > file.size) {
    throw new Error("حزمة النسخة غير مكتملة أو حجم الفهرس غير صحيح.");
  }
  const manifestStart = MAGIC.length + 4;
  let parsed: unknown;
  try {
    parsed = JSON.parse(DECODER.decode(
      await file.slice(manifestStart, manifestStart + manifestSize).arrayBuffer(),
    ));
  } catch {
    throw new Error("فهرس النسخة الاحتياطية تالف أو غير قابل للقراءة.");
  }
  const manifest = validateManifest(parsed);
  const records: LocalExerciseMotion[] = [];
  let offset = manifestStart + manifestSize;
  for (let index = 0; index < manifest.media.length; index++) {
    const entry = manifest.media[index];
    if (offset + entry.bytes > file.size) {
      throw new Error("الحزمة ناقصة؛ لم يُعثر على جميع مقاطع التمارين.");
    }
    const data = file.slice(offset, offset + entry.bytes, mime(entry.kind));
    if (!await validHeader(data, entry.kind) ||
        await digest(data) !== entry.sha256) {
      throw new Error("فشل التحقق من سلامة حركة التمرين: " + entry.exerciseId);
    }
    records.push({
      exerciseId: entry.exerciseId,
      blob: data,
      kind: entry.kind,
      fileName: entry.fileName,
      storedAt: Date.now(),
    });
    offset += entry.bytes;
    progress?.(index + 1, manifest.media.length);
  }
  if (offset !== file.size) {
    throw new Error("تحتوي الحزمة على بيانات إضافية غير موثقة؛ تم رفض الاستعادة.");
  }
  return {
    training: manifest.training,
    records,
    mediaCount: records.length,
    totalBytes: file.size,
    createdAt: manifest.createdAt,
  };
}

/**
 * Explicitly confirmed restore. Merge videos by exercise ID, keep unrelated
 * local videos, and restore training data. If the second phase fails, try to
 * roll back both stores from in-memory snapshots (without cloud access).
 */
export async function restoreFullBackup(verified: ParsedFullBackup) {
  // Re-validate the caller's parsed training data before touching storage.
  const trainingJSON = JSON.stringify(verified.training);
  parseLocalBackup(trainingJSON);
  const oldTraining = serializeLocalBackup();
  const before = await listLocalExerciseMotions();
  const oldById = new Map(before.map((record) => [record.exerciseId, record]));
  const removedOnRollback = verified.records
    .filter((record) => !oldById.has(record.exerciseId))
    .map((record) => record.exerciseId);
  const oldOverwritten = verified.records
    .map((record) => oldById.get(record.exerciseId))
    .filter((record): record is LocalExerciseMotion => Boolean(record));

  await commitLocalExerciseMotions(verified.records);
  try {
    const result = restoreLocalBackup(trainingJSON);
    return { ...result, mediaCount: verified.mediaCount };
  } catch (error) {
    try {
      await commitLocalExerciseMotions(oldOverwritten, removedOnRollback);
      restoreLocalBackup(oldTraining);
    } catch {
      throw new Error("تعذرت استعادة بيانات التدريب وتعذر التراجع بالكامل. احتفظ بالحزمة وأعد المحاولة بعد تحرير المساحة.");
    }
    throw error;
  }
}

/**
 * Streams archive chunks to Android's native SAF writer. The entire archive
 * never crosses the JS bridge in one string, and the user selects the target
 * document via ACTION_CREATE_DOCUMENT only after successful streaming.
 */
export async function saveFullBackupToDevice(
  archive: Blob,
  progress?: BackupProgress,
): Promise<void> {
  const native = window as Window & {
    __AURA_EMBEDDED_ANDROID__?: boolean;
    AuraLocalBackup?: {
      beginArchive?: (token: string, length: number) => boolean;
      appendArchiveChunk?: (token: string, base64: string) => boolean;
      finishArchive?: (token: string) => boolean;
      cancelArchive?: (token: string) => void;
    };
  };
  const stamp = new Date().toISOString().slice(0, 10);
  const name = "aura-fit-complete-" + stamp + FULL_BACKUP_SUFFIX;
  if (!native.__AURA_EMBEDDED_ANDROID__) {
    const url = URL.createObjectURL(archive);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Allow time for browser download manager to read this blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const bridge = native.AuraLocalBackup;
  if (!bridge?.beginArchive || !bridge.appendArchiveChunk || !bridge.finishArchive) {
    throw new Error("ميزة حفظ الحزم الكبيرة غير متاحة في إصدار أندرويد هذا.");
  }
  const token = crypto.randomUUID();
  if (!bridge.beginArchive(token, archive.size)) {
    throw new Error("تعذر بدء حفظ الحزمة على أندرويد. تحقق من توفر مساحة تخزين.");
  }
  try {
    const reader = archive.stream().getReader();
    let written = 0;
    let lastProgressPercent = -1;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      // Passing 24 KiB per call avoids oversized base64 bridges.
      for (let offset = 0; offset < value.length; offset += 24 * 1024) {
        const part = value.subarray(offset, offset + 24 * 1024);
        const encoded = btoa(String.fromCharCode(...part));
        if (!bridge.appendArchiveChunk(token, encoded)) {
          throw new Error("تعذر إرسال جزء من الحزمة إلى Android. لم يُحفظ ملف ناقص.");
        }
        written += part.length;
        const percentage = Math.floor(written * 100 / archive.size);
        // Large backups may contain 20,000 native bridge chunks. Re-render
        // the React progress indicator only when the displayed percent moves.
        if (percentage !== lastProgressPercent || written === archive.size) {
          lastProgressPercent = percentage;
          progress?.(written, archive.size);
        }
      }
    }
    if (written !== archive.size || !bridge.finishArchive(token)) {
      throw new Error("لم يكتمل إعداد الحزمة للحفظ. أعد المحاولة.");
    }
  } catch (error) {
    bridge.cancelArchive?.(token);
    throw error;
  }
}
