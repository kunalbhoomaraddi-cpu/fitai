# Image Credits & Licensing

## Bundled artwork (in the repo)
`frontend/public/images/art/*.svg`: 57 original illustrations made for FitAI (scene backgrounds, workout categories, plated-meal illustrations and muscle-group diagrams). They're generated programmatically and owned by the project, with no third-party rights.

## Photography (downloaded locally)
`scripts/fetch_photos.sh` downloads 46 curated photos listed in `scripts/photos.txt` from **Unsplash** into `frontend/public/images/photos/`, so they're served locally rather than hotlinked.

- License: [Unsplash License](https://unsplash.com/license). Free for commercial and non-commercial use, no permission or attribution required (credit appreciated). You may not sell unaltered copies or build a competing stock-photo service.
- If a photo can't be downloaded (offline, or removed by its author), the app shows the matching bundled artwork automatically.
- To swap a photo, edit its ID in `scripts/photos.txt`, delete the old JPG and rerun the script.

## Third-party data
- Food data: **Open Food Facts**, under the Open Database License (ODbL). Content is community-contributed and may be incomplete.
- Exercise data and images: **wger** (https://wger.de). Exercise content is CC-BY-SA, and attribution is shown in the UI when a wger image appears.
- Reference nutrition values: typical averages compiled from public generic-food references (USDA FoodData Central style). They're labelled as estimates in the UI.

## Motivational quotes
All 35 daily quotes are original FitAI content.
