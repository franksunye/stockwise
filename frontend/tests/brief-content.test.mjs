import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const moduleUrl = pathToFileURL(path.resolve(__dirname, '../src/lib/brief-content.ts')).href;
const { extractBriefSectionForSymbol, getBriefPublishedAt } = await import(moduleUrl);

const SAMPLE_BRIEF = `
### 腾讯控股(00700)
第一段分析。

第二段分析。

---

### 阿里巴巴(09988)
另一段分析。

ZISO AI 生成于 16:08
`.trim();

describe('brief content helpers', () => {
    it('extracts the requested stock section from a multi-stock brief', () => {
        const section = extractBriefSectionForSymbol(SAMPLE_BRIEF, '00700');

        assert.match(section || '', /腾讯控股/);
        assert.doesNotMatch(section || '', /阿里巴巴/);
    });

    it('falls back to created_at time when generated-at marker is missing', () => {
        const publishedAt = getBriefPublishedAt({
            content: '### 测试\n正文',
            created_at: '2026-03-26T08:15:00.000Z',
        });

        assert.equal(publishedAt, '16:15');
    });
});
