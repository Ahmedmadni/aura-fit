import { useEffect, useRef, useState } from "react";
import { CheckCircle2, FileVideo, Trash2, Upload } from "lucide-react";

import {
  deleteLocalExerciseMotion,
  importLocalExerciseMotion,
  loadLocalExerciseMotion,
  LOCAL_MOTION_MAX_BYTES,
  type LocalExerciseMotion,
} from "@/lib/local-exercise-videos";

export function LocalExerciseMotionManager({ exerciseId }: { exerciseId: string }) {
  const input = useRef<HTMLInputElement | null>(null);
  const [saved, setSaved] = useState<LocalExerciseMotion | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    setSaved(null);
    setError("");
    setFeedback("");
    void loadLocalExerciseMotion(exerciseId)
      .then((result) => { if (live) setSaved(result); })
      .catch((reason) => {
        if (live) setError(reason instanceof Error ? reason.message : "مكتبة الوسائط المحلية غير متاحة.");
      });
    return () => { live = false; };
  }, [exerciseId]);

  async function onSelect(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setFeedback("");
    setConfirmDelete(false);
    try {
      const entry = await importLocalExerciseMotion(exerciseId, file);
      setSaved(entry);
      setFeedback("تم ربط الحركة بهذا التمرين وحفظها على هذا الجهاز. ستُعرض أيضًا داخل جلسات التدريب.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر إضافة ملف الحركة.");
    } finally {
      if (input.current) input.current.value = "";
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setError("");
    try {
      await deleteLocalExerciseMotion(exerciseId);
      setSaved(null);
      setConfirmDelete(false);
      setFeedback("حُذف الملف المحلي وعاد العرض إلى الوسائط المضمّنة أو الإطارات الأصلية.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "تعذر حذف الملف.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="حركة مرخصة من ملفات الجهاز"
      className="rounded-2xl border border-border bg-surface/70 p-4"
      data-testid="local-motion-manager"
    >
      <div className="flex items-start gap-3">
        <FileVideo className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-black">إضافة حركة مرخصة لهذا التمرين</h3>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            اختر ملف MP4 أو WebM أو GIF مطابقًا لهذا التمرين. يُفحص الملف ثم يُحفظ محليًا
            ويظهر تلقائيًا في صفحة التمرين ومشغل الجلسات. يظل بلا تسجيل دخول أو اتصال.
          </p>
          <p className="mt-1 text-[11px] leading-5 text-amber-300">
            أنت مسؤول عن مطابقة الحركة المختارة للتمرين. هذه الإضافة خاصة بالجهاز الحالي
            ولا ترفع الملفات إلى الموقع ولا تنسخها إلى الحساب السحابي أو ملف JSON.
          </p>
        </div>
      </div>

      <input
        type="file"
        accept=".mp4,video/mp4,.webm,video/webm,.gif,image/gif"
        data-testid="local-motion-file"
        aria-label="اختيار ملف حركة للتمرين"
        ref={input}
        className="hidden"
        onChange={(event) => void onSelect(event.target.files?.[0])}
        disabled={busy}
      />

      {saved && (
        <div data-testid="local-motion-status" className="mt-3 flex items-start gap-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-black">ملف الحركة محفوظ على هذا الجهاز</p>
            <p className="mt-1 break-all text-[11px] text-muted-foreground">
              {saved.fileName} · {(saved.blob.size / (1024 * 1024)).toFixed(1)} ميجابايت
            </p>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black text-primary-foreground disabled:opacity-50"
          onClick={() => input.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {busy ? "جارٍ التحقق…" : saved ? "استبدال الحركة" : "اختيار الحركة"}
        </button>

        {saved && !confirmDelete && (
          <button
            type="button"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
            className="flex min-h-11 items-center gap-2 rounded-xl border border-red-400/40 px-3 text-xs font-bold text-red-300"
          >
            <Trash2 className="size-4" aria-hidden /> حذف الملف المحلي
          </button>
        )}
        {confirmDelete && saved && (
          <>
            <button type="button" disabled={busy} onClick={() => void remove()}
              className="min-h-11 rounded-xl bg-red-400 px-3 text-xs font-black text-black">تأكيد الحذف</button>
            <button type="button" onClick={() => setConfirmDelete(false)}
              className="min-h-11 rounded-xl border border-border px-3 text-xs">إلغاء</button>
          </>
        )}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        الحد الأقصى للملف {(LOCAL_MOTION_MAX_BYTES / (1024 * 1024)).toFixed(0)} ميجابايت.
        لتمكين التشغيل على أكبر عدد من هواتف أندرويد، يفضّل MP4 بترميز H.264.
      </p>
      {feedback && <p role="status" className="mt-2 text-xs text-primary">{feedback}</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </section>
  );
}
