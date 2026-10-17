import { test } from 'node:test';
import assert from 'node:assert/strict';
import course from '../src/data/course.json';
import golden from './golden.json';
import { predict, riskLevel, paceSeconds, csvExport } from '../src/engine';
const settings = { pace: '6:30', delay: 0, start: '07:00', cutoffs: course.checkpoints.map(g => g.closeTime) };
for (const pace of ['5:30', '6:30', '7:00']) {
  test(`${pace}: all four crossings match legacy Python golden results`, () => {
    const results = predict(course.checkpoints, { ...settings, pace });
    const expected = golden.filter(r => r.pace === pace);
    assert.equal(expected.length, 4);
    results.forEach((r, i) => {
      assert.equal(r.arrivalLabel, expected[i]['預估抵達']);
      assert.ok(Math.abs(r.margin / 60 - Number(expected[i]['餘裕 分鐘'])) <= 0.051);
      assert.equal(r.margin >= 0 ? '通過' : '逾時', expected[i]['判定']);
    });
  });
}
test('declared distances drive predictions, independently of geometry', () => {
  const changed = course.checkpoints.map(g => ({ ...g, geometryKm: 99 }));
  assert.deepEqual(predict(changed, settings).map(r => r.arrival), predict(course.checkpoints, settings).map(r => r.arrival));
  assert.equal(course.checkpoints[2].declaredKm, 17.9);
  assert.ok(Math.abs(course.checkpoints[2].geometryKm - 18.671) < 0.001);
});
test('delay shifts arrivals and can cause missed gates', () => {
  const base = predict(course.checkpoints, settings);
  const delayed = predict(course.checkpoints, { ...settings, delay: 15 });
  delayed.forEach((r, i) => { assert.equal(r.arrival - base[i].arrival, 900); assert.equal(r.margin - base[i].margin, -900); });
  assert.equal(delayed[0].risk, 'late');
});
test('risk boundaries include an on-time arrival', () => {
  assert.deepEqual([-1, 0, 299, 300, 599, 600].map(riskLevel), ['late', 'tight', 'tight', 'watch', 'watch', 'safe']);
});
test('reject malformed inputs and unordered cutoffs', () => {
  for (const pace of ['', '6:60', '-1:00', 'NaN', '0:00', '30:01']) assert.throws(() => paceSeconds(pace));
  for (const delay of [-1, NaN, Infinity, 181]) assert.throws(() => predict(course.checkpoints, { ...settings, delay }));
  assert.throws(() => predict(course.checkpoints, { ...settings, start: '25:00' }));
  assert.throws(() => predict(course.checkpoints, { ...settings, cutoffs: ['06:00', '08:30', '09:30', '10:00'] }));
});
test('CSV exports distinct distance semantics and simulation labeling', () => {
  const csv = csvExport(predict(course.checkpoints, settings));
  assert.ok(csv.includes('KML 幾何里程')); assert.ok(csv.includes('情境預估抵達')); assert.equal(csv.split('\r\n').length, 5);
});
