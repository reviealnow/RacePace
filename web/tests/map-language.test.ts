import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNameLabel, nameExpression } from '../src/map-language';
import { createExpression, latest } from '@maplibre/maplibre-gl-style-spec';

test('localize geographic labels while preserving highway route numbers', () => {
  assert.equal(isNameLabel(['case', ['has', 'name:nonlatin'], ['concat', ['get', 'name:latin'], '\n', ['get', 'name:nonlatin']], ['get', 'name']]), true);
  assert.equal(isNameLabel('{name:en}'), true);
  assert.equal(isNameLabel(['to-string', ['get', 'ref']]), false);
  assert.equal(isNameLabel(['get', 'ele']), false);
});

test('label language prefers the requested translation before source names', () => {
  const evaluate = (language: 'en' | 'zh', properties: Record<string, string>) => {
    const parsed = createExpression(nameExpression(language), 'layers[0].layout.text-field', latest.layout_symbol['text-field']);
    assert.equal(parsed.result, 'success');
    if (parsed.result !== 'success') throw new Error('Invalid map expression');
    return parsed.value.evaluate({ zoom: 12 }, { type: 1, properties }).toString();
  };
  const district = { name: '松山區', 'name:en': 'Songshan District', 'name:zh-Hant': '松山區', 'name:latin': 'Songshan' };
  assert.equal(evaluate('en', district), 'Songshan District');
  assert.equal(evaluate('zh', district), '松山區');
  assert.equal(evaluate('en', { ...district, 'name:en': '' }), 'Songshan');
  assert.equal(evaluate('en', { name: '未翻譯地名' }), '未翻譯地名');
  assert.equal(evaluate('zh', {}), '');
});
