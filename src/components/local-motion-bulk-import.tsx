import { useEffect, useRef, useState } from "react";
import { FolderUp, FileVideo, ShieldCheck } from "lucide-react";

import { getExercise } from "@/lib/exercise-db";
import {
  countLocalExerciseMotions,
  importLocalExerciseMotion,
  LOCAL_MOTION_CHANGED_EVENT,
} from "@/lib/local-exercise-videos";

type BatchEntry = {
  file: File;
  exerciseId?: string;
  name?: string;
  problem?: string;
};

export function LocalMotionBulkImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [entries, setEntries] = useState<BatchEntry[]>([]);
  const [processing, setProcessing] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => { void countLocalExerciseMotions().then(setCount).catch(() => setCount(null)); };
    refresh();
    window.addEventListener(LOCAL_MOTION_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(LOCAL_MOTION_CHANGED_EVENT, refresh);
  }, []);

  function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    setFeedback("");
    setError("");
    if (files.length > 60) {
      setEntries([]);
      setError("اختر 60 ملفًا أو أقل في كل دفعة لتفادي امتلاء ذاكرة الهاتف.");
      return;
    }
    const seen = new Set<string>();
    const selected = Array.from(files).map((file): BatchEntry => {
      const match = /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(mp4|webm|gif)$/i.exec(file.name);
      if (!match) return { file, problem: "اسم الملف غير مطابق للصيغة slug.mp4 / slug.webm / slug.gif" };
      const slug = match[1].toLowerCase();
      const exercise = getExercise(slug);
      if (!exercise || exercise.id !== slug) {
        return { file, problem: "لا يوجد تمرين بهذا المعرّف في المكتبة." };
      }
      if (seen.has(slug)) return { file, problem: "يوجد ملف آخر لهذا التمرين في الدفعة نفسها." };
      seen.add(slug);
      return { file, exerciseId: slug, name: exercise.name };
    });
    setEntries(selected);
  }

  async function importBatch() {
    const approved = entries.filter((entry) => entry.exerciseId);
    if (!approved.length || processing) return;
    setProcessing(true);
    setProcessed(0);
    setError("");
    setFeedback("");
    let succeeded = 0;
    const errors: string[] = [];
    for (const entry of approved) {
      try {
        await importLocalExerciseMotion(entry.exerciseId!, entry.file);
        succeeded++;
      } catch (reason) {
        errors.push(entry.file.name + ": " +
          (reason instanceof Error ? reason.message : "تعذر قراءة الملف"));
      }
      setProcessed((previous) => previous + 1);
    }
    setProcessing(false);
    setEntries([]);
    setFeedback("حُفظت " + succeeded + " حركة من " + approved.length +
      " على هذا الجهاز فقط. يمكنك فتح أي تمرين لمشاهدة ملفه.");
    if (errors.length) setError("تعذر إضافة " + errors.length + " ملفات: " + errors.slice(0,4).join(" | "));
    void countLocalExerciseMotions().then(setCount).catch(() => setCount(null));
  }

  const matched = entries.filter((entry) => entry.exerciseId);
  const unrecognized = entries.filter((entry) => entry.problem);

  return (
    <section className="mx-6 mb-5 overflow-hidden rounded-2xl border border-primary/25 bg-primary/5">
      <button type="button" onClick={() => setOpen((value) => !value)}
        className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-right"
        aria-expanded={open} aria-controls="local-motion-bulk-panel">
        <span className="flex items-center gap-2">
          <FolderUp className="size-5 text-primary" aria-hidden />
          <span className="text-sm font-black">مكتبة الحركات المرخصة</span>
        </span>
        <span className="text-xs text-primary">
          {count === null ? "محلية" : count + " محفوظة"}
          {open ? " ▲" : " ▼"}
        </span>
      </button>
      {open && (
        <div id="local-motion-bulk-panel" className="space-y-3 border-t border-border px-4 pb-4 pt-3">
          <p className="text-xs leading-6 text-muted-foreground">
            لاستيراد عدة فيديوهات دفعة واحدة، سمِّ كل ملف باسم معرف التمرين بالإنجليزية مثل
            <code dir="ltr" className="mx-1 rounded bg-background px-1.5 py-1">bench-press.mp4</code>
            أو <code dir="ltr" className="rounded bg-background px-1.5 py-1">push-up.gif</code>.
            راجع المطابقة أدناه قبل الإضافة. كل ملف يُربط بتمرين واحد فقط.
          </p>
          <p className="flex items-start gap-2 text-[11px] leading-5 text-amber-300">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            الملفات تظل على هذا الجهاز، ولا تصبح متاحة لجميع المستخدمين أو تُضمَّن في APK تلقائيًا.
          </p>
          <input ref={inputRef} type="file" multiple
            accept=".mp4,video/mp4,.webm,video/webm,.gif,image/gif"
            aria-label="اختيار عدة ملفات حركات مرخصة"
            data-testid="batch-motion-input"
            onChange={(event) => {
              selectFiles(event.target.files);
              event.target.value = "";
            }}
            disabled={processing}
            className="hidden"
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={processing}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 px-3 text-xs font-black text-primary disabled:opacity-50">
            <FileVideo className="size-4" aria-hidden /> اختيار مجموعة ملفات (حتى 60)
          </button>

          {entries.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-black">مراجعة الدفعة: {matched.length} مطابقة صحيحة · {unrecognized.length} غير معروف</p>
              <ul className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-background/60 p-2 text-xs">
                {entries.map((entry, index) => (
                  <li key={index} className="flex flex-wrap items-start justify-between gap-1 border-b border-border/50 py-1 last:border-0">
                    <span className="max-w-full break-all" dir="ltr">{entry.file.name}</span>
                    <span className={entry.problem ? "text-red-300" : "text-primary"}>
                      {entry.problem ?? entry.name}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button type="button" onClick={() => void importBatch()} disabled={processing || !matched.length}
                  className="min-h-11 flex-1 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground disabled:opacity-40">
                  {processing ? "جارٍ الحفظ " + processed + "/" + matched.length :
                    "تأكيد ربط " + matched.length + " حركة محلية"}
                </button>
                <button type="button" disabled={processing} onClick={() => setEntries([])}
                  className="min-h-11 rounded-xl border border-border px-3 text-xs font-bold">
                  إلغاء
                </button>
              </div>
            </div>
          )}
          {feedback && <p role="status" className="text-xs text-primary">{feedback}</p>}
          {error && <p role="alert" className="text-xs text-red-300">{error}</p>}
        </div>
      )}
    </section>
  );
}
