# Five-second workout replay and MP4 export

Enhancement on `feature/workout-replay-export`, integrated into the existing RacePace application. Requirements originated in the user's RacePace Feature Extension Package, documents 01 and 02, and subsequent vertical-video layout review.

## Architecture and integration

RacePace remains the same React/TypeScript/Vite static app. `main.tsx` owns navigation and race settings; `engine.ts` owns predictions/CSV; `basemap.ts` owns the Leaflet/MapLibre basemap and worker; `map-language.ts` selects EN/ZH geographic labels. Course data, race engine, local preferences, legacy Python and deployment manifest are unchanged.

The existing local `workout-import.ts` SAX/FIT parsers, `workout.ts` data model/interpolation and `WorkoutReplay.tsx` preview are reused. Additions:

| File | Responsibility |
| --- | --- |
| `web/src/ReplayExport.tsx` | Codec detection, render/cancel state, privacy option, video preview, download/share and object URL cleanup |
| `web/src/replay-video.ts` | H.264 encoding and MP4 muxing with lazy-loaded Mediabunny; no backend |
| `web/src/replay-render.ts` | Frozen canvas background, full coloured route, pins, runner, stats, attribution, deterministic frame schedule |
| `web/src/export-basemap.ts` | Separate offscreen instance of existing MapLibre style; bounded load, capture, cleanup and fallback |
| `web/src/StaticRoute.tsx` | Untimed GPX geometry-only preview with replay/export disabled |
| `web/tests/replay-video.test.ts` | Frame timing, unequal-time equal-distance legs, stops, missing timestamps, projection |
| `web/scripts/verify-replay-video.py` | ffprobe/ffmpeg inspection of actual downloaded artifacts |

Navigation is labelled Workout Replay / 運動重播. New controls follow the established green/cream UI. Existing Apple XML, TCX and FIT support is retained; no history, cloud storage or new infrastructure is introduced.

## Correctness and missing data

The source timeline maps to five seconds using the existing timestamp interpolation. All route vertices remain present. Recording order must be monotonic; reverse timestamps are rejected. Small interior timestamp collisions are resolved in recording order by evenly spacing the colliding positions before the next valid timestamp. Repair requires a following interval of at most two seconds, at most five positions per group, no track boundary, and no more than max(1, floor(point count × 1%)) adjusted points. Endpoint collisions and ambiguous cases remain errors. Original timestamps are retained in memory as provenance; the source file is never changed. The UI and video disclose estimated timing/speed. Exact duplicate time/position samples are coalesced. Short-segment linear latitude/longitude interpolation uses the shortest longitude arc; this is appropriate for dense running GPS samples. Sparse/jumpy intervals remain flagged rather than silently deleted; distinct GPX segments are not bridged. No GPS cleaning is claimed to recover missing locations.

A GPX with entirely absent timestamps receives a static route-only preview. Partial or malformed timestamps remain an actionable error. No timeline is invented for missing timestamps. For bounded duplicate-time repairs, local GPS-derived speed uses the disclosed estimated timing. Optional mismatched XML reports an error while retaining a newly imported valid route. XML summaries never manufacture GPS points or point-level pace.

Export contains 150 frames at 30 fps, timestamps `i / 30`, durations `1 / 30`, total 5.000 seconds. Frames 0–148 use source elapsed `T * i / 150`; frame 149 explicitly renders the exact endpoint, a documented one-frame finish convention. No time is added for opening/closing cards. Preview is continuous; the export samples the same interpolation function. Screen refresh, browser suspension and rendering cost do not alter encoded timestamps.

## Rendering and privacy

The social export is 1080×1920 (9:16), 30 fps and exactly five seconds. A separate MapLibre instance fits the entire track into the tall map area, uses the same public OpenFreeMap bright style and EN/ZH expressions, then freezes its canvas. Route, pins, moving dot, distance, average pace, time, average speed and RacePace branding are explicitly painted into the video. The top-right date uses day/month/year and the workout's local time. When available, a vector weather icon represents the nearest hourly conditions at the workout start. The footer omits the countdown and duplicate current-speed value. Map credits remain visible at 10 px. This does not capture arbitrary DOM or depend on real-time MediaRecorder timing.

Map loading is bounded to 15 seconds. A canvas read checks origin cleanliness. On failure, export continues with a clearly labelled route-only background. Users may explicitly choose this background to hide place labels. It does not anonymize route shape or trim endpoints. Exports omit original filename, date, Health source and GPS metadata; the drawn route is still sensitive. Nothing is automatically shared. Native sharing is offered only when file sharing is supported, with download as fallback.

Files and video buffers stay in browser memory. Saved runs use the private authenticated workout library documented separately. The interactive map and optional video map request map assets from OpenFreeMap, revealing the viewed geographic area to the provider. For weather, the app rounds the start coordinate to two decimals and sends that approximate location plus the workout date to Open-Meteo; the export continues without a weather icon if the request fails. The privacy option affects the exported background, not the already-loaded interactive map. Nothing is automatically shared.

[OpenFreeMap](https://openfreemap.org/) documents its open map data and attribution requirements. Every map-backed frame retains OpenFreeMap, OpenMapTiles, OpenStreetMap contributors and the copyright URL. The route-only fallback contains no provider imagery. Satellite imagery is deferred; no provider key or secrets are embedded.

The [Mediabunny writing API](https://mediabunny.dev/guide/writing-media-files) supplies MP4 muxing with explicit frame timestamps and cancellation. The installed package is bundled locally; it does not send video to a service. Unsupported H.264 encoding disables export with a localized explanation. No silent substitution of WebM for MP4. No fallback server is introduced.

## Verification — 2026-10-18

- `npm ci` completed; npm audit reported zero vulnerabilities after adding Mediabunny.
- 24 tests pass: original 10 simulator/map-language tests plus replay/import/video tests. Original 1,847 route points, four checkpoints and all 12 golden predictions pass `prepare_course.py --check`.
- TypeScript/Vite production build passes. Existing large map-bundle warning remains.
- Desktop in-app browser: timed synthetic GPX import, H.264 capability check, map capture, export/cancel/retry, route-only option, download, inline playback to `ended=true` at 5 seconds.
- Responsive 390×844 check: EN/ZH switching and no page-wide overflow (`scrollWidth = innerWidth = 390`). This is not physical iPhone testing.
- Two actual browser-generated MP4 files were downloaded and independently inspected:

| Artifact | Codec / pixel format | Resolution / fps | Frames / duration | Size | Unique decoded map frames |
| --- | --- | --- | --- | --- | --- |
| Synthetic Taipei demo with map | H.264 / yuv420p | 960×720 / 30 | 150 / 5.000000 s | 953,925 bytes | 150 |
| Imported variable-speed GPX, route-only | H.264 / yuv420p | 960×720 / 30 | 150 / 5.000000 s | 156,539 bytes | 125 |

The fixture has equal-distance legs of 60 and 30 seconds with a 30-second stationary interval. Decoded map pixels during the stop differ by only 0.0014/255 mean intensity (codec noise), versus 0.4049/255 across a moving interval. Unit tests independently prove timestamp-weighted positions and endpoint placement. Both exports have one video stream and no audio. Screenshots and MP4 samples are supplied with the task, not committed private uploads.

Run artifact verification with:

```sh
python3 web/scripts/verify-replay-video.py /absolute/path/racepace-replay.mp4
```

This requires ffmpeg/ffprobe only on the verification machine. The deployed static app does not depend on either executable.

## Limits and release

Physical iPhone/Safari download/share and non-supporting browsers have not been tested. Native share capability is detected, but no real recipient was selected. Missing GPS or translation data cannot be recovered. Large tracks/devices may render slowly; progress and cancellation are available, and raster background/route geometry is cached per export. Satellite themes, heart rate overlays, endpoint redaction and GIF/WebM remain deferred.

Release through the existing GitHub branch and private Sites project. Preserve `web/.openai/hosting.json`, the owner-only audience, the workout API and the existing D1 binding. GitHub push does not deploy Sites. Follow `docs/DEPLOYMENT.md`; this video layout change requires no database migration.
