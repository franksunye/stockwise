import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MIDDLEWARE_PATH = resolve(ROOT, 'src', 'middleware.ts');
const AUTH_PATH = resolve(ROOT, 'src', 'hooks', 'useDashboardAuthorization.ts');

describe('invite locale enforcement', () => {
  it('marketing invite redirect should force locale=en and set locale cookie', () => {
    const src = readFileSync(MIDDLEWARE_PATH, 'utf-8');

    assert.ok(
      src.includes("appUrl.searchParams.set('locale', 'en');"),
      'Invite redirect must append locale=en to app URL.',
    );
    assert.ok(
      src.includes("setLocaleCookie(res, 'en');"),
      'Invite redirect must set ziso_locale=en cookie before handing off to app.',
    );
  });

  it('dashboard authorization should honor locale from URL before cookie or browser inference', () => {
    const src = readFileSync(AUTH_PATH, 'utf-8');

    assert.ok(
      src.includes('function getExplicitLocaleFromUrl(): \'cn\' | \'en\' | null {'),
      'Dashboard authorization should parse explicit locale from the URL.',
    );
    assert.ok(
      src.includes('const explicitLocale = getExplicitLocaleFromUrl();'),
      'Preferred locale resolution should check URL locale first.',
    );
    assert.ok(
      src.includes('const locale = explicitLocaleFromUrl ?? getPreferredLocaleForProfileSync();'),
      'Bootstrap request should prefer explicit URL locale over inferred locale.',
    );
    assert.ok(
      src.includes('explicitLocale: Boolean(explicitLocaleFromUrl)'),
      'Bootstrap request should mark URL locale as explicit so the server can persist it.',
    );
  });
});
