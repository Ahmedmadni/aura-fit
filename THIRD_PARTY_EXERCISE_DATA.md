# Third-party exercise data and media

Aura Fit's exercise catalog was rebuilt on 2026-09-29. The app no longer uses the previous hand-written exercise list or generic per-pattern motion clips.

## Workout Guide — canonical catalog and visual frames

- Repository: https://github.com/bryllim/workout-guide
- Pinned commit: aac599224bb9780305239607ef98540b7e0ce389
- Imported catalog entries: 302
- Software / structured metadata license: MIT
- Visual assets license: CC BY-SA 4.0
- Visual attribution: Bryl Lim / Everkinetic
- Asset adaptations remain subject to CC BY-SA 4.0.

MIT notice:

MIT License

Copyright (c) 2026 Bryl Lim

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

Visual license: https://creativecommons.org/licenses/by-sa/4.0/

The original pose artwork used by Workout Guide comes from Everkinetic under
CC BY-SA 4.0. Bryl Lim expanded the set with additional exercises, normalized
assets, structured metadata and animation frames.

## exercises-dataset — instruction text only

- Repository: https://github.com/hasaneyldrm/exercises-dataset
- Safely matched instruction records imported: 78
- Used fields: English instruction text / steps and exercise metadata for exact high-confidence matches.
- License for code, dataset structure and instruction text: MIT.
- No images or GIFs from this repository are used by Aura Fit.

The upstream repository explicitly states that its images and GIFs are
© Gym Visual and are not covered by its MIT license. Aura Fit therefore does
not copy or hotlink those media files.

MIT notice:

MIT License

Copyright (c) 2026 Hasan Emir Yıldırım

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation and data files (the "Software"),
to deal in the Software without restriction, including without limitation the
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
sell copies of the Software, subject to inclusion of the copyright and
permission notice.

## Other repositories reviewed but not imported

### azilRababe/Exercises_Dataset

The repository metadata describes an MIT project, but its GIF indexes point to
third-party files hosted on fitnessprogramer.com. The repository alone does
not establish a reusable license for those third-party media, so Aura Fit does
not import or hotlink them.

### ExerciseDB/exercisedb-api

The repository code is AGPL-3.0 and its README directs API/media usage to
separate documentation, plans and Terms of Use. Aura Fit does not copy
ExerciseDB media or API data in this import.

## Integrity rule

Exercise visual media must be tied to the same canonical exercise record as
the displayed title. If a trustworthy technical-instruction match is
unavailable, Aura Fit shows the canonical metadata and exact visual frames
rather than inventing detailed form instructions.
