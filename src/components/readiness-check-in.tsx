import { useEffect, useState } from "react";
import { BatteryMedium, Check, Dumbbell, Moon, Zap } from "lucide-react";
import {
  readinessDateKey,
  saveDailyReadiness,
  type DailyReadinessCheckIn,
} from "@/lib/user-profile";

export function ReadinessCheckInCard({
  value,
  onSaved,
}: {
  value?: DailyReadinessCheckIn;
  onSaved: (value: DailyReadinessCheckIn) => void;
}) {
  const [editing, setEditing] = useState(!value);
  const [sleepQuality, setSleepQuality] = useState(value?.sleepQuality ?? 3);
  const [fatigue, setFatigue] = useState(value?.fatigue ?? 3);
  const [muscleSoreness, setMuscleSoreness] = useState(
    value?.muscleSoreness ?? 3,
  );
  const [energy, setEnergy] = useState(value?.energy ?? 3);

  useEffect(() => {
    if (!value) return;
    setSleepQuality(value.sleepQuality);
    setFatigue(value.fatigue);
    setMuscleSoreness(value.muscleSoreness);
    setEnergy(value.energy);
  }, [value]);

  function save() {
    const saved = saveDailyReadiness({
      dateKey: readinessDateKey(),
      sleepQuality,
      fatigue,
      muscleSoreness,
      energy,
    });
    if (!saved) return;
    onSaved(saved);
    setEditing(false);
  }

  if (!editing && value) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
              تقييم اليوم مسجل
            </p>
            <p className="mt-1 text-sm font-black">
              النوم {value.sleepQuality}/5 · الطاقة {value.energy}/5
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              التعب {value.fatigue}/5 · ألم العضلات {value.muscleSoreness}/5
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-full border border-border bg-background/60 px-3 py-1.5 text-[10px] font-bold text-muted-foreground"
          >
            تعديل
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface/70 p-4">
      <div className="mb-4">
        <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
          Check-in يومي
        </p>
        <h3 className="mt-1 text-lg font-black">كيف حالك اليوم؟</h3>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          يستخدم Aura Fit هذا التقييم لليوم الحالي فقط عند ضبط الجرعة التدريبية.
        </p>
      </div>

      <div className="space-y-4">
        <RatingRow
          icon={Moon}
          label="جودة النوم"
          value={sleepQuality}
          onChange={setSleepQuality}
          lowLabel="ضعيف"
          highLabel="ممتاز"
        />
        <RatingRow
          icon={BatteryMedium}
          label="التعب"
          value={fatigue}
          onChange={setFatigue}
          lowLabel="منخفض"
          highLabel="مرتفع"
          inverted
        />
        <RatingRow
          icon={Dumbbell}
          label="ألم العضلات"
          value={muscleSoreness}
          onChange={setMuscleSoreness}
          lowLabel="خفيف"
          highLabel="شديد"
          inverted
        />
        <RatingRow
          icon={Zap}
          label="الطاقة"
          value={energy}
          onChange={setEnergy}
          lowLabel="منخفضة"
          highLabel="عالية"
        />
      </div>

      <button
        type="button"
        onClick={save}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-black text-primary-foreground active:scale-[0.98]"
      >
        <Check className="size-4" />
        حفظ تقييم اليوم
      </button>
    </div>
  );
}

function RatingRow({
  icon: Icon,
  label,
  value,
  onChange,
  lowLabel,
  highLabel,
  inverted = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  onChange: (value: number) => void;
  lowLabel: string;
  highLabel: string;
  inverted?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="size-3.5 text-primary" />
          <p className="text-xs font-bold">{label}</p>
        </div>
        <p className="text-[9px] text-muted-foreground">
          {value}/5 · {value <= 2 ? lowLabel : value >= 4 ? highLabel : "متوسط"}
        </p>
      </div>

      <div className="grid grid-cols-5 gap-2" dir="ltr">
        {[1, 2, 3, 4, 5].map((score) => {
          const active = value === score;
          return (
            <button
              key={score}
              type="button"
              onClick={() => onChange(score)}
              aria-label={label + " " + score + " من 5"}
              className={
                "h-9 rounded-lg border text-xs font-black transition-all " +
                (active
                  ? inverted && score >= 4
                    ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                    : "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background/50 text-muted-foreground")
              }
            >
              {score}
            </button>
          );
        })}
      </div>
    </div>
  );
}
