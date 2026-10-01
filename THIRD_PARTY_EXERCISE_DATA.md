# Third-party exercise data and media

Aura Fit keeps the 302-exercise Workout Guide catalog as the canonical application catalog and uses verified hasaneyldrm media as the preferred motion layer.

## Workout Guide — canonical catalog and fallback frames

- Repository: https://github.com/bryllim/workout-guide
- Pinned commit: aac599224bb9780305239607ef98540b7e0ce389
- Aura Fit catalog entries: 302
- Three exercise-specific frames remain available for every catalog entry.
- These frames are the deterministic fallback when no preferred GIF is approved or when a preferred asset fails to load.

## hasaneyldrm/exercises-dataset — preferred GIF/poster layer

- Repository: https://github.com/hasaneyldrm/exercises-dataset
- Pinned source commit: 7455efae41b330c265e7cd4b78dfa848e7ce5ebd
- Indexed source exercises: 1324
- Aura Fit exercises evaluated: 302
- Exact approved matches: 79
- High-confidence approved matches: 71
- Review required: 98
- No safe match: 54
- Preferred GIFs enabled in the app: 150

Only `exact` and `high` entries in `src/data/exercise-media-map.json` receive an active GIF/poster. A `review` entry never loads its candidate media automatically.

## Runtime media policy

1. Library cards use the static poster for approved mappings; otherwise they use frame 1.
2. Library cards never load all GIFs.
3. Exercise detail/workout views load the approved GIF only for the current exercise.
4. If the GIF/poster fails, the media player falls back to the three Workout Guide frames.
5. Candidate mappings marked `review` stay disabled until manually promoted.
6. A media link must agree with the exercise movement, equipment as closely as the catalogs allow, and the target muscle before promotion.

The legacy `exercise-gymvisual-media.json` file is retained only as import history; `exercise-media-map.json` is the canonical runtime mapping.
