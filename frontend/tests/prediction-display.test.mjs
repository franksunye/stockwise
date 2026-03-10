import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/prediction-display.ts')).href;
const {
    deriveValidationStatus,
    NOISE_THRESHOLD_PERCENT,
} = await import(moduleUrl);

describe('prediction display validation derivation', () => {
    it('keeps pending-like statuses unchanged', () => {
        assert.equal(deriveValidationStatus('Short', -6.56, 'Pending'), 'Pending');
        assert.equal(deriveValidationStatus('Short', -6.56, 'Verifying'), 'Verifying');
    });

    it('treats risk-off style short calls as correct on down moves', () => {
        assert.equal(deriveValidationStatus('Short', -6.56, 'Incorrect'), 'Correct');
        assert.equal(deriveValidationStatus('Short', 6.54, 'Correct'), 'Incorrect');
    });

    it('applies the same noise threshold to side signals', () => {
        assert.equal(deriveValidationStatus('Side', NOISE_THRESHOLD_PERCENT, 'Incorrect'), 'Correct');
        assert.equal(deriveValidationStatus('Side', -(NOISE_THRESHOLD_PERCENT + 0.01), 'Correct'), 'Incorrect');
    });
});
