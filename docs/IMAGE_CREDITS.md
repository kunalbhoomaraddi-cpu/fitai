# Image Credits & Licensing

## Bundled artwork (in the repo)
`frontend/public/images/art/*.svg`: 57 original illustrations made for FitAI (scene backgrounds, workout categories, plated-meal illustrations and muscle-group diagrams). They're generated programmatically and owned by the project, with no third-party rights.

## Photography (in the repo)
`frontend/public/images/photos/*.jpg`: 46 curated photos from **Unsplash**, listed in `scripts/photos.txt`, resized to 1280 px and stored in the repo so the live site and local copies look the same. They're served from FitAI's own domain, never hotlinked. `scripts/fetch_photos.sh` can re-download the originals.

- License: [Unsplash License](https://unsplash.com/license). Free for commercial and non-commercial use, no permission or attribution required (credit appreciated). You may not sell unaltered copies or build a competing stock-photo service.
- If a photo is ever missing, the app shows the matching bundled artwork automatically.
- To swap a photo, edit its ID in `scripts/photos.txt`, delete the old JPG and rerun the script.

## Third-party data
- Food data: **Open Food Facts**, under the Open Database License (ODbL). Content is community-contributed and may be incomplete.
- Exercise data and images: **wger** (https://wger.de). Exercise content is CC-BY-SA, and attribution is shown in the UI when a wger image appears.
- Reference nutrition values: typical averages compiled from public generic-food references (USDA FoodData Central style). They're labelled as estimates in the UI.

## Motivational quotes
All 35 daily quotes are original FitAI content.


## Exercise demo photos

`frontend/public/images/exercises/` and the step-by-step instructions in `frontend/src/data/exerciseDemos.ts` come from
[free-exercise-db](https://github.com/yuhonas/free-exercise-db), released into the **public domain** (Unlicense).
They were resized and converted to WebP by `scripts/build_exercise_demos.py`. Notes marked as FitAI-written (e.g. kettlebell swing and side plank steps) are original.
