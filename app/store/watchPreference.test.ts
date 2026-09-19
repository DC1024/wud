import * as watchPreference from './watchPreference';
import { initDatabase, closeDatabase } from './db';

describe('Watch Preference Store (SQLite)', () => {
    beforeEach(() => {
        closeDatabase();
        initDatabase(':memory:');
    });

    afterAll(() => {
        closeDatabase();
    });

    test('getWatched returns undefined when nothing is stored', () => {
        expect(watchPreference.getWatched('local', 'nginx')).toBeUndefined();
    });

    test('setWatched inserts then getWatched reads it back', () => {
        watchPreference.setWatched('local', 'nginx', true);
        expect(watchPreference.getWatched('local', 'nginx')).toBe(true);

        watchPreference.setWatched('local', 'nginx', false);
        expect(watchPreference.getWatched('local', 'nginx')).toBe(false);
    });

    test('setWatched upserts instead of duplicating', () => {
        watchPreference.setWatched('local', 'nginx', true);
        watchPreference.setWatched('local', 'nginx', false);

        const all = watchPreference.listPreferences();
        expect(all).toHaveLength(1);
        expect(all[0]).toEqual({
            watcher: 'local',
            name: 'nginx',
            watched: false,
        });
    });

    test('preferences are scoped by watcher', () => {
        watchPreference.setWatched('local', 'nginx', true);
        watchPreference.setWatched('remote-vps', 'nginx', false);

        expect(watchPreference.getWatched('local', 'nginx')).toBe(true);
        expect(watchPreference.getWatched('remote-vps', 'nginx')).toBe(false);
    });

    test('getWatchedMap returns a map keyed by container name', () => {
        watchPreference.setWatched('local', 'nginx', true);
        watchPreference.setWatched('local', 'kavita', false);
        watchPreference.setWatched('other', 'ignored', true);

        const map = watchPreference.getWatchedMap('local');
        expect(map.size).toBe(2);
        expect(map.get('nginx')).toBe(true);
        expect(map.get('kavita')).toBe(false);
        expect(map.has('ignored')).toBe(false);
    });

    test('clearWatched removes only the targeted container', () => {
        watchPreference.setWatched('local', 'nginx', true);
        watchPreference.setWatched('local', 'kavita', true);

        watchPreference.clearWatched('local', 'nginx');

        expect(watchPreference.getWatched('local', 'nginx')).toBeUndefined();
        expect(watchPreference.getWatched('local', 'kavita')).toBe(true);
    });

    test('clearing an unknown container is a no-op', () => {
        watchPreference.setWatched('local', 'nginx', true);
        expect(() =>
            watchPreference.clearWatched('local', 'does-not-exist'),
        ).not.toThrow();
        expect(watchPreference.listPreferences()).toHaveLength(1);
    });

    test('listPreferences returns every entry', () => {
        watchPreference.setWatched('local', 'a', true);
        watchPreference.setWatched('remote', 'b', false);

        const all = watchPreference.listPreferences();
        expect(all).toHaveLength(2);
        expect(all).toEqual(
            expect.arrayContaining([
                { watcher: 'local', name: 'a', watched: true },
                { watcher: 'remote', name: 'b', watched: false },
            ]),
        );
    });

    test('reads fail safe when the store is not initialized', () => {
        closeDatabase();
        expect(watchPreference.getWatched('local', 'nginx')).toBeUndefined();
        expect(watchPreference.getWatchedMap('local').size).toBe(0);
        expect(watchPreference.listPreferences()).toEqual([]);
    });
});
