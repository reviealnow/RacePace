# Private workout library

On a computer, import a workout and choose **Save to my library**. On a phone, visit the same private RacePace URL, sign in with the same ChatGPT account and choose **My runs → Open run**. Export an MP4 on that device, then use Share when supported or download it for sharing manually. Existing unsaved imports must be imported and saved once.

Saving is explicit. The library stores the run name, GPS coordinates, timestamps and replay speed samples in D1. It does not store the original GPX or Apple Health XML file, the full Health summary, or generated MP4s. It is not automatic Apple Watch synchronization. The private site remains limited to its owner.

## Implementation

- Existing `src/WorkoutReplay.tsx` hosts `src/WorkoutLibrary.tsx`; EN/ZH and existing replay/export behavior are retained.
- `app/ClientApp.tsx` loads the existing browser application inside the official Sites Vinext wrapper.
- `app/api/workouts` delegates to `server/workout-api.ts`. The trusted Sites identity header determines ownership; every read/delete is scoped to that identity. Mutations require a matching Origin. Responses are private and non-cacheable.
- `server/workout-data.ts` validates route data and recomputes metrics. Limits: 100 runs per account, 100,000 points per run, and a 1.5 MB request payload. Identical canonical content is deduplicated.
- `db/schema.ts` and `drizzle/` define the D1 schema. No R2 bucket is needed.
- The MapLibre worker is copied to `public/map-worker.js` during dev/build to avoid development-only browser code entering the worker.

## Local setup

From `web/`, install dependencies and run `npm run build`, then initialize the local database:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_flashy_blackheart.sql
npm run dev
```

Local sign-in uses the Sites development identity. Production uses ChatGPT sign-in. Never deploy `.wrangler` or personal workout files. Generate future migrations with `npm run db:generate`; do not edit an already applied migration.

## Verification and limits

The 32-test suite includes ownership isolation, authentication, mutation origin checks, deduplication, deletion, quota enforcement and data validation. Local browser verification saved and reopened a synthetic workout after reload, then produced a five-second MP4. Physical iPhone export/sharing and authenticated production save/open still require verification. MP4 encoding and native sharing depend on browser support; the interface offers download when native file sharing is unavailable.
