import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  Check,
  RefreshCcw,
} from "lucide-react";
import { AnimatePresence, motion, PanInfo } from "framer-motion";
import { PageShell } from "@/components/page-shell";
import { AthleteVideo } from "@/components/athlete-video";
import { Button } from "@/components/ui/button";
import {
  primeAudio,
  setSfxEnabled,
  sfxDone,
  sfxGo,
  sfxRest,
  sfxTick,
} from "@/lib/workout-audio";
import {
  PERIODIZATION_PHASE_LABEL_AR,
  PHASE_LABEL_AR,
  createManualExerciseSwap,
  generateWorkout,
  getManualExerciseSwapOptions,
  type PlannedExercise,
} from "@/lib/workout-engine";
import {
  EQUIPMENT_LABEL_AR,
  MOVEMENT_FAMILY_LABEL_AR,
  getExercise,
  INJURY_LABEL_AR,
} from "@/lib/exercise-db";
import {
  loadHistory,
  loadProfile,
  loadTodayReadiness,
  recordWorkout,
} from "@/lib/user-profile";
import { checkNewAchievements } from "@/lib/achievements";
import {
  clearWorkoutSessionDraft,
  loadRecoverableWorkoutSessionDraft,
  loadWorkoutSessionDraft,
  saveWorkoutSessionDraft,
  type WorkoutSessionDraftState,
  type WorkoutSessionDraftV1,
} from "@/lib/workout-session";

export const Route = createFileRoute("/workout")({
  validateSearch: (search: Record<string, unknown>) => {
    const parsed = Number(search.day);
    return {
      day: Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined,
    };
  },
  component: WorkoutPlayer,
});

function WorkoutPlayer() {
  const navigate = useNavigate();
  const { day } = Route.useSearch();
  const [hydrated, setHydrated] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [sessionConflict, setSessionConflict] =
    useState<WorkoutSessionDraftV1>();
  const [sessionIdentity, setSessionIdentity] = useState<{
    workoutId: string;
    day: number | null;
  }>();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // localStorage is unavailable during SSR. Rebuild once after hydration so
  // direct navigation always uses the real local profile/history/readiness.
  const workout = useMemo(
    () =>
      generateWorkout(loadProfile(), {
        day,
        history: loadHistory(),
        readiness: loadTodayReadiness(),
      }),
    [day, hydrated],
  );
  const generatedPlan = workout.exercises;
  const [plan, setPlan] = useState<PlannedExercise[]>(generatedPlan);

  const [index, setIndex] = useState(0);
  const [setIdx, setSetIdx] = useState(1); // 1-based current set
  const [phase, setPhase] = useState<"work" | "rest" | "done">("work");
  const [remaining, setRemaining] = useState(plan[0]?.workSeconds ?? 45);
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showRefs, setShowRefs] = useState(false);
  const [showSwapOptions, setShowSwapOptions] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [setReps, setSetReps] = useState<Record<string, number[]>>({});
  const [setLoadsKg, setSetLoadsKg] = useState<Record<string, number[]>>({});
  const [setRir, setSetRir] = useState<Record<string, number[]>>({});
  const [currentReps, setCurrentReps] = useState(() => suggestedReps(plan[0]?.reps));
  const [currentLoadKg, setCurrentLoadKg] = useState(
    () => plan[0]?.suggestedLoadKg ?? plan[0]?.lastLoadKg ?? 0,
  );
  const [currentRir, setCurrentRir] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const runningBeforeSwap = useRef(true);
  const runningBeforeExit = useRef(true);
  const draftSnapshot = useRef<WorkoutSessionDraftState | null>(null);

  const current: PlannedExercise = plan[index];
  const next = plan[index + 1];
  const total = plan.length;

  const swapOptions = useMemo(() => {
    if (
      !hydrated ||
      !current ||
      (current.phase !== "main" &&
        current.phase !== "accessory" &&
        current.phase !== "core")
    ) {
      return [];
    }

    return getManualExerciseSwapOptions(
      current.exercise,
      loadProfile(),
      new Set(plan.map((item) => item.exercise.id)),
      4,
    );
  }, [current, hydrated, plan]);

  const canSwapCurrent =
    phase === "work" &&
    setIdx === 1 &&
    !completed.has(current.exercise.id) &&
    swapOptions.length > 0;

  const totalDuration = useMemo(
    () =>
      plan.reduce(
        (s, p) => s + p.workSeconds * p.sets + p.restSeconds * Math.max(0, p.sets - 1),
        0,
      ),
    [plan],
  );
  const [elapsed, setElapsed] = useState(0);
  const [finishedDurationSec, setFinishedDurationSec] = useState<number | null>(
    null,
  );

  const completedActiveSec = useMemo(
    () =>
      plan.reduce(
        (sum, item) =>
          completed.has(item.exercise.id)
            ? sum + item.workSeconds * item.sets
            : sum,
        0,
      ),
    [completed, plan],
  );

  const completedCalories = useMemo(
    () =>
      Math.round(
        plan.reduce(
          (sum, item) =>
            completed.has(item.exercise.id)
              ? sum +
                (item.exercise.caloriesPerMin *
                  item.workSeconds *
                  item.sets) /
                  60
              : sum,
          0,
        ),
      ),
    [completed, plan],
  );

  function restoreDraftSession(
    draft: WorkoutSessionDraftV1,
    identity = {
      workoutId: draft.workoutId,
      day: draft.day,
    },
  ) {
    setSessionConflict(undefined);
    setSessionIdentity(identity);
    setPlan(draft.plan);
    setIndex(draft.index);
    setSetIdx(draft.setIdx);
    setPhase(draft.phase);
    setRemaining(draft.remaining);
    setRunning(false);
    setMuted(draft.muted);
    setShowRefs(false);
    setShowSwapOptions(false);
    setShowExitConfirm(false);
    setCompleted(new Set(draft.completed));
    setSkipped(new Set(draft.skipped));
    setSetReps(draft.setReps);
    setSetLoadsKg(draft.setLoadsKg);
    setSetRir(draft.setRir);
    setCurrentReps(draft.currentReps);
    setCurrentLoadKg(draft.currentLoadKg);
    setCurrentRir(draft.currentRir);
    setElapsed(draft.elapsed);
    setFinishedDurationSec(null);
    runningBeforeSwap.current = false;
    runningBeforeExit.current = false;
    startedAt.current = Date.now() - draft.elapsed * 1000;
    setRestoredDraft(true);
    setSessionReady(true);
  }

  function initializeFreshSession(clearExistingDraft = false) {
    if (clearExistingDraft) {
      draftSnapshot.current = null;
      clearWorkoutSessionDraft();
    }

    setSessionConflict(undefined);
    setSessionIdentity({
      workoutId: workout.id,
      day: day ?? null,
    });
    setPlan(generatedPlan);
    setIndex(0);
    setSetIdx(1);
    setPhase("work");
    setRemaining(generatedPlan[0]?.workSeconds ?? 45);
    setRunning(true);
    setMuted(false);
    setShowRefs(false);
    setShowSwapOptions(false);
    setShowExitConfirm(false);
    setCompleted(new Set());
    setSkipped(new Set());
    setSetReps({});
    setSetLoadsKg({});
    setSetRir({});
    setCurrentReps(suggestedReps(generatedPlan[0]?.reps));
    setCurrentLoadKg(
      generatedPlan[0]?.suggestedLoadKg ??
        generatedPlan[0]?.lastLoadKg ??
        0,
    );
    setCurrentRir(null);
    setElapsed(0);
    setFinishedDurationSec(null);
    runningBeforeSwap.current = true;
    runningBeforeExit.current = true;
    startedAt.current = Date.now();
    setRestoredDraft(false);
    setSessionReady(true);
  }

  function resumeConflictingSession() {
    if (!sessionConflict) return;

    const requestedDay = day ?? null;
    if (sessionConflict.day !== requestedDay) {
      navigate({
        to: "/workout",
        search: { day: sessionConflict.day ?? undefined },
      });
      return;
    }

    restoreDraftSession(sessionConflict, {
      workoutId: workout.id,
      day: requestedDay,
    });
  }

  function replaceConflictingSession() {
    initializeFreshSession(true);
    primeAudio();
    sfxGo();
  }

  useEffect(() => {
    if (!hydrated) return;

    setSessionReady(false);
    setSessionIdentity(undefined);
    draftSnapshot.current = null;
    setShowSwapOptions(false);
    setShowExitConfirm(false);
    setFinishedDurationSec(null);

    const requestedDay = day ?? null;
    const recoverable = loadRecoverableWorkoutSessionDraft();
    if (recoverable) {
      const matchesCurrent =
        recoverable.workoutId === workout.id &&
        recoverable.day === requestedDay;

      if (matchesCurrent) {
        restoreDraftSession(recoverable);
        return;
      }

      setRunning(false);
      setRestoredDraft(false);
      setSessionConflict(recoverable);
      return;
    }

    initializeFreshSession(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, generatedPlan, hydrated, workout.id]);

  useEffect(() => {
    if (!hydrated || !sessionReady || !sessionIdentity || phase === "done") {
      draftSnapshot.current = null;
      return;
    }

    draftSnapshot.current = {
      workoutId: sessionIdentity.workoutId,
      day: sessionIdentity.day,
      plan,
      index,
      setIdx,
      phase,
      remaining,
      completed: [...completed],
      skipped: [...skipped],
      setReps,
      setLoadsKg,
      setRir,
      currentReps,
      currentLoadKg,
      currentRir,
      elapsed,
      muted,
    };
  }, [
    completed,
    currentLoadKg,
    currentReps,
    currentRir,
    day,
    elapsed,
    hydrated,
    index,
    muted,
    phase,
    plan,
    remaining,
    sessionReady,
    setIdx,
    setLoadsKg,
    setReps,
    setRir,
    skipped,
    sessionIdentity,
  ]);

  useEffect(() => {
    if (!hydrated || !sessionReady) return;

    const flushDraft = () => {
      if (draftSnapshot.current) {
        saveWorkoutSessionDraft(draftSnapshot.current);
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };

    flushDraft();
    const intervalId = window.setInterval(flushDraft, 5000);
    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", handleVisibility);
      flushDraft();
    };
  }, [hydrated, sessionReady]);

  useEffect(() => {
    if (restoredDraft && running) setRestoredDraft(false);
  }, [restoredDraft, running]);



  function saveCurrentSet() {
    setSetReps((all) => {
      const values = [...(all[current.exercise.id] ?? [])];
      values[setIdx - 1] = currentReps;
      return { ...all, [current.exercise.id]: values };
    });

    if (current.trackLoad) {
      setSetLoadsKg((all) => {
        const values = [...(all[current.exercise.id] ?? [])];
        values[setIdx - 1] = Math.max(0, currentLoadKg);
        return { ...all, [current.exercise.id]: values };
      });
    }

    if (
      currentRir !== null &&
      (current.phase === "main" ||
        current.phase === "accessory" ||
        current.phase === "core")
    ) {
      setSetRir((all) => {
        const values = [...(all[current.exercise.id] ?? [])];
        values[setIdx - 1] = Math.max(0, Math.min(5, currentRir));
        return { ...all, [current.exercise.id]: values };
      });
    }
  }

  function prepareExercise(nextIndex: number) {
    const upcoming = plan[nextIndex];
    setCurrentReps(suggestedReps(upcoming?.reps));
    setCurrentLoadKg(upcoming?.suggestedLoadKg ?? upcoming?.lastLoadKg ?? 0);
    setCurrentRir(null);
    setShowSwapOptions(false);
  }

  function toggleSwapOptions() {
    const opening = !showSwapOptions;
    if (opening) {
      runningBeforeSwap.current = running;
      setShowSwapOptions(true);
      setRunning(false);
      return;
    }

    const restoreRunning = runningBeforeSwap.current;
    setShowSwapOptions(false);
    setRunning(restoreRunning);
    if (restoreRunning) sfxGo();
  }

  function requestExit() {
    const restoreRunning = showSwapOptions
      ? runningBeforeSwap.current
      : running;
    runningBeforeExit.current = restoreRunning;
    setShowSwapOptions(false);
    setShowExitConfirm(true);
    setRunning(false);
  }

  function cancelExit() {
    const restoreRunning = runningBeforeExit.current;
    setShowExitConfirm(false);
    setRunning(restoreRunning);
    if (restoreRunning) sfxGo();
  }

  function confirmExitWithoutSaving() {
    draftSnapshot.current = null;
    clearWorkoutSessionDraft();
    setShowExitConfirm(false);
    navigate({ to: "/" });
  }



  function skipCurrentExercise() {
    if (!next) return;

    const restoreRunning = showSwapOptions
      ? runningBeforeSwap.current
      : running;
    const currentId = current.exercise.id;
    setCompleted((items) => {
      const nextItems = new Set(items);
      nextItems.delete(currentId);
      return nextItems;
    });
    setSkipped((items) => new Set(items).add(currentId));
    setIndex(index + 1);
    prepareExercise(index + 1);
    setSetIdx(1);
    setPhase("work");
    setRemaining(next.workSeconds);
    setShowSwapOptions(false);
    setRunning(restoreRunning);
    if (restoreRunning) sfxGo();
  }


  function applyManualSwap(replacementId: string) {
    const replacement = getExercise(replacementId);
    if (!replacement || !current) return;

    const swapped = createManualExerciseSwap(
      current,
      replacement,
      loadProfile(),
      loadHistory(),
      workout.adaptation,
      workout.periodization,
      workout.isDeload,
    );
    if (!swapped) return;

    const restoreRunning = runningBeforeSwap.current;
    const previousId = current.exercise.id;
    setPlan((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? swapped : item)),
    );
    setCompleted((items) => {
      const nextItems = new Set(items);
      nextItems.delete(previousId);
      return nextItems;
    });
    setSkipped((items) => {
      const nextItems = new Set(items);
      nextItems.delete(previousId);
      return nextItems;
    });
    setSetReps((all) => {
      const nextValues = { ...all };
      delete nextValues[previousId];
      return nextValues;
    });
    setSetLoadsKg((all) => {
      const nextValues = { ...all };
      delete nextValues[previousId];
      return nextValues;
    });
    setSetRir((all) => {
      const nextValues = { ...all };
      delete nextValues[previousId];
      return nextValues;
    });
    setCurrentReps(suggestedReps(swapped.reps));
    setCurrentLoadKg(swapped.suggestedLoadKg ?? swapped.lastLoadKg ?? 0);
    setCurrentRir(null);
    setSetIdx(1);
    setPhase("work");
    setRemaining(swapped.workSeconds);
    setShowSwapOptions(false);
    setRunning(restoreRunning);
    if (restoreRunning) sfxGo();
  }

  const progress =
    ((index + (setIdx - 1) / current.sets + (phase === "rest" ? 0.5 / current.sets : 0)) / total) *
    100;

  useEffect(() => {
    primeAudio();
  }, []);

  useEffect(() => {
    setSfxEnabled(!muted);
  }, [muted]);

  // main timer
  useEffect(() => {
    if (!hydrated || !running || phase === "done") return;
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 4 && r > 1) sfxTick();
        if (r > 1) return r - 1;

        // transition logic
        if (phase === "work") {
          saveCurrentSet();
          if (setIdx < current.sets && current.restSeconds > 0) {
            setPhase("rest");
            setCurrentRir(null);
            sfxRest();
            return current.restSeconds;
          }
          // move to next exercise
          setCompleted((items) => new Set(items).add(current.exercise.id));
          setSkipped((items) => {
            const nextItems = new Set(items);
            nextItems.delete(current.exercise.id);
            return nextItems;
          });
          if (index + 1 < total) {
            setIndex((i) => i + 1);
            prepareExercise(index + 1);
            setSetIdx(1);
            setPhase("work");
            sfxGo();
            return plan[index + 1].workSeconds;
          }
          setFinishedDurationSec(
            Math.round((Date.now() - startedAt.current) / 1000),
          );
          setPhase("done");
          sfxDone();
          return 0;
        }
        // rest → next set of same exercise
        setSetIdx((s) => s + 1);
        setPhase("work");
        sfxGo();
        return current.workSeconds;
      });
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [running, phase, index, setIdx, current, currentReps, total, plan]);

  // save on completion
  useEffect(() => {
    if (!hydrated || phase !== "done" || finishedDurationSec === null) return;
    draftSnapshot.current = null;
    clearWorkoutSessionDraft();
    recordWorkout({
      id: (sessionIdentity?.workoutId ?? workout.id) + "-" + Date.now(),
      date: new Date().toISOString(),
      exercises: plan.map((p) => ({
        id: p.exercise.id,
        sets: p.sets,
        reps: p.reps,
        completed: completed.has(p.exercise.id),
        skipped: skipped.has(p.exercise.id),
        setReps: setReps[p.exercise.id],
        setLoadsKg: p.trackLoad ? setLoadsKg[p.exercise.id] : undefined,
        setRir: setRir[p.exercise.id],
        setRpe: setRir[p.exercise.id]?.map((rir) => 10 - rir),
        progressionAction: p.progressionAction,
        rotatedFromId: p.rotatedFromId,
        rotationReason: p.rotationReason,
      })),
      durationSec: finishedDurationSec,
      activeSec: completedActiveSec,
      calories: completedCalories,
      intensity: workout.intensity,
      performance: Math.round((completed.size / total) * 100),
      adaptationMode: workout.adaptation.mode,
      readinessScore: workout.adaptation.readinessScore,
      periodizationPhase: workout.periodization.phase,
      periodizationCycleWeek: workout.periodization.cycleWeek,
    });
    checkNewAchievements([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const fmt = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const ringSize = 240;
  const stroke = 10;
  const radius = (ringSize - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const phaseTotal = phase === "rest" ? current.restSeconds : current.workSeconds;
  const ringOffset = circ - (remaining / phaseTotal) * circ;

  function handleSwipe(_: unknown, info: PanInfo) {
    if (info.offset.x > 80 && index > 0) {
      // swipe right in RTL = previous
      setIndex(index - 1);
      prepareExercise(index - 1);
      setSetIdx(1);
      setPhase("work");
      setRemaining(plan[index - 1].workSeconds);
      sfxGo();
    } else if (info.offset.x < -80 && next) {
      // swipe left in RTL = intentionally skip current exercise
      skipCurrentExercise();
    }
  }

  if (!hydrated) {
    return (
      <PageShell>
        <div className="grid min-h-[70vh] place-items-center p-6 text-center">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-primary">
              AURA FIT
            </p>
            <p className="mt-2 text-sm font-bold">جارٍ تجهيز جلستك من بيانات الجهاز…</p>
          </div>
        </div>
      </PageShell>
    );
  }

  if (sessionConflict) {
    const savedCurrent = sessionConflict.plan[sessionConflict.index];
    const sameRequestedDay = sessionConflict.day === (day ?? null);

    return (
      <PageShell>
        <div className="grid min-h-[75vh] place-items-center p-6">
          <div className="w-full rounded-3xl border border-amber-400/30 bg-amber-400/5 p-5">
            <p className="type-eyebrow text-amber-400">جلسة غير مكتملة</p>
            <h1 className="type-page-title mt-2">لديك جلسة محفوظة بالفعل</h1>
            <p className="type-small mt-3 leading-relaxed text-muted-foreground">
              لن نكتب فوق تقدمك المحفوظ تلقائيًا. اختر استئناف الجلسة السابقة
              أو ابدأ الجلسة الجديدة بعد حذفها صراحة.
            </p>

            <div className="mt-4 rounded-2xl border border-border bg-background/60 p-3">
              <p className="text-xs font-black">
                {savedCurrent?.exercise.name ?? "جلسة محفوظة"}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                تمرين {sessionConflict.index + 1}/{sessionConflict.plan.length}
                {" · "}
                مجموعة {sessionConflict.setIdx}
                {sameRequestedDay && sessionConflict.workoutId !== workout.id
                  ? " · تغيرت الخطة الحالية منذ الحفظ"
                  : ""}
              </p>
            </div>

            <div className="mt-5 grid gap-2">
              <Button type="button" onClick={resumeConflictingSession}>
                استئناف الجلسة المحفوظة
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={replaceConflictingSession}
                className="border-red-400/30 text-red-300 hover:bg-red-400/10"
              >
                بدء الجديدة وحذف المحفوظة
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate({ to: "/" })}
              >
                العودة للرئيسية
              </Button>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  if (phase === "done") {
    const minutes = Math.max(
      1,
      Math.round((finishedDurationSec ?? elapsed) / 60),
    );
    return (
      <PageShell>
        <div className="p-6 pt-16 text-center animate-enter">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary mb-3">
            اكتملت الجلسة
          </p>
          <h1 className="text-5xl font-black leading-none mb-2">أحسنت</h1>
          <p className="text-muted-foreground">
            أتممت {completed.size} من {total} تمارين
            {skipped.size ? ` · تخطيت ${skipped.size}` : ""}
          </p>

          <div className="mt-10 grid grid-cols-3 gap-3">
            <StatCard label="المدة" value={`${minutes}د`} />
            <StatCard label="التمارين" value={String(completed.size)} />
            <StatCard label="السعرات" value={`~${completedCalories}`} />
          </div>

          <div className="mt-10 space-y-3">
            <Link
              to="/progress"
              className="block rounded-2xl bg-primary text-primary-foreground py-4 font-black uppercase tracking-widest"
            >
              حفظ ومتابعة التقدم
            </Link>
            <Link
              to="/"
              className="block rounded-2xl border border-border py-4 font-bold text-muted-foreground"
            >
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </PageShell>
    );
  }

  const isRest = phase === "rest";

  return (
    <PageShell>
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="workout-exit-title"
        >
          <div className="w-full max-w-[390px] rounded-3xl border border-border bg-background p-5 shadow-2xl">
            <p className="type-eyebrow text-amber-400">جلسة قيد التنفيذ</p>
            <h2 id="workout-exit-title" className="type-section-title mt-1">
              الخروج من الجلسة؟
            </h2>
            <p className="type-small mt-3 leading-relaxed text-muted-foreground">
              التقدم الحالي لا يُضاف إلى سجل التدريب إلا عند إكمال الجلسة.
              الخروج الآن سيغلق الجلسة بدون حفظ نتائجها الحالية.
            </p>

            <div className="mt-5 grid gap-2">
              <Button type="button" onClick={cancelExit}>
                متابعة الجلسة
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={confirmExitWithoutSaving}
                className="border-red-400/30 text-red-300 hover:bg-red-400/10"
              >
                خروج بدون حفظ
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="p-5 pt-8">
        {/* top bar */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={requestExit}
            className="size-10 rounded-full border border-border grid place-items-center text-lg"
            aria-label="إغلاق الجلسة"
          >
            ✕
          </button>
          <div className="text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              {PHASE_LABEL_AR[current.phase]} · {index + 1} / {total} · مجموعة {setIdx} / {current.sets}
            </p>
            <p className="font-mono text-xs mt-0.5">
              {fmt(elapsed)} · {fmt(Math.max(0, totalDuration - elapsed))}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMuted((m) => !m)}
              className="size-10 rounded-full border border-border grid place-items-center"
              aria-label={muted ? "تشغيل الصوت" : "كتم الصوت"}
              type="button"
            >
              {muted ? (
                <VolumeX className="size-4 text-muted-foreground" />
              ) : (
                <Volume2 className="size-4 text-primary" />
              )}
            </button>
            <button
              onClick={() => {
                if (!running) primeAudio();
                setRunning((r) => !r);
              }}
              className="size-10 rounded-full bg-primary text-primary-foreground grid place-items-center"
              aria-label="إيقاف مؤقت"
              type="button"
            >
              {running ? "⏸" : "▶"}
            </button>
          </div>
        </div>

        {restoredDraft && (
          <div className="mb-4 rounded-2xl border border-cyan/30 bg-cyan/10 p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-cyan">
              جلسة مستعادة
            </p>
            <p className="mt-1 text-xs font-bold">
              استعدنا تقدمك من آخر حفظ على هذا الجهاز.
            </p>
            <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
              الجلسة متوقفة مؤقتًا للأمان. راجع التمرين والمجموعة الحالية ثم اضغط ▶ للمتابعة.
            </p>
          </div>
        )}

        <div
          className={
            "mb-4 rounded-2xl border p-3 " +
            (workout.adaptation.mode === "progress"
              ? "border-primary/30 bg-primary/10"
              : workout.adaptation.mode === "recovery"
                ? "border-cyan/30 bg-cyan/10"
                : "border-border bg-surface/50")
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                استجابة الخطة
              </p>
              <p className="mt-1 text-sm font-black">
                {workout.adaptation.mode === "progress"
                  ? "تقدّم تدريجي"
                  : workout.adaptation.mode === "recovery"
                    ? "استشفاء محسوب"
                    : "ثبات وبناء"}
              </p>
            </div>
            <div className="text-left">
              <p className="font-mono text-xl font-black">
                {workout.adaptation.readinessScore}%
              </p>
              <p className="text-[9px] text-muted-foreground">جاهزية</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            {workout.adaptation.reason}
          </p>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div>
              <p className="text-[9px] text-muted-foreground">
                دورة 4 أسابيع · الأسبوع {workout.periodization.cycleWeek}
              </p>
              <p className="mt-0.5 text-xs font-black">
                {PERIODIZATION_PHASE_LABEL_AR[workout.periodization.phase]}
              </p>
            </div>
            <div className="text-left">
              <p className="font-mono text-xs font-black">
                RIR {workout.periodization.targetRir}
              </p>
              <p className="text-[8px] text-muted-foreground">
                هدف المرحلة
              </p>
            </div>
          </div>
          {workout.periodization.trigger !== "cycle" && (
            <p className="mt-2 rounded-lg border border-border bg-background/50 p-2 text-[9px] leading-relaxed text-muted-foreground">
              {workout.periodization.trigger === "recovery"
                ? "تم تحويل الأسبوع إلى Deload بسبب الاستشفاء."
                : "تم تفعيل Deload مبكر بسبب Plateau متزامن في أكثر من تمرين."}
            </p>
          )}
        </div>

        {workout.safetyAdjusted && workout.screeningInjuries.length > 0 && (
          <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
              فلترة الإصابة فعّالة
            </p>
            <p className="mt-1 text-xs font-bold">
              تم استبعاد الحركات الموسومة احترازيًا لـ{" "}
              {workout.screeningInjuries
                .map((injury) => INJURY_LABEL_AR[injury])
                .join("، ")}.
            </p>
            <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
              هذه فلترة محافظة داخل التطبيق وليست بديلًا عن توجيهات الطبيب أو أخصائي العلاج الطبيعي.
            </p>
          </div>
        )}

        {workout.adaptation.readinessSource === "profile" && (
          <div className="mb-4 rounded-xl border border-dashed border-border bg-background/40 p-3">
            <p className="text-[10px] font-bold text-muted-foreground">
              لم يتم تسجيل Check-in اليوم؛ الجرعة الحالية تستخدم خط الأساس من ملفك الشخصي.
            </p>
            <Link
              to="/"
              className="mt-2 inline-block text-[10px] font-black text-primary"
            >
              سجّل تقييم اليوم
            </Link>
          </div>
        )}

        {current.rotatedFromId && (
          <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3">
            <p className="text-[10px] font-mono uppercase tracking-widest text-amber-400">
              {current.rotationReason === "plateau"
                ? "تدوير بسبب Plateau"
                : current.rotationReason === "manual"
                  ? "استبدال يدوي آمن"
                  : "تدوير Mesocycle"}
            </p>
            <p className="mt-1 text-xs font-bold">
              {getExercise(current.rotatedFromId)?.name ?? current.rotatedFromId}
              {" → "}
              {current.exercise.name}
            </p>
            <p className="mt-1 text-[9px] leading-relaxed text-muted-foreground">
              {current.rotationReason === "manual"
                ? "تم الحفاظ على نمط الحركة والعضلة الأساسية ودور التمرين ونوع القياس، مع التحقق من معداتك وفلترة الإصابات."
                : "تم الحفاظ على نفس نمط الحركة والعضلة الأساسية ونوع المعدات المتاحة؛ سيظل البديل ثابتًا خلال الدورة الحالية لقياس التقدم بشكل عادل."}
            </p>
          </div>
        )}

        {/* progress bar */}
        <div className="h-1 rounded-full bg-surface overflow-hidden mb-4">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* set dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {Array.from({ length: current.sets }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i + 1 < setIdx
                  ? "bg-primary w-6"
                  : i + 1 === setIdx
                    ? "bg-primary w-8 animate-pulse"
                    : "bg-surface w-6"
              }`}
            />
          ))}
        </div>

        {/* Athlete + swipe */}
        <motion.div
          drag={showSwapOptions || showExitConfirm ? false : "x"}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleSwipe}
          className="relative mx-auto mb-4 rounded-3xl border border-border bg-surface/40 overflow-hidden cursor-grab active:cursor-grabbing"
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(rgba(204,255,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(204,255,0,0.12) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
            aria-hidden
          />
          <div className="relative grid place-items-center py-2 min-h-[240px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${index}-${isRest ? "rest" : "work"}`}
                initial={{ opacity: 0, scale: 0.9, filter: "blur(6px)" }}
                animate={{
                  opacity: 1,
                  scale: running && !isRest ? 1 : 0.97,
                  filter: "blur(0px)",
                }}
                exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <AthleteVideo
                  exerciseId={current.exercise.id}
                  pose={isRest ? "cooldown" : current.exercise.pose}
                  running={running && !isRest}
                  tempo={current.exercise.tempo}
                  size={260}
                />
              </motion.div>
            </AnimatePresence>
            {running && !isRest && (
              <motion.div
                className="pointer-events-none absolute inset-0 rounded-3xl ring-2 ring-primary/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.15, 0.55, 0.15] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                aria-hidden
              />
            )}
            {/* swipe hint arrows */}
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center opacity-30">
              <ChevronRight className="size-5" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-2 flex items-center opacity-30">
              <ChevronLeft className="size-5" />
            </div>
          </div>
        </motion.div>

        {/* Breathing guide during rest */}
        {isRest && (
          <div className="text-center mb-2">
            <motion.div
              className="mx-auto rounded-full bg-cyan/20 border border-cyan/40"
              animate={{ scale: [1, 1.5, 1.5, 1], opacity: [0.5, 1, 1, 0.5] }}
              transition={{ duration: 8, repeat: Infinity, times: [0, 0.375, 0.625, 1] }}
              style={{ width: 60, height: 60 }}
            />
            <p className="text-xs font-mono uppercase tracking-widest text-cyan mt-2">
              شهيق ٤ · ثبات ٤ · زفير ٤
            </p>
          </div>
        )}

        {/* ring */}
        <div className="relative mx-auto" style={{ width: ringSize, height: ringSize }}>
          <svg width={ringSize} height={ringSize} className="-rotate-90">
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke="hsl(var(--surface))"
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              cx={ringSize / 2}
              cy={ringSize / 2}
              r={radius}
              stroke={isRest ? "oklch(0.75 0.15 200)" : "oklch(0.9 0.2 130)"}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={circ}
              strokeDashoffset={ringOffset}
              strokeLinecap="round"
              className="transition-[stroke-dashoffset] duration-1000 ease-linear"
              style={{ filter: "drop-shadow(0 0 12px oklch(0.9 0.2 130 / 0.5))" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-2">
                {isRest ? "استراحة" : "نشاط"}
              </p>
              <p
                className={`text-6xl font-black font-mono leading-none tabular-nums ${
                  remaining <= 3 && !isRest ? "text-primary animate-pulse" : ""
                }`}
              >
                {fmt(remaining)}
              </p>
              {!isRest && (
                <p className="mt-2 text-xs font-mono text-primary">{current.reps}</p>
              )}
            </div>
          </div>
        </div>

        {!isRest && isRepExercise(current.reps) && (
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-border bg-surface/60 p-4">
              <div>
                <p className="text-xs font-bold">تكرارات هذه المجموعة</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  الهدف {current.reps} · سجّل العدد الفعلي
                </p>
              </div>
              <div className="flex items-center gap-2" dir="ltr">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="إنقاص تكرار"
                  onClick={() => setCurrentReps((value) => Math.max(0, value - 1))}
                >
                  −
                </Button>
                <output className="w-10 text-center text-2xl font-black tabular-nums">
                  {currentReps}
                </output>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  aria-label="إضافة تكرار"
                  onClick={() => setCurrentReps((value) => Math.min(999, value + 1))}
                >
                  +
                </Button>
              </div>
            </div>

            {current.trackLoad && (
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold">الحمل المستخدم</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {current.exercise.equipment.includes("dumbbells")
                        ? "للدمبل: سجّل وزن الدمبل الواحد"
                        : "سجّل الحمل الفعلي بالكيلوجرام"}
                    </p>
                    {current.lastLoadKg !== undefined && (
                      <p className="mt-1 text-[10px] text-primary">
                        آخر حمل {current.lastLoadKg} كجم
                        {current.suggestedLoadKg !== undefined
                          ? " · المقترح " + current.suggestedLoadKg + " كجم"
                          : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2" dir="ltr">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="خفض الحمل"
                      onClick={() =>
                        setCurrentLoadKg((value) =>
                          Math.max(
                            0,
                            Math.round(
                              (value - (current.loadStepKg ?? 1)) * 100,
                            ) / 100,
                          ),
                        )
                      }
                    >
                      −
                    </Button>
                    <div className="min-w-16 text-center">
                      <output className="text-xl font-black tabular-nums">
                        {currentLoadKg}
                      </output>
                      <span className="mr-1 text-[10px] text-muted-foreground">
                        كجم
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="زيادة الحمل"
                      onClick={() =>
                        setCurrentLoadKg((value) =>
                          Math.round(
                            (value + (current.loadStepKg ?? 1)) * 100,
                          ) / 100,
                        )
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {(current.phase === "main" ||
              current.phase === "accessory" ||
              current.phase === "core") && (
              <div className="rounded-2xl border border-border bg-surface/60 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold">RIR · التكرارات الاحتياطية</p>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      الهدف {current.targetRir} · RPE المقابل الآن{" "}
                      {currentRir === null ? "—" : 10 - currentRir}
                    </p>
                  </div>
                  <div className="flex items-center gap-2" dir="ltr">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="خفض RIR"
                      onClick={() =>
                        setCurrentRir((value) =>
                          value === null
                            ? suggestedRir(current.targetRir)
                            : Math.max(0, value - 1),
                        )
                      }
                    >
                      −
                    </Button>
                    <output className="w-10 text-center text-2xl font-black tabular-nums">
                      {currentRir ?? "—"}
                    </output>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      aria-label="زيادة RIR"
                      onClick={() =>
                        setCurrentRir((value) =>
                          value === null
                            ? suggestedRir(current.targetRir)
                            : Math.min(5, value + 1),
                        )
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
                {currentRir === null && (
                  <button
                    type="button"
                    onClick={() => setCurrentRir(suggestedRir(current.targetRir))}
                    className="mt-3 w-full rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[10px] font-bold text-primary"
                  >
                    تسجيل RIR المستهدف {current.targetRir}
                  </button>
                )}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[9px]">
                  <span className="rounded-lg bg-background/50 px-2 py-1.5 text-muted-foreground">
                    0–1 قريب من الفشل
                  </span>
                  <span className="rounded-lg bg-primary/10 px-2 py-1.5 text-primary">
                    2–3 مستهدف
                  </span>
                  <span className="rounded-lg bg-background/50 px-2 py-1.5 text-muted-foreground">
                    4–5 خفيف
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* exercise info */}
        <div className="mt-8 rounded-3xl bg-surface/60 backdrop-blur border border-border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
            {current.exercise.latin}
          </p>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">{current.exercise.name}</h2>
            {completed.has(current.exercise.id) && (
              <span className="size-7 rounded-full bg-primary text-primary-foreground grid place-items-center">
                <Check className="size-4" strokeWidth={3} />
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 mb-3">{current.exercise.primary.join(" · ")}</p>
          <div className="border-t border-border pt-3">
            <p className="text-sm leading-relaxed">
              <span className="text-primary font-bold">تنبيه المدرب: </span>
              {current.exercise.cue}
            </p>
          </div>

          {(current.phase === "main" ||
            current.phase === "accessory" ||
            current.phase === "core") && (
            <div className="mt-3 rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-primary">
                {current.progressionAction === "increase-load"
                  ? "↑ ارفع المقاومة"
                  : current.progressionAction === "build-reps"
                    ? "↗ ابنِ التكرارات"
                    : current.progressionAction === "reduce"
                      ? "↓ خفّض الحمل"
                      : "→ ثبّت الحمل"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/80">
                {current.progressionNote}
              </p>
            </div>
          )}

          {canSwapCurrent && (
            <div className="mt-4 rounded-2xl border border-border bg-background/50 p-3">
              <button
                type="button"
                onClick={toggleSwapOptions}
                className="flex min-h-11 w-full items-center justify-between gap-3 text-right"
              >
                <span>
                  <span className="flex items-center gap-2 text-xs font-black">
                    <RefreshCcw className="size-3.5 text-primary" />
                    استبدال ببديل مكافئ
                  </span>
                  <span className="mt-1 block text-[9px] leading-relaxed text-muted-foreground">
                    متاح قبل إنهاء المجموعة الأولى فقط، مع الحفاظ على نمط الحركة وفلترة المعدات والإصابات.
                  </span>
                </span>
                <span className="text-xs text-primary">
                  {showSwapOptions ? "−" : "+"}
                </span>
              </button>

              {showSwapOptions && (
                <div className="mt-3 space-y-2 border-t border-border pt-3">
                  {swapOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => applyManualSwap(option.id)}
                      className="w-full rounded-xl border border-border bg-surface/60 p-3 text-right transition-colors hover:border-primary/40 hover:bg-primary/5"
                    >
                      <span className="block text-xs font-black">
                        {option.name}
                      </span>
                      <span className="mt-1 block text-[9px] text-muted-foreground">
                        {MOVEMENT_FAMILY_LABEL_AR[option.movementFamily]}
                        {" · "}
                        {option.equipment
                          .map((item) => EQUIPMENT_LABEL_AR[item])
                          .join(" · ")}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={toggleSwapOptions}
                    className="min-h-10 w-full rounded-xl border border-dashed border-border text-[10px] font-bold text-muted-foreground"
                  >
                    إلغاء ومتابعة التمرين الحالي
                  </button>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowRefs((s) => !s)}
            className="mt-4 w-full flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:text-primary"
          >
            <span className="inline-flex items-center gap-2">
              <BookOpen className="size-3" />
              المرجع العلمي
            </span>
            <span>{showRefs ? "−" : "+"}</span>
          </button>
          {showRefs && (
            <p className="mt-2 text-[11px] leading-relaxed text-foreground/80 border-r-2 border-primary/60 pr-3">
              {current.exercise.reference}
            </p>
          )}
        </div>

        {/* next */}
        {next && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-border p-4">
            <div className="size-10 rounded-xl bg-primary/20 grid place-items-center text-primary font-mono">
              {index + 2}
            </div>
            <div className="flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                التالي
              </p>
              <p className="font-bold text-sm">{next.exercise.name}</p>
            </div>
            <button
              onClick={skipCurrentExercise}
              className="text-xs font-mono text-primary"
              type="button"
            >
              تخطي ↩
            </button>
          </div>
        )}

        {/* protocol footer */}
        <p className="mt-6 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center leading-relaxed">
          البروتوكول مبني على ACSM · NSCA · NASM · WHO · اسحب يميناً/يساراً للتنقل
        </p>
      </div>
    </PageShell>
  );
}

function suggestedRir(range?: string): number {
  if (!range) return 2;
  const match = range.match(/\d+/);
  return match ? Math.max(0, Math.min(5, Number(match[0]))) : 2;
}

function suggestedReps(reps?: string): number {
  if (!reps) return 0;
  const match = reps.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function isRepExercise(reps: string): boolean {
  return !reps.includes("دقائق") && suggestedReps(reps) > 0;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface/60 border border-border p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-2xl font-black font-mono">{value}</p>
    </div>
  );
}
