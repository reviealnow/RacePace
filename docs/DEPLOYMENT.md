# Deployment notes — 2026-10-17

## Release scope and gate

This is Milestone 1 from the system design: route viewing, pace simulation and a truthful workout-import empty state. The original Streamlit server cannot be deployed as this static Sites app; its working features have been migrated to React/TypeScript with Vite.

The design document sections 8 and 10 require saving a reviewable version before publication. This release therefore uses `save_site_version`, without a deploy operation. The registered Site stays owner-private. A reserved Site URL is not evidence that it is live.

## Identity

- Project: `appgprj_6ad2d91001c48191ad8ba7f132736f25`
- Slug: `racepace-taipei-training`
- Manifest: `web/.openai/hosting.json`
- Static output: `web/dist/`
- Audience: owner-private at creation; preserve it for publication.
- GitHub source: `https://github.com/reviealnow/RacePace`

Never recreate the Site when this manifest is present. Reuse its project ID and a fresh short-lived source credential when necessary. Do not commit credentials.

## Saved release

- Saved successfully: **version 1**, unpublished; no deployment was created.
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

Eight unit tests cover all 12 supplied golden predictions, declared/geometry distance separation, start delays, risk boundaries, invalid input and CSV labeling. TypeScript checks run in the production build. The CI workflow checks these same source assets and calculations; it does not deploy.

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
