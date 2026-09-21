import { and, eq, sql } from 'drizzle-orm';
import logger from '../log';
import * as schema from './db/schema';
import { getDb } from './db';

const log = logger.child({ component: 'store-hub-mirror' });

/**
 * Hub registry mirror list, editable from the web UI.
 *
 * Persisted as a single row in the generic `wud_configurations` table
 * (type='hub', name='mirrors', config=[ "https://...", ... ]).
 *
 * Semantics agreed with the product owner (2026-09-21):
 *   - when a row exists (a non-empty list), the UI list is the source of
 *     truth and takes priority over the env var `WUD_REGISTRY_HUB_URL`;
 *   - when no row exists (or the list is empty), Hub falls back to the env
 *     value (possibly itself a comma-separated list of mirrors).
 *
 * Every function is fail-safe: it returns `undefined` / `[]` instead of
 * throwing when the store is not ready (unit tests, one-shot helpers).
 */

/** Fixed row id for the single hub-mirror configuration row. */
const ROW_ID = 'hub-mirrors';

/**
 * Open the db, returning undefined instead of throwing when the store is not
 * ready (e.g. during unit tests or a one-shot helper run).
 */
function openDb() {
    try {
        return getDb();
    } catch (e: any) {
        log.debug(`Store not ready, ignoring hub mirror list (${e.message})`);
        return undefined;
    }
}

/**
 * Read the UI-managed hub mirror list.
 * @returns string[] of mirror base URLs, or undefined when no row exists.
 */
export function getMirrors(): string[] | undefined {
    const db = openDb();
    if (!db) {
        return undefined;
    }
    try {
        const row = db
            .select()
            .from(schema.wudConfigurations)
            .where(
                and(
                    eq(schema.wudConfigurations.type, 'hub'),
                    eq(schema.wudConfigurations.name, 'mirrors'),
                ),
            )
            .get();
        if (!row || !Array.isArray(row.config)) {
            return undefined;
        }
        const mirrors = (row.config as string[])
            .map((m) => String(m).trim())
            .filter((m) => m.length > 0);
        return mirrors.length > 0 ? mirrors : undefined;
    } catch (e: any) {
        log.warn(`Unable to read hub mirror list (${e.message})`);
        return undefined;
    }
}

/**
 * Persist (replace) the UI-managed hub mirror list.
 * Passing an empty array clears the row, so Hub falls back to env.
 * @param mirrors
 * @returns the persisted list (possibly empty after a clear)
 */
export function setMirrors(mirrors: string[]): string[] {
    const clean = (mirrors || [])
        .map((m) => String(m).trim())
        .filter((m) => m.length > 0);
    const db = getDb();
    if (clean.length === 0) {
        db.delete(schema.wudConfigurations)
            .where(
                and(
                    eq(schema.wudConfigurations.type, 'hub'),
                    eq(schema.wudConfigurations.name, 'mirrors'),
                ),
            )
            .run();
        log.info('Hub mirror list cleared (falling back to env)');
        return [];
    }
    db.insert(schema.wudConfigurations)
        .values({
            id: ROW_ID,
            type: 'hub',
            name: 'mirrors',
            config: clean,
            enabled: true,
        })
        .onConflictDoUpdate({
            target: schema.wudConfigurations.id,
            set: {
                config: clean,
                enabled: true,
                updatedAt: sql`CURRENT_TIMESTAMP`,
            },
        })
        .run();
    log.info(`Hub mirror list persisted (${clean.length} mirror(s))`);
    return clean;
}