## Phase 3 — AI Workout Engine & Interactive Training

Massive scope. I'll ship it in one coherent pass focused on architecture + high-impact UX, staying inside the existing cyber-athletic design (no redesigns).

### 1. Data & Engine Layer (new, modular, offline-friendly)
- `src/lib/exercise-db.ts` — scalable exercise schema (name, category, difficulty, equipment, primary/secondary muscles, cues, mistakes, safety, alternatives, progression/regression chain, calories/min, tempo, pose id, references). Seed ~40 exercises across push/pull/legs/core/HIIT/mobility as the extensible base (structure supports 1,000+).
- `src/lib/workout-engine.ts` — pure functions:
  - `generateWorkout({profile, goal, duration, equipment, injuries, fatigue, history})`
  - `progressiveOverload(history)` · `deloadWeek(week)` · `weeklyPlan()` · `monthlyProgram()`
  - `replaceUnsafe(exercise, restrictions)` → nearest safe alternative
  - `scoreIntensity()` · `estimateCalories()`
- `src/lib/user-profile.ts` — localStorage-backed profile (level, goals, equipment, injuries, sleep, fatigue, history). Offline-capable, ready to swap for Cloud later.
- `src/lib/pose-detection.ts` — **stubs only** (interfaces + no-op impl) for future camera/skeleton/accuracy pipeline. Zero CV deps now.

### 2. Interactive Workout Player (upgrade existing `/workout`)
Keep current visuals; extend with:
- Sets × reps tracking, swipe gestures between exercises (framer-motion drag), fullscreen toggle, landscape support.
- Live stats HUD: calories, active/rest time, total reps/sets, intensity, performance score.
- Rest screen: countdown + breathing guide (expanding ring) + hydration nudge + next-exercise preview.
- Achievement celebration overlay (XP/badge burst) on completion.

### 3. Motion Coaching (pre-exercise briefing)
New `src/components/exercise-briefing.tsx` shown before each exercise:
- Animated 2D athlete (reuse existing), male/female toggle, tempo slow-mo control.
- Tabs: Setup · Execution · Breathing · Common Mistakes · Safety (✔/❌ with highlighted joints).
- "Start" / "Skip briefing" actions.

### 4. New Routes
- `/library` — massive exercise library with advanced filters (goal, muscle, equipment, difficulty, duration, injury-safe, location). Grid + search.
- `/builder` — custom workout builder: pick from library, drag-reorder (framer-motion Reorder), sets/reps/rest per item, save as template to localStorage, favorite/share.
- `/progression/$exerciseId` — visualize the progression ladder (Push-up → … → One-arm push-up) with current level highlighted.
- Extend `/progress` with history charts (completed workouts, PRs, streaks, XP) using lightweight SVG.
- Extend `/exercise/$id` briefing tabs to consume new DB.

### 5. Achievements & Gamification
- `src/lib/achievements.ts` — XP curve, level, badges, streaks, PRs; persisted locally; hook `useAchievements()`.
- Toast + cinematic celebration on unlock.

### 6. Micro-interactions
- Number count-up hook, ripple button primitive, progress ring primitive, page transition wrapper (already partial) — added where it strengthens existing screens without redesigning them.

### 7. Bottom nav
Add `Library` and `Builder` entries alongside existing tabs.

### Out of scope (explicit)
- No real computer-vision / camera pose detection — architecture only.
- No wearable SDK integration — HR shown only if a value is present in profile.
- No backend/Cloud yet — everything persists in localStorage so it works offline and is trivially portable to Cloud later.
- No redesign of existing screens; only additive changes and new routes.

### Technical notes
- Pure TS engine, no new heavy deps (uses existing framer-motion, lucide, tanstack router).
- Everything typed; exercises DB exported so future entries scale to 1,000+ without code changes.
- All new routes get proper `head()` metadata + `errorComponent` + `notFoundComponent`.
