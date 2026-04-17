import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TELEMETRY_PATH = resolve(ROOT, 'src', 'components', 'analytics', 'AppEntryTelemetry.tsx');

describe('app entry telemetry', () => {
  it('tracks entry classification and first usable milestones', () => {
    const src = readFileSync(TELEMETRY_PATH, 'utf-8');

    assert.ok(
      src.includes("trackEvent('entry_classification_started'") &&
      src.includes("trackEvent('entry_classification_resolved'") &&
      src.includes("trackEvent('entry_route_loading_shown'") &&
      src.includes("trackEvent('onboarding_first_meaningful_paint'") &&
      src.includes("trackEvent('dashboard_first_usable'"),
      'App entry telemetry should emit the core route-classification and first-usable analytics events.',
    );
  });
});
