import { useEffect, useState } from "react";
import { Type } from "lucide-react";

const KEY = "kp-font-scale";
const OPTIONS = [
  { value: 0.9, label: "صغير" },
  { value: 1, label: "متوسط" },
  { value: 1.1, label: "كبير" },
  { value: 1.2, label: "كبير جدًا" },
];

export function applyFontScale(v: number) {
  document.documentElement.style.setProperty("--font-scale", String(v));
}

export function FontSizeSetting() {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const saved = Number(localStorage.getItem(KEY));
    if (saved) setScale(saved);
  }, []);

  const choose = (v: number) => {
    setScale(v);
    localStorage.setItem(KEY, String(v));
    applyFontScale(v);
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-4 backdrop-blur-xl">
      <div className="flex items-center gap-2 mb-1">
        <Type className="size-4 text-primary" />
        <span className="text-sm font-black">حجم الخط</span>
      </div>
      <p className="text-xs text-muted-foreground mb-3">يُطبَّق على كل صفحات التطبيق.</p>
      <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="حجم الخط">
        {OPTIONS.map((o) => {
          const active = scale === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => choose(o.value)}
              className={`rounded-xl border py-2 flex flex-col items-center gap-1 transition-colors ${
                active
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              <span className="font-bold leading-none" style={{ fontSize: `${o.value * 18}px` }}>
                أ
              </span>
              <span className="text-[11px]">{o.label}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm leading-relaxed">معاينة: تمرين اليوم جاهز، ابدأ بالإحماء.</p>
    </div>
  );
}
