<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Exercise motion media is sourced from the canonical Workout Guide manifest. Every exercise uses its own three exact frames; never substitute a generic movement clip for another exercise. Keep CC BY-SA attribution visible.
- Completed workout entries keep optional per-set repetition arrays so daily best-set reports remain compatible with older local records.
- Training data stays local-first: the app must work fully without a backend, and Cloud sync is an optional layer that never blocks or deletes local records.
- Backend origin validation must accept both the managed Cloud proxy host and the direct database host; a host-format check that allows only one of them silently disables the entire cloud layer.
- Android target validation applies both in Gradle and the workflow entry point; the isolated placeholder compile check is restricted to explicit debug-only tasks so it cannot become a distributable release target.
