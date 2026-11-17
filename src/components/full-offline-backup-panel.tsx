import { useRef, useState } from "react";
import { Archive, Download, HardDrive, ShieldCheck, Upload } from "lucide-react";
import {
  createFullBackup,
  inspectFullBackup,
  MAX_FULL_BACKUP_BYTES,
  restoreFullBackup,
  saveFullBackupToDevice,
  type ParsedFullBackup,
} from "@/lib/full-offline-backup";

export function FullOfflineBackupPanel({ onRestored }: { onRestored: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedFullBackup | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function exportFull() {
    if (busy) return;
    setBusy(true);
    setPending(null);
    setMessage("");
    setError("");
    setProgress("جارٍ تجهيز الحزمة الكاملة…");
    try {
      const { archive, mediaCount, totalBytes } = await createFullBackup(
        (n, total) => setProgress("فحص سلامة ملفات الحركة: " + n + "/" + total),
      );
      setProgress("جارٍ تجهيز الملف واختيار مكان الحفظ ثم التحقق من سلامته…");
      await saveFullBackupToDevice(archive,
        (written, total) => setProgress(
          "تجهيز ملف Android: " + Math.round(100 * written / total) + "%",
        ),
      );
      setMessage(
        "اكتمل حفظ الحزمة (" + mediaCount + " ملف حركة، " +
        (totalBytes / 1048576).toFixed(1) +
        " ميجابايت). " +
        (window as Window & { __AURA_EMBEDDED_ANDROID__?: boolean }).__AURA_EMBEDDED_ANDROID__
          ? "تأكد أندرويد من حجم الملف وبصمة SHA-256 للوجهة المحددة. احتفظ بالحزمة خارج التطبيق."
          : "تم إرسال الملف إلى تنزيلات المتصفح. تحقق من وجوده وافحصه قبل إزالة النسخة القديمة.",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذر تجهيز الحزمة الكاملة.");
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  async function chooseBackup(file?: File) {
    if (!file || busy) return;
    setBusy(true);
    setPending(null);
    setError("");
    setMessage("");
    setProgress("جارٍ فحص الحزمة دون تعديل بياناتك…");
    try {
      if (!file.name.toLowerCase().endsWith(".afbackup")) {
        throw new Error("اختر ملف Aura Fit بصيغة afbackup فقط.");
      }
      if (file.size > MAX_FULL_BACKUP_BYTES) {
        throw new Error("الحزمة تتجاوز حد 512 ميجابايت.");
      }
      const parsed = await inspectFullBackup(
        file,
        (n, total) => setProgress("التحقق من بصمات الفيديو: " + n + "/" + total),
      );
      setPending(parsed);
      setMessage("نجح فحص جميع ملفات الحزمة. راجع الملخص ثم أكد الاستعادة.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "الحزمة غير صالحة.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
      setBusy(false);
      setProgress("");
    }
  }

  async function confirmRestore() {
    if (!pending || busy) return;
    setBusy(true);
    setMessage("");
    setError("");
    setProgress("جارٍ استعادة بيانات التدريب والمقاطع…");
    try {
      const outcome = await restoreFullBackup(pending);
      setPending(null);
      onRestored();
      setMessage("اكتملت الاستعادة: " + outcome.workouts + " جلسة، " +
        outcome.readiness + " تقييم جاهزية، " +
        outcome.mediaCount + " ملف حركة. تبقى المقاطع المحلية غير الموجودة في النسخة محفوظة.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "تعذرت الاستعادة دون مسح بيانات الجهاز.");
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <section
      data-testid="full-offline-backup"
      className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-3"
      aria-label="النسخة الكاملة للتمارين والفيديوهات"
    >
      <div className="flex items-start gap-2">
        <Archive className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0">
          <h4 className="text-xs font-black">نسخة كاملة: التدريب + فيديوهات التمارين</h4>
          <p className="mt-1 text-[11px] leading-6 text-muted-foreground">
            حزمة محلية بصيغة .afbackup تشمل ملف المستخدم، جلساته، الخطط
            والمقاطع المرخصة التي أضفتها (MP4 / WebM / GIF).
            تُنشأ على الجهاز ولا تُرفع إلى أي خادم.
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        تُفحص الملفات ببصمة SHA-256 قبل الحفظ والاستعادة. الحد الأقصى للحزمة
        512 ميجابايت؛ إذا تجاوزته ملفاتك لن يتم إسقاط أي مقطع بصمت.
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".afbackup,application/octet-stream"
        data-testid="full-backup-file"
        aria-label="اختيار ملف حزمة Aura Fit الكاملة"
        className="hidden"
        disabled={busy}
        onChange={(event) => void chooseBackup(event.target.files?.[0])}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy}
          onClick={() => void exportFull()}
          className="flex min-h-12 items-center justify-center gap-1 rounded-xl bg-primary px-2 text-[11px] font-black text-primary-foreground disabled:opacity-50"
        >
          <Download className="size-4" aria-hidden /> تصدير نسخة كاملة
        </button>
        <button type="button" disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="flex min-h-12 items-center justify-center gap-1 rounded-xl border border-border px-2 text-[11px] font-black disabled:opacity-50"
        >
          <Upload className="size-4" aria-hidden /> فحص حزمة للاستعادة
        </button>
      </div>

      {pending && (
        <div className="mt-3 space-y-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3"
          data-testid="full-backup-preview"
        >
          <p className="text-xs font-black text-amber-300">تأكيد الاستعادة</p>
          <p className="text-xs text-foreground">
            {pending.training.workouts.length} جلسة تدريب ·{" "}
            {pending.training.readiness.length} تقييم جاهزية ·{" "}
            {pending.mediaCount} ملف فيديو/حركة
          </p>
          <p className="text-[10px] leading-5 text-muted-foreground">
            ستُستبدل بيانات التدريب والخطط الحالية بالنسخة، وسيتم دمج ملفات
            الحركة حسب معرّف كل تمرين، مع استبدال المقاطع المطابقة فقط
            والإبقاء على بقية ملفاتك. لا يشمل ذلك الحساب السحابي.
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={busy}
              onClick={() => void confirmRestore()}
              className="min-h-11 flex-1 rounded-xl bg-amber-400 px-3 text-xs font-black text-black disabled:opacity-50">
              تأكيد استعادة الحزمة
            </button>
            <button type="button" disabled={busy}
              onClick={() => { setPending(null); setMessage("أُلغيت الاستعادة دون تغيير البيانات."); }}
              className="min-h-11 rounded-xl border border-border px-3 text-xs font-bold">
              إلغاء
            </button>
          </div>
        </div>
      )}
      {progress && <p role="status" className="mt-2 text-xs text-primary">{progress}</p>}
      {message && <p role="status" className="mt-2 text-xs leading-6 text-primary">{message}</p>}
      {error && <p role="alert" className="mt-2 text-xs leading-6 text-red-300">{error}</p>}
      <div className="mt-3 flex items-start gap-2 text-[10px] text-muted-foreground">
        <HardDrive className="mt-0.5 size-4 shrink-0" aria-hidden />
        عند ترحيل التطبيق بين توقيعَي APK مختلفين، احفظ الحزمة خارج التطبيق
        وتأكد من وجودها قبل إزالة النسخة القديمة.
      </div>
    </section>
  );
}
