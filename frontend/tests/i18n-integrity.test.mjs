/**
 * i18n Integrity Test — Industrial-grade quality gate
 *
 * Validates:
 * 1. Structural isomorphism: cn.json and en.json must have identical key structures
 * 2. No empty values: every key must map to a non-empty string
 * 3. Placeholder consistency: {param} patterns must match across locales
 *
 * Run: node --test tests/i18n-integrity.test.mjs
 * Integrated into: npm run test:quality
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MESSAGES_DIR = resolve(__dirname, '..', 'src', 'messages');

function loadJson(locale) {
  const raw = readFileSync(resolve(MESSAGES_DIR, `${locale}.json`), 'utf-8');
  return JSON.parse(raw);
}

/**
 * Recursively collect all leaf key paths from a nested object.
 * e.g. { a: { b: "x", c: "y" } } → ['a.b', 'a.c']
 */
function collectKeyPaths(obj, prefix = '') {
  const keys = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...collectKeyPaths(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

/**
 * Extract {param} placeholders from a string.
 * e.g. '到期时间: {date}' → ['date']
 */
function extractPlaceholders(str) {
  const matches = str.match(/\{(\w+)\}/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1)).sort();
}

/**
 * Resolve a dot-path against a nested object.
 */
function resolvePath(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// ─── Tests ──────────────────────────────────────────────────────

const cn = loadJson('cn');
const en = loadJson('en');

const cnKeys = collectKeyPaths(cn);
const enKeys = collectKeyPaths(en);

describe('i18n Structural Isomorphism', () => {
  it('cn.json and en.json must have the same number of keys', () => {
    assert.equal(
      cnKeys.length,
      enKeys.length,
      `Key count mismatch: cn has ${cnKeys.length}, en has ${enKeys.length}`,
    );
  });

  it('cn.json must not have keys missing from en.json', () => {
    const missingInEn = cnKeys.filter((k) => !enKeys.includes(k));
    assert.equal(
      missingInEn.length,
      0,
      `Keys in cn.json but missing from en.json:\n  ${missingInEn.join('\n  ')}`,
    );
  });

  it('en.json must not have keys missing from cn.json', () => {
    const missingInCn = enKeys.filter((k) => !cnKeys.includes(k));
    assert.equal(
      missingInCn.length,
      0,
      `Keys in en.json but missing from cn.json:\n  ${missingInCn.join('\n  ')}`,
    );
  });
});

describe('i18n No Empty Values', () => {
  it('cn.json must not contain empty string values', () => {
    const emptyKeys = cnKeys.filter((k) => {
      const val = resolvePath(cn, k);
      return typeof val === 'string' && val.trim() === '';
    });
    assert.equal(
      emptyKeys.length,
      0,
      `Empty values in cn.json:\n  ${emptyKeys.join('\n  ')}`,
    );
  });

  it('en.json must not contain empty string values', () => {
    const emptyKeys = enKeys.filter((k) => {
      const val = resolvePath(en, k);
      return typeof val === 'string' && val.trim() === '';
    });
    assert.equal(
      emptyKeys.length,
      0,
      `Empty values in en.json:\n  ${emptyKeys.join('\n  ')}`,
    );
  });
});

describe('i18n Placeholder Consistency', () => {
  it('{param} placeholders must match across cn.json and en.json', () => {
    const mismatches = [];

    for (const key of cnKeys) {
      const cnVal = resolvePath(cn, key);
      const enVal = resolvePath(en, key);

      if (typeof cnVal !== 'string' || typeof enVal !== 'string') continue;

      const cnParams = extractPlaceholders(cnVal);
      const enParams = extractPlaceholders(enVal);

      if (JSON.stringify(cnParams) !== JSON.stringify(enParams)) {
        mismatches.push(
          `  ${key}: cn={${cnParams.join(',')}} en={${enParams.join(',')}}`,
        );
      }
    }

    assert.equal(
      mismatches.length,
      0,
      `Placeholder mismatches:\n${mismatches.join('\n')}`,
    );
  });
});

describe('i18n Namespace Structure', () => {
  const REQUIRED_NAMESPACES = [
    'common',
    'dashboard',
    'brief',
    'council',
    'user',
    'onboarding',
    'trade',
  ];

  for (const ns of REQUIRED_NAMESPACES) {
    it(`cn.json must have namespace "${ns}"`, () => {
      assert.ok(
        cn[ns] && typeof cn[ns] === 'object',
        `Missing namespace "${ns}" in cn.json`,
      );
    });

    it(`en.json must have namespace "${ns}"`, () => {
      assert.ok(
        en[ns] && typeof en[ns] === 'object',
        `Missing namespace "${ns}" in en.json`,
      );
    });
  }
});
