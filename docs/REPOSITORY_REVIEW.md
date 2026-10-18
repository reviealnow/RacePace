# Repository review — 2026-10-18

Scope: React/TypeScript application and styles, replay/import/export additions, pace engine, map localization, tests, generated course assets and generator, GitHub CI, Sites manifest/release documentation, original archive layout, and legacy Python source. This is a repository review, not a penetration test or a guarantee that no defects remain.

## Outcome

The existing architecture and race-distance semantics are preserved. The replay/export enhancement is isolated from the original race calculation engine. GitHub source publication and Sites deployment remain independent. Documentation now distinguishes the implemented feature branch from the older deployed release.

Corrected during review:

- Cancelled or replaced MP4 export jobs can no longer update the progress display of a newer job after an encoder await completes.
- Replay disables Leaflet zoom animation, matching the existing course map's configuration. The explicit **Fit full route** control is retained for narrow screens and manual navigation.
- README and feature notes no longer imply that the feature branch lacks workout import or that GitHub source publication deploys the private site.

## Validation

- 24 tests pass, including the original race/map tests, GPX/TCX/FIT imports, Apple Health matching, stationary intervals, timestamp interpolation, five-second frame timing and invalid/missing data.
- TypeScript and production build pass. Vite reports large map/main bundles; this remains a performance advisory.
- Course generator verifies 1,847 original coordinates, four checkpoints and all 12 legacy golden predictions.
- Python source compilation passes for the legacy application, core and course generator. The legacy Streamlit runtime was not executed: Streamlit, Shapely, pyproj and fitparse are not installed in this environment.
- Production dependency audit reports zero known vulnerabilities at review time. This does not cover the legacy Python dependency stack.
- A targeted scan of tracked and pending text files found no private-key headers, GitHub token patterns or AWS access-key patterns. The scan is not exhaustive. Local credentials, release checkout, node_modules, build output and personal workout files remain excluded from the commit. Only the explicitly named synthetic workout fixtures are included.
- Previously downloaded actual browser MP4s measure H.264/yuv420p, 960×720, 30 fps, 150 frames and 5.000000 seconds. Both map imagery and route-only exports were inspected; recorded dwell is preserved. See WORKOUT_REPLAY_EXPORT.md for measurements and reproduction.
- Mobile layout and English/Chinese switching were checked at 390×844. Physical iPhone/Safari download and sharing remain unverified. Native share was not sent to a recipient.

## Remaining findings and limits

| Priority | Area | Finding / follow-up |
| --- | --- | --- |
| P2 | Legacy prototype | `legacy-python/app.py` writes uploaded KML/workout data to `NamedTemporaryFile(delete=False)` without unlinking it. These files can outlive a session. The legacy app is not deployed by Sites; add guaranteed cleanup before using it for sensitive uploads. Legacy source is preserved in this change. |
| P2 | GPS quality | Sparse intervals and implausible jumps are flagged, but their geometry/distance is retained by design. Erroneous recordings can inflate distance/average speed. Explicit segment breaks are not bridged. A future optional cleaning mode must explain changes rather than silently discard points. |
| P2 | Device support | H.264 export depends on a browser/device encoder. Unsupported browsers get an explanation and retain normal replay. Physical iPhone verification is a release follow-up; desktop viewport emulation is not a substitute. |
| P3 | Performance | MapLibre and the main bundle trigger Vite's size advisory. Map renderer, FIT decoder and video module are split; further optimization requires device measurements. |
| P3 | Privacy | Hiding place labels does not anonymize route shape or endpoints. Interactive map requests disclose the viewed area to the map provider. No automatic workout upload/storage path was introduced; a network-proxy audit was not performed. |

The repository still contains historical Chinese source labels, fixtures, design notes and the EN/ZH interface. Review text, commit/PR descriptions and new documentation are English. Removing a supported language is not assumed from a request to report in English.

## Release boundary

Push the feature branch and review the GitHub pull request/CI. Do not imply a main-branch merge or a Sites deployment has occurred. Publication of the private site continues through the existing saved-version review and deploy workflow, with no database migration or new backend.
