// @ts-nocheck
import { Router } from 'express';
import axios from 'axios';
import nocache from 'nocache';
import * as component from './component';
import { requireRole } from './rbac';
import * as hubMirrorStore from '../store/hubMirror';

export function getRegistries(req, res) {
    return component.getAll(req, res, 'registry');
}

export function getRegistry(req, res) {
    return component.getById(req, res, 'registry');
}

/** How long to wait when probing a mirror's `/v2/` for reachability. */
const MIRROR_PROBE_TIMEOUT_MS = 8000;

/**
 * Probe a single mirror base URL the same way the Hub provider would:
 * GET /v2/ and inspect the `WWW-Authenticate` challenge.
 * @returns {{ok: boolean, status: number|string, kind: string, error?: string}}
 */
async function probeMirror(url) {
    const base = String(url || '').replace(/\/+$/, '');
    if (!base) {
        return {
            ok: false,
            status: 'n/a',
            kind: 'invalid',
            error: 'empty url',
        };
    }
    try {
        const response = await axios({
            method: 'GET',
            url: `${base}/v2/`,
            validateStatus: () => true,
            timeout: MIRROR_PROBE_TIMEOUT_MS,
        });
        const www = String(
            (response.headers && response.headers['www-authenticate']) || '',
        );
        let kind = 'anonymous';
        if (/bearer/i.test(www)) {
            kind = 'bearer';
        } else if (/basic/i.test(www)) {
            kind = 'basic';
        }
        return {
            ok: response.status === 200 || response.status === 401,
            status: response.status,
            kind,
            auth: www.slice(0, 80),
        };
    } catch (e) {
        return {
            ok: false,
            status: 'ERR',
            kind: 'unreachable',
            error: String((e && e.message) || e).slice(0, 120),
        };
    }
}

/**
 * Effective mirror list the Hub provider will use right now.
 */
function getEffectiveMirrors() {
    const ui = hubMirrorStore.getMirrors();
    if (ui && ui.length > 0) {
        return ui;
    }
    return [];
}

/**
 * GET /api/registries/hub/mirrors
 * Return the UI-managed mirror list, the effective list, and a per-mirror
 * health probe. Read-only.
 */
export async function listHubMirrors(req, res) {
    try {
        const ui = hubMirrorStore.getMirrors() || [];
        const effective = getEffectiveMirrors();
        const health = [];
        for (const mirror of effective) {
            health.push({ url: mirror, ...(await probeMirror(mirror)) });
        }
        res.status(200).json({ ui, effective, health });
    } catch (e) {
        res.status(500).json({
            error: 'List hub mirrors failed',
            message: e.message,
        });
    }
}

/**
 * PUT /api/registries/hub/mirrors
 * Replace the UI-managed mirror list. Body: { mirrors: string[] }.
 * Empty array clears it so the provider falls back to env.
 */
export function setHubMirrors(req, res) {
    const body = req.body || {};
    if (!Array.isArray(body.mirrors)) {
        return res.status(400).json({
            error: 'Bad request',
            message: 'mirrors must be an array of url strings',
        });
    }
    const mirrors = body.mirrors
        .map((m) => String(m).trim())
        .filter((m) => m.length > 0);
    try {
        const persisted = hubMirrorStore.setMirrors(mirrors);
        res.status(200).json({
            ui: persisted,
            effective: getEffectiveMirrors(),
        });
    } catch (e) {
        res.status(500).json({
            error: 'Set hub mirrors failed',
            message: e.message,
        });
    }
}

/**
 * POST /api/registries/hub/mirrors/test
 * Probe a single mirror URL (useful before saving it). Body: { url }.
 */
export async function testHubMirror(req, res) {
    const body = req.body || {};
    const url = String(body.url || '').trim();
    if (!url) {
        return res.status(400).json({
            error: 'Bad request',
            message: 'url is required',
        });
    }
    try {
        const result = await probeMirror(url);
        res.status(200).json({ url, ...result });
    } catch (e) {
        res.status(500).json({
            error: 'Test hub mirror failed',
            message: e.message,
        });
    }
}

/**
 * Init Router.
 * @returns {*}
 */
export function init() {
    const router = Router();
    router.use(nocache());
    // Specific mirror-management routes, registered BEFORE the generic
    // /:type/:name component route so they are not swallowed by it.
    router.get(
        '/hub/mirrors',
        requireRole(['admin', 'rw', 'ro'], 'read'),
        listHubMirrors,
    );
    router.put(
        '/hub/mirrors',
        requireRole(['admin', 'rw'], 'write'),
        setHubMirrors,
    );
    router.post(
        '/hub/mirrors/test',
        requireRole(['admin', 'rw'], 'write'),
        testHubMirror,
    );
    // Generic registry listing / lookup.
    router.use(component.init('registry'));
    return router;
}
