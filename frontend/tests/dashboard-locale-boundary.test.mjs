/**
 * Dashboard locale boundary — regression guard
 *
 * InstallGuide (and similar) call useT()/useLocale() from LocaleContext.
 * They MUST NOT mount from dashboard/layout.tsx before LocaleProvider exists
 * (DashboardShell wraps LocaleGate → LocaleProvider).
 *
 * Run: node --test tests/dashboard-locale-boundary.test.mjs
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const LAYOUT_PATH = resolve(
  ROOT,
  'src',
  'app',
  '(dashboard)',
  'dashboard',
  'layout.tsx',
);
const SHELL_PATH = resolve(ROOT, 'src', 'components', 'dashboard', 'DashboardShell.tsx');

/** Components that require LocaleProvider; keep in sync with real imports. */
const LAYOUT_FORBIDDEN_IMPORTS = [
  { module: '@/components/InstallGuide', component: 'InstallGuide' },
];

describe('dashboard locale provider boundary', () => {
  it('dashboard layout must not import or render locale-dependent shell components', () => {
    const src = readFileSync(LAYOUT_PATH, 'utf-8');

    for (const { module, component } of LAYOUT_FORBIDDEN_IMPORTS) {
      assert.ok(
        !src.includes(`from '${module}'`) && !src.includes(`from "${module}"`),
        `${LAYOUT_PATH} must not import ${module} (${component} needs LocaleProvider).`,
      );
      assert.ok(
        !src.includes(`<${component}`),
        `${LAYOUT_PATH} must not render <${component} /> outside DashboardShell.`,
      );
    }
  });

  it('DashboardShell must mount InstallGuide inside LocaleGate (under LocaleProvider)', () => {
    const src = readFileSync(SHELL_PATH, 'utf-8');

    assert.ok(
      src.includes("from '@/components/InstallGuide'") ||
        src.includes('from "@/components/InstallGuide"'),
      `${SHELL_PATH} should import InstallGuide.`,
    );

    const gateOpen = src.indexOf('<LocaleGate>');
    const install = src.indexOf('<InstallGuide');
    const stock = src.indexOf('<StockProvider');

    assert.ok(gateOpen !== -1, `${SHELL_PATH} must render <LocaleGate>.`);
    assert.ok(install !== -1, `${SHELL_PATH} must render <InstallGuide />.`);
    assert.ok(stock !== -1, `${SHELL_PATH} must render <StockProvider>.`);
    assert.ok(
      gateOpen < install && install < stock,
      'Expected order: <LocaleGate> … <InstallGuide /> … <StockProvider> so InstallGuide is under LocaleProvider.',
    );
  });
});
