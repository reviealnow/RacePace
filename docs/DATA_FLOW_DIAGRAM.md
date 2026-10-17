# Data flow diagram

RacePace · current implementation as of 2026-10-17.

The deployed site is a static React app: pace calculations and settings storage run in the user's browser. The repository also retains a separate Python/Streamlit prototype with workout analysis. The diagrams below describe the implemented flows; the broader [system design](../RacePace_SYSTEM_DESIGN_v1.md) includes future work.

Arrows show the data being transferred. Rounded nodes are processing steps, cylinders are data stores, and rectangular nodes are inputs, outputs or external services. Mermaid diagrams render directly on GitHub.

## 1. Deployed web app: pace planning

```mermaid
flowchart TB
    Runner["Runner"]
    Host["Owner-private Sites hosting"]
    Files["Downloaded files"]

    subgraph Browser["User's browser"]
        Assets["Static HTML, JS, CSS and bundled course.json"]
        UI("React controls and state<br/>main.tsx")
        Engine("Validate and predict<br/>engine.ts")
        Results("Summary and checkpoint table")
        CSV("Local CSV generation<br/>csvExport + Blob")
        Lang("EN/ZH presentation<br/>i18n.ts")
        Settings[("localStorage<br/>racepace-settings-v1")]
        History[("localStorage<br/>racepace-history-v1")]
        Pref[("localStorage<br/>racepace-language-v1")]
    end

    Host -->|"App assets and bundled course data"| Assets
    Assets -->|"Default start time and cutoffs"| UI
    Assets -->|"Checkpoint declared distances and metadata"| Engine
    Runner -->|"Pace, start delay, start time, cutoffs, EN/ZH"| UI
    Settings -->|"Restore saved settings; validate or use defaults"| UI
    UI -->|"Current scenario"| Engine
    Engine -->|"Arrival, margin, risk or validation error"| Results
    UI -->|"Persist valid settings"| Settings
    UI -->|"Saved/reset race-time changes; keep latest 10"| History
    History -->|"Recent change entries"| UI
    Pref -->|"Restore language; default ZH"| UI
    UI -->|"Persist language choice"| Pref
    UI -->|"Selected language"| Lang
    Lang -->|"Translated labels and errors"| Results
    Engine -->|"Prediction rows"| CSV
    Lang -->|"CSV headers and display labels"| CSV
    Runner -->|"Export CSV action"| CSV
    CSV -->|"racepace-pace-plan.csv"| Files
    Host -->|"Requested course/route.geojson download"| Files
    Results -->|"Scenario estimates"| Runner
```

The prediction engine uses these values, all in seconds except distance:

```text
elapsed = declaredKm × paceSecondsPerKm
arrival = startSeconds + delayMinutes × 60 + elapsed
margin  = cutoffSeconds − arrival
```

Risk is `safe` at ≥600 seconds, `watch` at 300–599, `tight` at 0–299, and `late` below 0. Calculations use unrounded values; displayed clock times truncate fractional seconds. Race times are Asia/Taipei wall-clock values for a single race day.

The KML geometry length (~21.719 km) is separate from the declared race distance (21.0975 km). Geometry does **not** determine pace predictions. Invalid settings display an error and are not persisted; the CSV button is disabled when there are no valid prediction rows. Storage failures leave the app usable for the current session.

## 2. Deployed web app: map and language

```mermaid
flowchart LR
    Course["Bundled course.json<br/>1,847 coordinates + 4 checkpoints"]
    Choice["EN/ZH selection"]
    Provider["OpenFreeMap<br/>OpenStreetMap-based vector data"]
    Fonts["Google Fonts"]

    subgraph Browser["User's browser"]
        Overlay("Leaflet route and markers<br/>RouteMap in main.tsx")
        Base("MapLibre renderer + bundled worker<br/>basemap.ts")
        Names("Geographic name selection<br/>map-language.ts")
        Translation("UI and popup translation<br/>i18n.ts")
        Map["Combined interactive map"]
        Page["App typography"]
    end

    Course -->|"Coordinates, checkpoint positions and distances"| Overlay
    Choice -->|"Language"| Translation
    Translation -->|"Legends, zoom titles, marker popups"| Overlay
    Choice -->|"Language"| Names
    Names -->|"Name-field expression"| Base
    Base -->|"Style, tile, sprite and glyph requests"| Provider
    Provider -->|"Vector features, name properties and map assets"| Base
    Base -->|"Localized basemap"| Map
    Overlay -->|"Race line, start, checkpoints and finish"| Map
    Page -->|"Font requests"| Fonts
    Fonts -->|"Stylesheets and font files"| Page
```

English prefers `name:en`, `name_en`, then `name:latin`; Chinese prefers `name:zh-Hant`, `name:zh_TW`, then `name:zh`. Both fall back to the source `name` when translations are missing. Road numbers and other non-name labels remain unchanged. Switching language updates the existing map, preserving its view and route overlay.

The renderer loads separately from the main application. A basemap loading error shows a localized notice; the Leaflet race overlay remains available. External map/font requests are part of the runtime flow, but the app does not send pace settings, change history or workout files to these services.

## 3. Course preparation, validation and publication

```mermaid
flowchart TB
    Archive[("half_marathon_watch_system.zip<br/>Original supplied data")]
    Prep("scripts/prepare_course.py")
    Course[("web/src/data/course.json")]
    Geo[("web/public/course/route.geojson")]
    Golden[("web/tests/golden.json<br/>12 reference predictions")]
    Source[("GitHub repository<br/>web source + generated assets")]
    CI("GitHub Actions validation<br/>prepare_course --check, tests, build")
    Build("Local verification and Vite build")
    Dist[("web/dist<br/>Static app, map worker and GeoJSON")]
    Release("Sites workflow helper<br/>Separate .sites-checkout")
    SitesSource[("Pushed Sites source commit")]
    Package[("Deployment archive<br/>dist + hosting manifest")]
    Saved("Save version for the exact source commit")
    Deploy("Deploy saved version privately")
    Host["Live Sites URL"]

    Archive -->|"Longest KML LineString + checkpoints.csv + pace_comparison.csv"| Prep
    Prep -->|"Route, checkpoints and defaults"| Course
    Prep -->|"Route geometry"| Geo
    Prep -->|"Supplied Python-produced expected results"| Golden
    Course -->|"Tracked generated file"| Source
    Geo -->|"Tracked generated file"| Source
    Golden -->|"Tracked test fixture"| Source
    Source -->|"Push or pull request snapshot"| CI
    Source -->|"Working checkout"| Build
    Build -->|"Verified static output"| Dist
    Source -->|"Mirror web source into release checkout"| Release
    Dist -->|"Matching build output"| Release
    Release -->|"Synchronize, commit and verify source push"| SitesSource
    Release -->|"Package matching static assets"| Package
    SitesSource -->|"Exact commit SHA"| Saved
    Package -->|"Unchanged archive"| Saved
    Saved -->|"Saved version"| Deploy
    Deploy -->|"Successful production release"| Host
```

`prepare_course.py` reads the original ZIP directly, not the extracted files in `data/fixtures/` or `legacy-python/`. It takes checkpoint distances from the supplied CSV rather than recalculating them. `--check` compares the generated content with the tracked files without changing them. Tests compare the TypeScript predictions with the 12 supplied reference results and validate language-selection behavior.

GitHub CI validates the repo; it does not deploy. Sites publication uses a separate source history, a matching build archive and a saved version. GitHub pushes alone do not update the live site. See [deployment notes](DEPLOYMENT.md) for release identifiers and the publication procedure.

## 4. Legacy Python prototype: workout analysis

This flow runs only when the original Streamlit application is started separately. It is not part of the deployed React app.

```mermaid
flowchart TB
    User["Runner using Streamlit"]
    Default["Bundled KML"]

    subgraph Python["Machine running Streamlit"]
        Temp[("Temporary uploaded files")]
        KML("parse_kml<br/>core.py")
        Course[("In-memory route geometry and gates")]
        Predict("predicted_gates")
        Parse("parse_training<br/>FIT / TCX / GPX")
        Samples[("UTC GPS samples<br/>Optional heart rate and cadence")]
        Snap("project_workout<br/>Route position and off-route distance")
        Passage("checkpoint_passages<br/>Interpolate eligible forward crossings")
        Splits("workout_checkpoint_splits<br/>Conditional race-clock projection")
        View["Streamlit tables, route map and charts"]
        Export["GPS analysis and available split CSVs"]
    end

    User -->|"Optional KML or workout upload"| Temp
    Default -->|"Default course"| KML
    Temp -->|"Replacement KML"| KML
    KML -->|"Projected route, declared distances and gate times"| Course
    Course -->|"Gate distances and cutoffs"| Predict
    User -->|"Pace, race start, delay and optional finish cutoff"| Predict
    Predict -->|"Scenario arrivals and margins"| View
    Course -->|"Route and marker coordinates"| View
    Temp -->|"Workout file"| Parse
    Parse -->|"Sort and deduplicate timestamped samples"| Samples
    Samples -->|"GPS coordinates and timestamps"| Snap
    Course -->|"Metric course geometry"| Snap
    Snap -->|"Projected samples; on-route within 70 m"| Passage
    Course -->|"Gate geometry positions"| Passage
    Passage -->|"Observed passage times or unknown"| View
    Snap -->|"Projected workout samples"| Splits
    Course -->|"Gates; passage calculation reused internally"| Splits
    User -->|"Race start and delay"| Splits
    Splits -->|"Available splits or explanatory notice"| View
    Snap -->|"GPS diagnostics and recorded metrics"| View
    Snap -->|"Analyzed GPS rows"| Export
    Splits -->|"Available split rows"| Export
    Export -->|"CSV downloads"| User
```

Uploads are written to temporary files on the machine running Streamlit. Parsing normalizes timestamps to UTC. GPS matching uses projected metric geometry; eligible crossings require nearby, forward-moving samples within the code's time/distance thresholds. Split projection requires the first on-route sample to be within the first 0.10 km of the course and stops at the first unknown checkpoint. This remains prototype matching and can be ambiguous on loops or nearby parallel streets.

The live web app currently has an import placeholder only. Workout parsing, GPS matching, durable workout history, D1/R2 storage and application-level multi-user accounts are future migration work, not active web data flows.

## Source references

| Responsibility | Implementation |
| --- | --- |
| UI state, local storage, map overlay and downloads | [main.tsx](../web/src/main.tsx) |
| Validation, pace predictions and CSV encoding | [engine.ts](../web/src/engine.ts) |
| Interface translations | [i18n.ts](../web/src/i18n.ts) |
| Vector basemap and name selection | [basemap.ts](../web/src/basemap.ts), [map-language.ts](../web/src/map-language.ts) |
| Deterministic course asset generation | [prepare_course.py](../scripts/prepare_course.py) |
| Validation workflow | [ci.yml](../.github/workflows/ci.yml) |
| Hosting configuration | [hosting.json](../web/.openai/hosting.json) |
| Original workout processing | [app.py](../legacy-python/app.py), [core.py](../legacy-python/core.py) |
