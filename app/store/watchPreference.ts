import { and, eq, sql } from 'drizzle-orm';
import logger from '../log';
import * as schema from './db/schema';
import { getDb } from './db';

const log = logger.child({ component: 'store-watch-preference' });

export interface WatchPreference {
    watcher: string;
    name: string;
    watched: boolean;
}

/**
 * Identity of a preference, without its value. Enough to delete it.
 */
export interface WatchPreferenceKey {
    watcher: string;
    name: string;
}

/**
 * Per-container watch preferences set from the UI.
 *
 * Three-state semantics on purpose:
 *   - a row with watched = true  => watch the container
 *   - a row with watched = false => do not watch the container
 *   - no row at all              => no preference, caller must fall back
 *                                   to labels / watchbydefault
 *
 * Reading always returns `boolean | undefined`; never coerce a missing row
 * to false, otherwise instances relying on `watchbydefault=true` would stop
 * watching everything as soon as this table is introduced.
 *
 * Rows are keyed by (watcher, name) and not by container id, because Docker
 * assigns a new id every time a container is recreated.
 */

/**
 * Open the db, returning undefined instead of throwing when the store is not
 * ready (e.g. during unit tests or a one-shot helper run).
 */
function openDb() {
    try {
        return getDb();
    } catch (e: any) {
        log.debug(`Store not ready, ignoring watch preferences (${e.message})`);
        return undefined;
    }
}

/**
 * Get the preference for a single container.
 * @returns true | false when a preference is set, undefined otherwise
 */
export function getWatched(
    watcher: string,
    name: string,
): boolean | undefined {
    const db = openDb();
    if (!db) {
        return undefined;
    }
    try {
        const row = db
            .select()
            .from(schema.watchedContainers)
            .where(
                and(
                    eq(schema.watchedContainers.watcher, watcher),
                    eq(schema.watchedContainers.name, name),
                ),
            )
            .get();
        return row ? Boolean(row.watched) : undefined;
    } catch (e: any) {
        log.warn(`Unable to read watch preference (${e.message})`);
        return undefined;
    }
}

/**
 * Get all preferences of a watcher as a Map keyed by container name.
 * Meant to be called once per scan, then consulted in memory.
 * @param watcher
 * @returns {Map<string, boolean>}
 */
export function getWatchedMap(watcher: string): Map<string, boolean> {
    const preferences = new Map<string, boolean>();
    const db = openDb();
    if (!db) {
        return preferences;
    }
    try {
        const rows = db
            .select()
            .from(schema.watchedContainers)
            .where(eq(schema.watchedContainers.watcher, watcher))
            .all();
        rows.forEach((row) => preferences.set(row.name, Boolean(row.watched)));
    } catch (e: any) {
        log.warn(`Unable to list watch preferences (${e.message})`);
    }
    return preferences;
}

/**
 * Create or update the preference of a container.
 */
export function setWatched(
    watcher: string,
    name: string,
    watched: boolean,
): WatchPreference {
    const db = getDb();
    db.insert(schema.watchedContainers)
        .values({ watcher, name, watched })
        .onConflictDoUpdate({
            target: [
                schema.watchedContainers.watcher,
                schema.watchedContainers.name,
            ],
            set: { watched, updatedAt: sql`CURRENT_TIMESTAMP` },
        })
        .run();
    log.info(
        `Watch preference set to ${watched} for container ${watcher}_${name}`,
    );
    return { watcher, name, watched };
}

/**
 * Remove the preference of a container, so it falls back to
 * labels / watchbydefault again.
 */
export function clearWatched(watcher: string, name: string): void {
    const db = getDb();
    db.delete(schema.watchedContainers)
        .where(
            and(
                eq(schema.watchedContainers.watcher, watcher),
                eq(schema.watchedContainers.name, name),
            ),
        )
        .run();
    log.info(`Watch preference cleared for container ${watcher}_${name}`);
}

/**
 * Remove several preferences in one call.
 *
 * Meant for orphan cleanup: a preference becomes an orphan as soon as the
 * container it targets disappears or is renamed, and leaving it behind would
 * silently bring the container back into the watch list if a new container
 * ever reused the same name.
 *
 * Only the entries that actually existed are returned, so the caller can
 * report an accurate count.
 */
export function clearWatchedMany(
    entries: WatchPreferenceKey[],
): WatchPreferenceKey[] {
    const removed: WatchPreferenceKey[] = [];
    entries.forEach(({ watcher, name }) => {
        // getWatched returns undefined both when there is no row and when the
        // store is not ready: in both cases there is nothing to delete.
        if (getWatched(watcher, name) === undefined) {
            return;
        }
        try {
            clearWatched(watcher, name);
            removed.push({ watcher, name });
        } catch (e: any) {
            log.warn(
                `Unable to clear watch preference of ${watcher}_${name} (${e.message})`,
            );
        }
    });
    return removed;
}

/**
 * List every stored preference (useful to detect orphans, i.e. preferences
 * pointing to containers that no longer exist).
 */
export function listPreferences(): WatchPreference[] {
    const db = openDb();
    if (!db) {
        return [];
    }
    try {
        return db
            .select()
            .from(schema.watchedContainers)
            .all()
            .map((row) => ({
                watcher: row.watcher,
                name: row.name,
                watched: Boolean(row.watched),
            }));
    } catch (e: any) {
        log.warn(`Unable to list watch preferences (${e.message})`);
        return [];
    }
}
