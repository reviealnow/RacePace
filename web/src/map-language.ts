import type { ExpressionSpecification } from 'maplibre-gl';
import type { Language } from './i18n';

// Change geographic names, but leave road numbers, distances and other labels intact.
export function isNameLabel(field: unknown): boolean {
  if (Array.isArray(field)) return field.some(isNameLabel);
  return typeof field === 'string' && /(?:^|\{)name(?::[^}]+|_[a-z]+)?(?:\}|$)/.test(field);
}

export function nameExpression(language: Language): ExpressionSpecification {
  const fields = language === 'en'
    ? ['name:en', 'name_en', 'name:latin', 'name']
    : ['name:zh-Hant', 'name:zh_TW', 'name:zh', 'name'];
  // Missing translations fall back to the source name; never invent a translation.
  return fields.reduceRight<ExpressionSpecification>((fallback, field) => [
    'case', ['all', ['has', field], ['!=', ['get', field], '']],
    ['to-string', ['get', field]], fallback,
  ], ['literal', '']);
}
