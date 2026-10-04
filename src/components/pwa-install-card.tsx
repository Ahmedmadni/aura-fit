import { useEffect, useState } from "react";
import { Download, Share2, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isStandalone() {
  if (typeof window === "undefined") return false;
  const iosStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return (
    window.matchMedia("(display-mode: standalone)").matches || iosStandalone
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export function PwaInstallCard() {
  const [promptEvent, setPromptEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const standalone = isStandalone();
    setInstalled(standalone);
    setIos(isIos() && !standalone);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setInstalled(false);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setMessage("تم تثبيت Aura Fit على جهازك.");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setMessage("تم قبول تثبيت Aura Fit.");
      } else {
        setMessage("لم يتم التثبيت. يمكنك المحاولة لاحقًا.");
      }
    } finally {
      setPromptEvent(null);
    }
  }

  if (installed || (!promptEvent && !ios)) return null;

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-primary">
            تثبيت التطبيق
          </p>
          <h3 className="mt-1 text-sm font-black">
            Aura Fit على الشاشة الرئيسية
          </h3>
        </div>
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <Smartphone className="size-4" />
        </div>
      </div>

      {promptEvent ? (
        <>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            ثبّت التطبيق لفتحه كتجربة مستقلة والوصول أسرع لخطتك والصفحات التي
            تمت زيارتها دون اتصال.
          </p>
          <button
            type="button"
            onClick={() => void install()}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-xs font-black text-primary-foreground"
          >
            <Download className="size-3.5" />
            تثبيت Aura Fit
          </button>
        </>
      ) : (
        <div className="mt-3 rounded-xl border border-border bg-background/50 p-3">
          <div className="flex items-start gap-2">
            <Share2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              على iPhone أو iPad: افتح قائمة المشاركة في Safari ثم اختر
              <span className="font-bold text-foreground">
                {" "}إضافة إلى الشاشة الرئيسية
              </span>
              .
            </p>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-3 text-[9px] leading-relaxed text-muted-foreground">
          {message}
        </p>
      )}
    </div>
  );
}
