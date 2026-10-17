# RacePace

Private half-marathon pace planning for the supplied Taipei course, in Traditional Chinese and English. Use the EN/ZH buttons in the header to switch languages; your choice is remembered in this browser. This repository contains the original Python prototype and the first React/TypeScript migration described in `RacePace_SYSTEM_DESIGN_v1.md`.

## Current scope — Milestone 1

- Interactive Leaflet route map with 1,847 original KML coordinates and four checkpoints.
- 5:30, 6:30, 7:00 and custom pace; start delay; arrival and cutoff-margin predictions.
- Separate declared race distances and KML geometry distances throughout.
- Editable start/cutoff times, browser-local settings and recent change history.
- CSV prediction export and GeoJSON course download.
- Responsive desktop/mobile layout and an explicit future-workout-import empty state.
- EN/ZH interface, map labels, validation, settings history and CSV exports; changing language preserves race settings.

FIT/TCX/GPX import, GPS matching, workout history, D1/R2 storage and multi-user accounts are **not implemented** in this first version. No workout data is collected. Map tiles load from OpenStreetMap and typography from Google Fonts; settings remain in the current browser. The site is deployed privately with access limited to its owner.

## Run locally

Requires Node.js 22.12+ (Node 24 also works). Python 3 is used only to regenerate/check course assets.

```sh
cd web
npm ci
npm run dev
```

Open the URL printed by Vite. For a production build:

```sh
cd web
npm test
npm run build
npm run preview
```

## Verify source data

```sh
python3 scripts/prepare_course.py --check
```

Omit `--check` to regenerate the course JSON, GeoJSON and golden results from the original ZIP. Golden results are the supplied Python-produced `pace_comparison.csv`; no Python geospatial dependencies are needed to run web tests. `legacy-python/README.md` contains the original Streamlit setup instructions.

Prediction uses annotated distances 7.1, 11.1, 17.9 and 21.0975 km. The corresponding KML distances are about 7.430, 11.377, 18.671 and 21.719 km. Times are race-local wall-clock times in Asia/Taipei, independent of the browser's timezone. The model handles one race day; cutoff times must increase after the start.

At 7:00/km, Python formats the fractional finish time as **09:27:40** by truncation. The design document rounds it to 09:27:41. The web app deliberately matches the supplied golden CSV; the difference is presentation only. Risk is calculated using unrounded seconds.

## Repository layout

| Path | Purpose |
| --- | --- |
| `web/` | React/TypeScript application, tests, lockfile and Sites manifest |
| `legacy-python/` | Unmodified original app, requirements, README and KML |
| `data/fixtures/` | Original supplied CSV fixtures |
| `scripts/prepare_course.py` | Deterministic data generation and verification |
| `docs/DEPLOYMENT.md` | Save/deploy process, scope and verification |
| `.github/workflows/ci.yml` | Data checks, tests, typecheck and production build |

GitHub remains the editable source repository. Sites uses a separate synchronized release checkout. A GitHub push alone does not deploy the site. See [deployment notes](docs/DEPLOYMENT.md).
