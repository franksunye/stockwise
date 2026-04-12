import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const profileRoute = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/user/profile/route.ts'),
    'utf8'
);

const registerRoute = fs.readFileSync(
    path.join(process.cwd(), 'src/app/api/user/register/route.ts'),
    'utf8'
);

const userCenterDrawer = fs.readFileSync(
    path.join(process.cwd(), 'src/components/UserCenterDrawer.tsx'),
    'utf8'
);

const referralAliasLib = fs.readFileSync(
    path.join(process.cwd(), 'src/lib/referral-alias.ts'),
    'utf8'
);

test('profile route always ensures a referral alias before returning referral data', () => {
    assert.match(
        profileRoute,
        /const referralAlias = await ensureUserReferralAlias\(client, user\.user_id, user\.referral_alias\);/
    );
});

test('register route assigns a default referral alias for every user', () => {
    assert.match(
        registerRoute,
        /const referralAlias = await ensureUserReferralAlias\(client, userId\);/
    );
    assert.match(registerRoute, /referralAlias,/);
});

test('user center invite link never falls back to user id', () => {
    assert.match(userCenterDrawer, /if \(!referralAlias\) \{/);
    assert.doesNotMatch(userCenterDrawer, /`\$\{base\}\/v\/\$\{userId\}`/);
});

test('default referral alias uses a fixed length without the old sw prefix', () => {
    assert.match(referralAliasLib, /const DEFAULT_ALIAS_LENGTH = 10;/);
    assert.doesNotMatch(referralAliasLib, /sw_/);
});
