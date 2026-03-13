import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/prediction-display.ts')).href;
const {
    EFFECTIVE_VALIDATION_STATUS_SQL,
    getValidationWindowLabel,
    parseValidationData,
} = await import(moduleUrl);

describe('prediction display validation helpers', () => {
    it('uses stored backend validation status directly', () => {
        assert.equal(EFFECTIVE_VALIDATION_STATUS_SQL.trim(), 'p.validation_status');
    });

    it('parses validation payload safely', () => {
        assert.deepEqual(parseValidationData('{"window":3,"cum_change":1.6}'), { window: 3, cum_change: 1.6 });
        assert.equal(parseValidationData('not-json'), null);
    });

    it('formats window labels conservatively', () => {
        assert.equal(getValidationWindowLabel(3), '3日回看');
        assert.equal(getValidationWindowLabel(1), '收盘验证');
    });
});
