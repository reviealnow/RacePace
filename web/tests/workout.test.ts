import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Encoder, Profile } from '@garmin/fitsdk';
import { buildWorkout, demoWorkout, metersBetween, positionAt, speedColor, replayElapsed, REPLAY_MS } from '../src/workout';
import { importWorkout, parseWorkoutXML, parseAppleHealthXML, attachAppleHealth, readAppleHealth } from '../src/workout-import';
import course from '../src/data/course.json';

const a = { lat: 25, lon: 121.5, time: 0 };
const b = { lat: 25.001, lon: 121.5, time: 60000 };
const c = { ...b, time: 90000 };
const d = { lat: 25.002, lon: 121.5, time: 120000 };

test('replay starts and finishes exactly at recorded endpoints, with timestamp interpolation', () => {
  const run = buildWorkout([a, b, c, d], 'test');
  assert.equal(positionAt(run, -1).lat, a.lat);
  assert.ok(Math.abs(positionAt(run, 30).lat - 25.0005) < 1e-9);
  assert.equal(positionAt(run, 75).lat, b.lat);
  assert.equal(positionAt(run, 75).speed, 0);
  assert.equal(positionAt(run, 999).lat, d.lat);
  assert.equal(positionAt(run, 999).elapsed, 120);
  assert.equal(positionAt(run, 999).speed, 0);
  assert.ok(Math.abs(run.averageSpeed - metersBetween(a, b) * 2 / 120 * 3.6) < 1e-9);
});

test('sparse and jumpy data retains all vertices; disconnected segments do not invent a path', () => {
  const later = { ...d, time: 300000 };
  const run = buildWorkout([a, b, later], 'gap');
  assert.equal(run.gaps, 1);
  assert.equal(run.distance, metersBetween(a, b) + metersBetween(b, later));
  assert.equal(positionAt(run, 180).gap, false);
  assert.ok(positionAt(run, 180).lat > b.lat);
  assert.equal(positionAt(run, 300).lat, later.lat);
  const jumped = buildWorkout([a, { lat: 26, lon: 121.5, time: 10000 }], 'jump');
  assert.ok(jumped.distance > 0);
  assert.equal(jumped.points.length, 2);
  assert.equal(jumped.gaps, 1);
  const segmented = buildWorkout([a, { ...b, breakBefore: true }], 'segments');
  assert.equal(segmented.distance, 0);
  assert.equal(positionAt(segmented, 30).lat, a.lat);
  assert.equal(positionAt(segmented, 30).gap, true);
});

test('normalization rejects unusable data and handles unordered duplicate samples', () => {
  assert.throws(() => buildWorkout([b, a, b, d], 'unordered'));
  const run = buildWorkout([a, b, b, d], 'duplicates');
  assert.deepEqual(run.points.map(p => p.time), [0, 60000, 120000]);
  assert.throws(() => buildWorkout([a, a], 'duplicate'));
  assert.throws(() => buildWorkout([a, { ...b, time: 0 }], 'conflicting timestamps'));
  assert.throws(() => buildWorkout([a, { ...b, time: NaN }], 'missing timestamps'));
  assert.throws(() => buildWorkout([a, { ...b, lat: NaN }], 'bad coordinate'));
  assert.throws(() => buildWorkout([a, { ...b, lat: 91 }], 'invalid latitude'));
  assert.throws(() => buildWorkout([a, { ...b, time: 8 * 86400000 }], 'duration'));
});

test('colour scale is fixed and demo data is explicitly marked synthetic', () => {
  assert.equal(speedColor(0), 'rgb(59, 130, 246)');
  assert.equal(speedColor(18), 'rgb(239, 68, 68)');
  assert.equal(speedColor(30), speedColor(18));
  assert.notEqual(speedColor(5), speedColor(10));
  const demo = demoWorkout(course.coordinates);
  assert.equal(demo.demo, true);
  assert.equal(demo.gaps, 0);
  assert.equal(demo.points[0].lon, course.coordinates[0][0]);
  assert.equal(demo.points.at(-1)!.lon, course.coordinates.at(-1)![0]);
});

test('official FIT decoder imports coordinates and UTC timestamps from binary records', async () => {
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, { type: 'activity', manufacturer: 'development', product: 1, timeCreated: new Date('2026-10-18T00:00:00Z') });
  for (const point of [a, b, c, d]) encoder.onMesg(Profile.MesgNum.RECORD, {
    timestamp: new Date(Date.parse('2026-10-18T00:00:00Z') + point.time),
    positionLat: Math.round(point.lat / 180 * 2 ** 31),
    positionLong: Math.round(point.lon / 180 * 2 ** 31),
  });
  const run = await importWorkout(new File([encoder.close()], 'synthetic.fit'));
  assert.equal(run.demo, false);
  assert.equal(run.duration, 120);
  assert.equal(run.points.length, 4);
  assert.ok(Math.abs(run.points[0].lat - a.lat) < 1e-6);
  assert.ok(Math.abs(run.points.at(-1)!.lon - d.lon) < 1e-6);
});

test('unsupported and corrupt imports fail without producing a workout', async () => {
  await assert.rejects(importWorkout(new File(['x'], 'test.csv')));
  await assert.rejects(importWorkout(new File(['not a FIT file'], 'broken.fit')));
});

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
test('five-second clock preserves the recorded rhythm, stops and original turns', () => {
  const run = buildWorkout([a, b, c, d], 'uneven');
  assert.equal(REPLAY_MS, 5000);
  assert.equal(replayElapsed(run.duration, 2500), 60);
  assert.equal(positionAt(run, replayElapsed(run.duration, 2500)).lat, b.lat);
  assert.equal(positionAt(run, replayElapsed(run.duration, 3125)).lat, b.lat);
  assert.equal(positionAt(run, replayElapsed(run.duration, 3750)).lat, c.lat);
  // An equivalent distance takes half the screen time in the faster final segment.
  assert.ok(Math.abs(positionAt(run, replayElapsed(run.duration, 4375)).lat - 25.0015) < 1e-9);
  for (const wall of [5000, 5017, 8000]) assert.equal(replayElapsed(run.duration, wall), run.duration);
  assert.equal(replayElapsed(run.duration, 0), 0);
  assert.equal(replayElapsed(run.duration, 2500, 60), run.duration);
  // Irregular frame cadence does not accumulate rounding or cap a long frame.
  assert.equal(replayElapsed(7200, 4999), 7198.56);
  assert.equal(replayElapsed(7200, 5000), 7200);
  const turns = [a, { ...b, lon: 121.501 }, { ...c, lon: 121.499 }, d];
  const turning = buildWorkout(turns, 'turns');
  turning.points.forEach(p => {
    const position = positionAt(turning, p.elapsed);
    assert.equal(position.lat, p.lat); assert.equal(position.lon, p.lon);
  });
});

test('GPX and TCX XML import every timed coordinate, including stops', async () => {
  for (const ext of ['gpx', 'tcx']) {
    const run = await importWorkout(new File([fixture(`replay-synthetic.${ext}`)], `replay-synthetic.${ext}`));
    assert.equal(run.duration, 120);
    assert.equal(run.points.length, ext === 'gpx' ? 4 : 3);
    assert.equal(run.points[0].lat, 25.04);
    assert.equal(run.points.at(-1)!.lat, 25.042);
  }
  assert.throws(() => parseWorkoutXML('<gpx><trk>', 'gpx'));
  assert.throws(() => buildWorkout(parseWorkoutXML(fixture('replay-synthetic.gpx').replace('2026-10-18T00:01:00Z', '2026-10-18T00:01:00'), 'gpx'), 'missing timezone'));
});

test('Apple Health XML matches the GPX and normalizes metrics without changing GPS timing', async () => {
  const run = await importWorkout(new File([fixture('replay-synthetic.gpx')], 'replay-synthetic.gpx'));
  const xml = fixture('replay-synthetic-health.xml');
  const health = parseAppleHealthXML(xml);
  const paired = attachAppleHealth(run, health);
  assert.ok(Math.abs(paired.health!.distance! - 222.39) < 1e-9);
  assert.equal(paired.health?.activeSeconds, 90);
  assert.equal(paired.duration, 120);
  assert.equal(paired.averageSpeed, run.averageSpeed);
  assert.deepEqual(paired.points.map(p => [p.lat, p.lon, p.time]), run.points.map(p => [p.lat, p.lon, p.time]));
  assert.ok(paired.recordedSpeedCount > 0);
  assert.ok(Math.abs(paired.speedSamples![0].speed - 6.66) < 1e-9);
  assert.deepEqual(paired.points, run.points);
  assert.equal(positionAt(paired, 75).speed, 0);
  assert.ok(Math.abs(positionAt(paired, 105).speed - 13.32) < 1e-9);
  const streamed = await readAppleHealth(new File([xml], 'export.xml'), run);
  assert.deepEqual(streamed, paired);
  assert.throws(() => attachAppleHealth({ ...run, name: 'different.gpx' }, health));
  assert.throws(() => attachAppleHealth(run, { ...health, workouts: [...health.workouts, ...health.workouts] }));
  assert.throws(() => attachAppleHealth(run, parseAppleHealthXML(xml.replaceAll('2026-10-18', '2026-10-19'))));
  assert.throws(() => parseAppleHealthXML('<NotHealth/>'));
});

test('Health speed source and units are respected; summaries never invent GPS coordinates', async () => {
  const run = await importWorkout(new File([fixture('replay-synthetic.gpx')], 'replay-synthetic.gpx'));
  const xml = fixture('replay-synthetic-health.xml');
  const wrongSource = parseAppleHealthXML(xml.replaceAll('sourceName="Synthetic Watch" unit=', 'sourceName="Other device" unit='));
  assert.equal(attachAppleHealth(run, wrongSource).recordedSpeedCount, 0);
  const unsupported = parseAppleHealthXML(xml.replaceAll('unit="m/s"', 'unit="furlongs/day"'));
  assert.equal(attachAppleHealth(run, unsupported).recordedSpeedCount, 0);
  assert.throws(() => buildWorkout(parseWorkoutXML(xml, 'gpx'), 'no route'));
  const unknownEntity = '<!DOCTYPE HealthData [<!ENTITY attack SYSTEM "file:///etc/passwd">]><HealthData>&attack;</HealthData>';
  assert.throws(() => parseAppleHealthXML(unknownEntity));
});
