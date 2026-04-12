import { createHash } from 'crypto';

type DbClient = {
    $type?: string;
    execute?: unknown;
    prepare?: unknown;
};

function normalizeAlias(value: unknown): string | null {
    const alias = typeof value === 'string' ? value.trim() : '';
    return alias || null;
}

const DEFAULT_ALIAS_LENGTH = 10;
const ALIAS_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';

function encodeBase32Chunk(bytes: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;

        while (bits >= 5) {
            output += ALIAS_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }

    if (bits > 0) {
        output += ALIAS_ALPHABET[(value << (5 - bits)) & 31];
    }

    return output;
}

function buildAliasCandidates(userId: string): string[] {
    const digest = createHash('sha256').update(userId).digest();
    const candidates = new Set<string>();

    for (let offset = 0; offset <= digest.length - 7; offset += 3) {
        const chunk = digest.subarray(offset, offset + 7);
        const candidate = encodeBase32Chunk(chunk).slice(0, DEFAULT_ALIAS_LENGTH);
        if (candidate.length === DEFAULT_ALIAS_LENGTH) {
            candidates.add(candidate);
        }
    }

    return [...candidates];
}

async function querySingleRow(db: DbClient, sql: string, args: unknown[]): Promise<Record<string, unknown> | undefined> {
    if (db.$type === 'cloud' && db.execute) {
        const res = await (db.execute as (statement: { sql: string; args?: unknown[] }) => Promise<{ rows?: Record<string, unknown>[] }>).call(db, { sql, args });
        return res.rows?.[0];
    }

    if (db.prepare) {
        const prepared = (db.prepare as (statement: string) => {
            get: (...params: unknown[]) => Record<string, unknown> | undefined;
        }).call(db, sql);
        return prepared.get(...args);
    }

    throw new Error('Unsupported DB client');
}

async function runStatement(db: DbClient, sql: string, args: unknown[]): Promise<void> {
    if (db.$type === 'cloud' && db.execute) {
        await (db.execute as (statement: { sql: string; args?: unknown[] }) => Promise<unknown>).call(db, { sql, args });
        return;
    }

    if (db.prepare) {
        const prepared = (db.prepare as (statement: string) => {
            run: (...params: unknown[]) => unknown;
        }).call(db, sql);
        prepared.run(...args);
        return;
    }

    throw new Error('Unsupported DB client');
}

export async function ensureUserReferralAlias(
    db: DbClient,
    userId: string,
    currentAlias?: unknown
): Promise<string> {
    const existingAlias = normalizeAlias(currentAlias);
    if (existingAlias) return existingAlias;

    for (const candidate of buildAliasCandidates(userId)) {
        const aliasOwner = await querySingleRow(
            db,
            'SELECT user_id FROM users WHERE referral_alias = ? LIMIT 1',
            [candidate]
        );

        if (aliasOwner?.user_id && aliasOwner.user_id !== userId) {
            continue;
        }

        await runStatement(
            db,
            'UPDATE users SET referral_alias = ? WHERE user_id = ? AND (referral_alias IS NULL OR TRIM(referral_alias) = \'\')',
            [candidate, userId]
        );

        const refreshed = await querySingleRow(
            db,
            'SELECT referral_alias FROM users WHERE user_id = ? LIMIT 1',
            [userId]
        );
        const assignedAlias = normalizeAlias(refreshed?.referral_alias);
        if (assignedAlias) return assignedAlias;
    }

    throw new Error(`Failed to ensure referral alias for ${userId}`);
}
