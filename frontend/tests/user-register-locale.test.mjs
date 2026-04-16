import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const USER_LIB_PATH = resolve(ROOT, 'src', 'lib', 'user.ts');
const REGISTER_ROUTE_PATH = resolve(ROOT, 'src', 'app', 'api', 'user', 'register', 'route.ts');
const REDEEM_ROUTE_PATH = resolve(ROOT, 'src', 'app', 'api', 'user', 'redeem', 'route.ts');
const DB_SCHEMA_PATH = resolve(ROOT, '..', 'backend', 'database.py');

describe('user register locale persistence', () => {
  it('client register sync should include the initial environment locale', () => {
    const src = readFileSync(USER_LIB_PATH, 'utf-8');

    assert.ok(
      src.includes('function getInitialLocale(): \'cn\' | \'en\' {'),
      'User bootstrap should compute an initial locale before register.',
    );
    assert.ok(
      src.includes('locale: getInitialLocale(),'),
      'Register request should send the initial locale to the server.',
    );
  });

  it('register route should persist locale explicitly instead of relying on DB defaults', () => {
    const src = readFileSync(REGISTER_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes('const locale = normalizeLocale(body.locale);'),
      'Register route should normalize locale from the client request.',
    );
    assert.ok(
      src.includes('INSERT OR IGNORE INTO users (') && src.includes('locale,'),
      'Register route should include locale in the insert statement.',
    );
  });

  it('register route should persist registration device metadata for funnel analysis', () => {
    const src = readFileSync(REGISTER_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes("function classifyDeviceCategory(userAgent: string | null): 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown' {"),
      'Register route should classify the registering device from the request user agent.',
    );
    assert.ok(
      src.includes("const registrationUserAgent = request.headers.get('user-agent');"),
      'Register route should read the request user agent.',
    );
    assert.ok(
      src.includes("const registrationDeviceCategory = classifyDeviceCategory(registrationUserAgent);"),
      'Register route should derive a device category for the registering user.',
    );
    assert.ok(
      src.includes('registration_user_agent,') && src.includes('registration_device_category'),
      'Register route insert should persist device metadata columns.',
    );
  });

  it('redeem route should not create users through the DB default locale path', () => {
    const src = readFileSync(REDEEM_ROUTE_PATH, 'utf-8');

    assert.ok(
      src.includes('registration_type, locale)'),
      'Redeem route should include locale in its insert column list.',
    );
    assert.ok(
      src.includes("VALUES (?, ?, ?, 'anonymous', NULL)"),
      'Redeem route should bypass any DB default locale when creating a missing user row.',
    );
  });

  it('base users schema should no longer default locale to cn', () => {
    const src = readFileSync(DB_SCHEMA_PATH, 'utf-8');

    assert.ok(
      src.includes('locale TEXT,'),
      'Users schema should leave locale unset until the first environment locale is known.',
    );
    assert.ok(
      !src.includes("locale TEXT DEFAULT 'cn'"),
      'Users schema should not force cn as a default locale.',
    );
  });

  it('base users schema should expose registration device metadata columns', () => {
    const src = readFileSync(DB_SCHEMA_PATH, 'utf-8');

    assert.ok(
      src.includes('registration_user_agent TEXT,'),
      'Users schema should persist the registration user agent.',
    );
    assert.ok(
      src.includes('registration_device_category TEXT,'),
      'Users schema should persist the registration device category.',
    );
    assert.ok(
      src.includes("add_column_if_missing('users', 'registration_user_agent', 'TEXT')"),
      'Users migrations should backfill the registration_user_agent column.',
    );
    assert.ok(
      src.includes("add_column_if_missing('users', 'registration_device_category', 'TEXT')"),
      'Users migrations should backfill the registration_device_category column.',
    );
  });
});
