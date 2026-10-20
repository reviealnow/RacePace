# Deployment notes — 2026-10-17

## Release scope and gate

This is Milestone 1 from the system design: route viewing, pace simulation and a truthful workout-import empty state. The original Streamlit server cannot be deployed as this static Sites app; its working features have been migrated to React/TypeScript with Vite.

The initial version was saved for review, then deployed privately at the user's request. Subsequent authorized updates preserve owner-only access. The live URL is https://racepace-taipei-training.oakenocean2048.chatgpt.site.

## Previous release — translated basemap labels

- Deployed successfully on 2026-10-17; access remains owner-private.
- Saved version ID: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_c52a0d936bb081919e2ea85f56a1a9fe`
- Deployment ID: `appgdep_6ad34624ab08819180ae77fcf58a49e5`
- Sites source commit: `8fef935db5ffd9b211c536e84c5b738874f84967`
- OpenFreeMap vector labels now follow EN/ZH for geographic names. Missing translations fall back to the source name. Route geometry, zoom and checkpoint popups remain intact when switching.
- The map renderer loads separately and its worker is bundled on the same origin. Provider attribution remains visible.
- Verified: ten tests, TypeScript and production build, course-data validation, production preview and live English map rendering; local EN/ZH switching and checkpoint popups. Label tests compile the actual MapLibre formatted text-field expression.

## Previous release — EN/ZH language switch

- Deployed successfully on 2026-10-17; access remains owner-private.
- Saved version ID: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_9c448e4f6c7881919a500c2e68a5dfc7`
- Deployment ID: `appgdep_6ad332f431008191a9ddad470b695c52`
- Sites source commit: `77273eb55f73b4f92d879575ea0d6ddd56bdd679`
- EN/ZH header buttons switch the interface, map controls/popups, validation, historical settings labels and CSV export. The preference persists locally without changing race settings; the document language and title update for accessibility.
- Verified: all eight calculation tests, TypeScript and production build, bilingual CSV values, refresh persistence, existing settings/history, both import views, map zoom/label switching and mobile layout at 390 px without page-wide overflow. Map state is preserved across language changes.

## Identity

- Project: `appgprj_6ad2d91001c48191ad8ba7f132736f25`
- Slug: `racepace-taipei-training`
- Manifest: `web/.openai/hosting.json`
- Static output: `web/dist/`
- Audience: owner-private at creation; preserve it for publication.
- GitHub source: `https://github.com/reviealnow/RacePace`

Never recreate the Site when this manifest is present. Reuse its project ID and a fresh short-lived source credential when necessary. Do not commit credentials.

## Initial release history

- Version 1 was first saved unpublished, then deployed privately at the user's request (deployment `appgdep_6ad32fbe9f0881919f2d69722ac94cba`).
- Saved version ID: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_7d10d23632ac8191805170fef9432cd0`
- Verified pushed Sites source commit: `97a0240afb0fa5347067c4a5e8a55d2fde4df95b`
- Archive SHA-256: `ed81e4c4447f0af388363eaf15e1046f8954f61113848bbe14821da4870912b9`
- Original GitHub checkout base: `92e92fe`; the initial web-source commit following this base contains the application saved in Sites version 1.
- Preview image: [RacePace preview](preview.jpg).

Verified in the browser: presets and custom pace validation, delayed-start risk, persisted settings after reload, cutoff edits/reset, CSV download, route map rendering and the workout empty state. At 390 px width, document width and scroll width both measured 390 px; the wide checkpoint table scrolls within its own container. No browser console errors were observed. Browser testing found and corrected time-input handling before the final build was packaged.

## Validation

1. Run `python3 scripts/prepare_course.py --check` at repository root.
2. In `web`, run `npm ci`, `npm test`, and `npm run build`.
3. Check the preview on desktop and mobile widths: preset/custom pace, late-start risk, invalid input, editable cutoffs, persistence, route markers and CSV export.
4. Keep full race prediction distinct from real workout analysis. No sample workout metrics are presented.

Ten unit tests cover all 12 supplied golden predictions, declared/geometry distance separation, start delays, risk boundaries, invalid input, CSV labeling and map-label language selection/fallbacks. TypeScript checks run in the production build. The CI workflow checks these same source assets and calculations; it does not deploy.

## Source and packaging

The main repository owns `web/`. For Sites publication, mirror the contents of `web/` into the ignored root `.sites-checkout/` directory, excluding `node_modules` and preserving the release checkout's `.git`. Include the verified `dist` output for packaging; `dist` remains ignored by Git. Never edit release-copy application source independently of `web/`.

Use the Sites plugin's `site-workflow.mjs` helper from the release checkout, passing the credential over hidden stdin. The helper synchronizes source, records its commit, verifies the push and packages the deployment archive. Save the returned exact commit and unchanged archive with `save_site_version`. Retain the returned version ID; publish that saved version rather than creating another copy.

The GitHub source branch and the Sites release commit are separate histories. Record their mapping when making a release. Push source changes to GitHub independently of saving or deploying a Sites version; the GitHub CI workflow only validates the application.

## Publication and rollback

After the saved first version has been reviewed, deploy its exact version ID with the owner-private deploy operation. If access has changed since creation, inspect it first. Verify a terminal successful deployment before calling the URL live. Preserve owner-only access; do not switch to public to resolve a deployment error.

There are no backend migrations or hosted workout files in this release. Rollback changes static code only; browser-local settings remain unless explicitly reset. Future D1/R2 migrations need a separate rollback plan.

## Remaining milestones

- Milestone 2: FIT/TCX/GPX parsing, input validation, monotonic GPS matching, uncertain crossing handling, partial-run tests and analysis exports.
- Milestone 3: private durable history, identity/ownership checks, deletion and optional raw-file retention.
- Real iPhone/Safari validation remains separate from desktop responsive-width checks.

## Unpublished workout replay/export enhancement — 2026-10-18

The feature branch `feature/workout-replay-export` extends the existing static app with local workout replay and H.264 MP4 export. No hosting manifest, storage, identity or audience change is required. See [implementation, measured video verification and release limits](WORKOUT_REPLAY_EXPORT.md). This section does not indicate a new live release: review and the existing saved-version/deploy sequence are still pending.


## Current release — workout replay and MP4 export (2026-10-18)

Deployed successfully with owner-only access preserved.

- GitHub application source: `efe55b3be19d61c18476a0644955be4e767f9317` on `feature/workout-replay-export` (PR #1 remains separate from deployment).
- Sites source commit: `578aa59abd748c769e02df7b9094b065c1a44866`.
- Saved version: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_aa89c174e6a48191bb81980bacb46f15`.
- Deployment: `appgdep_6ad4db11293081918acc5aab87157502`, terminal status `succeeded`.
- Live URL: https://racepace-taipei-training.oakenocean2048.chatgpt.site
- Includes timestamp-driven five-second workout replay, local imports, MP4 export/download, mobile full-route framing and EN/ZH.
- Validation: 24 tests, production build, course golden checks and measured browser-generated five-second MP4s passed before packaging. Physical iPhone verification remains outstanding.

This deployment supersedes the unpublished status recorded in earlier sections and review-time feature notes. It does not merge the GitHub PR.

## Timestamp collision fix — 2026-10-20

- Published successfully with owner-only access unchanged.
- Sites source commit: `6e94118d29ca460db3cda573155210da2ca08fa0`.
- Saved version: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_4663738d82a881919cb3a88865c683b4`.
- Deployment: `appgdep_6ad6e81a50788191a1ffbde6529bff8b`.
- Small bounded duplicate timestamps now receive interpolated timing without dropping route vertices or changing total duration. The interface and video disclose estimated timing/speed. Ambiguous collisions still fail validation.
- Validation: 26 tests and production build passed. A user-supplied GPX imported with all 1,188 coordinates intact, one adjusted timestamp, unchanged 1,539-second duration and finite output at all 150 export frame samples. Personal workout data was not copied into the repository or deployment.
- Browser file selection failed in automation; this release has no new end-to-end browser playback or encoded-MP4 verification. Previous encoder tests remain documented in WORKOUT_REPLAY_EXPORT.md.

## Basemap recovery — 2026-10-20

- Owner-private deployment succeeded: `appgdep_6ad72131fef48191aafb2a2b851d6127`.
- Saved version: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_8a9c43e2ffa08191933d575ca2d9d7b4`.
- Sites source commit: `6ecc81b3f193509ac62bb577d2a02da456097b29`.
- Shared race/replay basemap now has a 12-second initial-load watchdog, up to two automatic retries spaced 1.5 seconds apart, and a bilingual manual reload control after failure. Renderer errors and WebGL context loss also trigger bounded recovery. Retries replace only the basemap layer and retain route data and language selection.
- Validation: 29 tests and production build passed. Tests cover timeout exhaustion, manual recovery, stale callbacks, cleanup, and renderer construction errors. Browser confirmed initial loading notice, successful map loading with notice removal, and EN/ZH switching without console errors. Failure/retry transitions were tested with a deterministic scheduler, not by inducing a real provider outage.

## Private workout library — 2026-10-21

This release supersedes the earlier static-only and no-storage scope. Existing React components are retained inside the official Sites Vinext server wrapper, with authenticated API routes and D1 storage.

- Sites source commit: `ed4aef4d0223f6ff63cb476f6daa3c46679fbc61`.
- Saved version: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_2ee422ffceec81918ffca3cbc173fa07`.
- Deployment: `appgdep_6ad7f692bbcc8191bf1c63870d830880`, terminal status `succeeded`.
- Owner-only audience retained; D1 binding `DB`; no R2 binding. Migration: `web/drizzle/0000_flashy_blackheart.sql`. Applied migrations must remain immutable. Code rollback does not roll back saved runs or the database schema.
- Validation: 32 tests, frontend/server type checks and production build passed. Local browser testing saved a synthetic run, reloaded, reopened it from the library and exported an MP4 whose browser-reported duration was exactly 5 seconds. A 543px viewport had no horizontal overflow. Physical phone testing remains outstanding.
- Live verification reached the private ChatGPT sign-in gate. This browser has no authenticated live session, so production save/open behavior has not yet been verified end to end.
- No personal workout or local preview database was included in the release archive. This Sites release does not imply a GitHub push or PR merge.

See [workout library](WORKOUT_LIBRARY.md) for behavior and maintenance.

## Saved run renaming — 2026-10-21

- Owner-private deployment succeeded: `appgdep_6ad7ff668b288191a5d5e93e05194202`.
- Sites source commit: `a26e2428781e52949ce2fc3224e06c2e13ac9703`.
- Saved version: `appgprj_6ad2d91001c48191ad8ba7f132736f25~appgver_81bc99a9d4248191813691f61e24c1e8`.
- My runs now offers Rename, Save name and Cancel in EN/ZH. Names are trimmed and limited to 200 characters. An owner-scoped PATCH updates only the display name; reopening uses that name without changing route data or the existing deduplication key. No schema migration is needed.
- Validation: 33 tests, both type checks and production build passed. Local browser renamed a synthetic saved run, verified persistence after reload, switched EN/ZH, and verified cancellation discards the draft. No personal saved runs were modified during testing.
