import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const MANIFEST_ROUTE_PATH = resolve(ROOT, 'src', 'app', 'manifest.json', 'route.ts');

describe('pwa manifest locale regression', () => {
  it('manifest route should localize install metadata for app.ziso.cc', () => {
    const src = readFileSync(MANIFEST_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes('function resolveManifestLocale(request: Request): ManifestLocale') &&
      src.includes("const isAppDomain = hosts.some((host) => host === 'app.ziso.cc' || host.startsWith('app.'));") &&
      src.includes("if (isAppDomain) return 'en';"),
      'Manifest route should default app-domain installs to English metadata.',
    );
  });

  it('manifest route should provide English copy and avoid CN-only screenshots for intl installs', () => {
    const src = readFileSync(MANIFEST_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes("description: 'An ultra-simple AI investing workspace for real-time monitoring, deep review, and disciplined decisions.'") &&
      src.includes("lang: 'en'") &&
      !src.includes("screenshots: CN_SCREENSHOTS,\n      shortcuts: EN_SHORTCUTS"),
      'English manifest should expose English metadata rather than the Chinese screenshot set.',
    );
  });

  it('manifest route should still preserve a Chinese manifest variant', () => {
    const src = readFileSync(MANIFEST_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes("description: '极致简单的 AI 炒股决策工具，实时监控、深度复盘、智能决策。'") &&
      src.includes("lang: 'zh-CN'") &&
      src.includes('screenshots: CN_SCREENSHOTS') &&
      src.includes('shortcuts: CN_SHORTCUTS'),
      'Chinese installs should keep the existing localized manifest assets.',
    );
  });
});
