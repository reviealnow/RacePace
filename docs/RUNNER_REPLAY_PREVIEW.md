# Runner replay — local preview

Status: prepared for GitHub review; **not deployed to Sites**.

In `web/`, run `npm ci` and `npm run dev`, then open the printed local URL with `?view=replay` appended. Choose a timestamped GPX route, optionally with its Apple Health `export.xml`, then press **Play**. The initial screen is empty; synthetic data appears only after explicitly choosing the labelled demo.

## Five-second playback

The complete GPS timeline maps to 5,000 milliseconds:

`workout elapsed = min(workout duration, wall-clock elapsed / 5000 × workout duration)`

Each animation frame locates the surrounding original GPS timestamps and interpolates between their coordinates. Faster sections cover more ground in the same playback time; repeated stationary positions retain recorded stops. The animation uses an absolute monotonic clock, so dropped frames do not lengthen the timeline. The final position is clamped to the last GPS point. Physical display updates occur on browser refresh frames; a hidden or suspended browser cannot guarantee a visible frame at precisely 5,000 ms.

Every valid original route vertex is retained, with map simplification disabled. No synthetic timestamps or constant-speed fallback are used for real imports. Multiple original points can fall between display frames in a compressed workout; they remain in the route and interpolation timeline. Explicit disconnected segments are shown separately: the marker holds before the next segment rather than inventing an unrecorded bridge.

## Data and controls

- Import one route and one Apple Health XML together, or in either order. XML alone prompts for the matching GPX because workout summaries do not provide GPS geometry. TCX and FIT routes are also supported.
- Apple Health matching requires a unique running workout, matching endpoint times within 60 seconds and the original GPX basename when the XML contains route references. Ambiguous or mismatched files are rejected.
- Matching Apple Health running-speed samples control the displayed speed and colour where available. Otherwise, recorded route speeds or adjacent GPS distance/time are used. GPS timestamps always control movement; speed is not applied a second time to distort the timeline.
- The dot and route use a fixed gradient: blue at 0 km/h, teal at 6, amber at 12 and red at 18 or above. The map includes a colour legend.
- Average speed appears at the map's top right: GPS route distance divided by GPS elapsed time, including stops. Apple Health recorded distance and active duration appear separately; they do not overwrite GPS geometry or timing.
- Play/pause, restart, scrubbing, current speed, distance, elapsed time and a speed chart are available. Playback duration is fixed at five seconds for a complete uninterrupted run. Pausing adds wall-clock time; resuming preserves the same compression ratio.
- EN/ZH covers the replay interface and basemap. Imported routes use their own endpoints and are not snapped to the Taipei race.

## Integrity and privacy

Imports require at least two valid coordinates and a positive timeline of at most seven days. Every GPS point must have a timezone-aware timestamp. Invalid points and conflicting positions at the same timestamp are rejected; exact duplicate position/time samples are coalesced. Out-of-order timestamps are rejected to preserve recording sequence; the route is never sorted or simplified.

Route files are capped at 25 MB and 100,000 points. Apple Health XML is streamed in chunks, with a 1 GB limit. Sparse intervals over 120 seconds and apparent speeds over 20 m/s are flagged, but their vertices remain intact. Only explicit segment breaks exclude the connecting edge from distance.

Files are parsed in browser memory, never uploaded or persisted. Navigating away from the import view or reloading clears the imported workout. The official Garmin SDK is loaded only for FIT imports. External basemap requests go to OpenFreeMap; workout file contents and pace settings are not included in those requests. Tile requests necessarily reveal the map area being viewed.

The explicit demo and files under `web/tests/fixtures/replay-synthetic*` are synthetic validation data, not a real user's workout. Existing race predictions continue to use declared race distances; replay uses imported GPS geometry.

## Validation

- `npm test`: 24 tests pass, covering prediction/map-language checks, five-second timing, unequal speed segments, stops, original turn vertices, dropped frames, pause/resume mapping, GPX/TCX/FIT imports, Apple Health streaming/matching/units/source selection and malformed XML.
- `npm run build`: TypeScript and Vite production build pass. Vite reports a large-chunk advisory for the map bundle.
- Browser: paired synthetic GPX + Apple Health XML import shows the matching source, distance and active duration. Replay reaches the final GPS point. A separate demo timing observation reached `5.000` playback seconds approximately five seconds after start (display-frame and automation sampling tolerance apply).
- Real user workout files have not yet been supplied, so real-export verification remains outstanding.

Publication remains pending review of the effect. The live deployment notes and data flow diagram describe the prior deployed release.


## MP4 export extension (2026-10-18)

The existing replay now includes **Export MP4**, progress/cancel, inline playback, download and feature-detected native file sharing. See [MP4 implementation and verification](WORKOUT_REPLAY_EXPORT.md) for measured artifacts, platform limitations, privacy options and release steps.
