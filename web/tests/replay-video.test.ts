import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VIDEO, videoFrame, paceLabel, routeProjection } from '../src/replay-render';
import { buildWorkout, positionAt } from '../src/workout';
import { importUntimedGPX } from '../src/workout-import';
import { weatherKind, workoutDateLabel } from '../src/workout-weather';

test('150 deterministic frame intervals occupy exactly five seconds and include both endpoints', () => {
  assert.deepEqual({width:VIDEO.width,height:VIDEO.height}, {width:1080,height:1920});
  const frames = Array.from({ length: VIDEO.frames }, (_, i) => videoFrame(i, 120));
  assert.equal(frames.length, 150);
  assert.equal(frames[0].elapsed, 0);
  assert.equal(frames[149].elapsed, 120);
  assert.equal(frames[149].timestamp + frames[149].duration, 5);
  assert.ok(Math.abs(frames.reduce((n, f) => n + f.duration, 0) - 5) < 1e-12);
  assert.throws(() => videoFrame(150, 120));
});
test('export samples preserve equal-distance unequal-time legs and recorded dwell', () => {
  const run = buildWorkout([{lat:25,lon:121,time:0},{lat:25.001,lon:121,time:60000},{lat:25.001,lon:121,time:90000},{lat:25.002,lon:121,time:120000}], 'synthetic');
  const at = (i: number) => positionAt(run, videoFrame(i, run.duration).elapsed);
  assert.equal(at(75).lat, 25.001);
  assert.equal(at(90).lat, 25.001);
  assert.ok(Math.abs(at(125).lat - 25.001333333333333) < 1e-10);
  assert.equal(at(149).lat, 25.002);
});
test('untimed GPX offers only valid route geometry; partial/malformed timing remains an error', async () => {
  const xml = '<gpx><trk><trkseg><trkpt lat="25" lon="121"/><trkpt lat="25.01" lon="121"/></trkseg></trk></gpx>';
  const points = await importUntimedGPX(new File([xml], 'untimed.gpx'));
  assert.equal(points.length, 2);
  await assert.rejects(importUntimedGPX(new File([xml.replace('<trkpt lat="25" lon="121"/>', '<trkpt lat="25" lon="121"><time>bad</time></trkpt>')], 'bad.gpx')));
  await assert.rejects(importUntimedGPX(new File([xml.replace('lat="25"', 'lat="999"')], 'bad.gpx')));
});
test('projection fits all vertices and crosses the dateline using the short arc', () => {
  const points = [{lat:25,lon:179.99,time:0},{lat:25.001,lon:-179.99,time:60000}];
  const project = routeProjection(points);
  for (const p of points) { const v = project(p); assert.ok(v.x >= 59 && v.x <= 1021); assert.ok(v.y >= 79 && v.y <= 1361); }
  const middle = positionAt(buildWorkout(points, 'dateline'), 30);
  assert.ok(Math.abs(middle.lon) > 179.9);
  assert.equal(paceLabel(12), '5:00'); assert.equal(paceLabel(0), '—');
});
test('video date uses EU order and weather codes map to stable icon categories', () => {
  assert.equal(workoutDateLabel(Date.UTC(2026,9,18,0,40), 'Asia/Taipei'), '18/10/2026 · 08:40');
  assert.equal(weatherKind(0), 'clear');
  assert.equal(weatherKind(2), 'partly-cloudy');
  assert.equal(weatherKind(3), 'cloudy');
  assert.equal(weatherKind(45), 'fog');
  assert.equal(weatherKind(61), 'rain');
  assert.equal(weatherKind(75), 'snow');
  assert.equal(weatherKind(95), 'storm');
});
