// 공간 파일 계약을 확인한 뒤 다운로드합니다. / Validate spatial files before scheduling downloads.
function boundsOf(value, label) {
    if (!value || !['min', 'max'].every((key) => Array.isArray(value[key]) && value[key].length === 3
        && value[key].every(Number.isFinite)) || value.min.some((n, i) => n > value.max[i])) {
        throw new Error(`Invalid bounds for ${label}`);
    }
    return { min: [...value.min], max: [...value.max] };
}

function positive(value, fallback, label) {
    const result = value ?? fallback;
    if (!Number.isFinite(result) || result <= 0) throw new Error(`Invalid ${label}`);
    return result;
}

function chunkOf(value) {
    if (!value || typeof value.id !== 'string' || !value.id || typeof value.url !== 'string' || !value.url) {
        throw new Error('A spatial chunk needs an id and URL');
    }
    const loadDistance = positive(value.loadDistance, 90, 'load distance');
    const unloadDistance = positive(value.unloadDistance, loadDistance * 1.65, 'unload distance');
    if (unloadDistance <= loadDistance) throw new Error('Unload distance must exceed load distance');
    const maxViewDistance = positive(value.maxViewDistance, loadDistance * 3, 'view distance');
    const renderDistance = value.renderDistance === undefined ? undefined : positive(value.renderDistance, undefined, 'render distance');
    if (renderDistance > maxViewDistance) throw new Error('Render distance must not exceed view distance');
    return {
        ...value, bounds: boundsOf(value.bounds, value.id), loadDistance, unloadDistance, maxViewDistance, renderDistance,
        shadowDistance: positive(value.shadowDistance, 45, 'shadow distance'),
    };
}

export function validateStreamManifest(value) {
    if (value?.version !== 1 || !value.core || typeof value.core.url !== 'string' || !value.core.url
        || !Array.isArray(value.chunks)) throw new Error('Unsupported spatial model manifest');
    const chunks = value.chunks.map(chunkOf);
    if (new Set(chunks.map((item) => item.id)).size !== chunks.length) throw new Error('Duplicate spatial chunk id');
    const patch = value.sTheatrePatch;
    const sTheatrePatch = patch && typeof patch.url === 'string'
        && /^\/model\/[a-z0-9_-]+\/theatre[.]glb$/i.test(patch.url)
        && Array.isArray(patch.hideFromCore) && patch.hideFromCore.length === 8
        && patch.hideFromCore.every(name => typeof name === 'string' && name.length <= 150)
        ? { url: patch.url, hideFromCore: [...patch.hideFromCore] } : undefined;
    return { ...value, sTheatrePatch, core: { ...value.core, bounds: boundsOf(value.core.bounds, 'core') },
        focusBounds: value.focusBounds ? boundsOf(value.focusBounds, 'focus') : undefined, chunks };
}

const pointOf = (point) => Array.isArray(point) ? [...point] : [point.x, point.y, point.z];
function distance(point, bounds, flat = false) {
    const dx = Math.max(bounds.min[0] - point[0], 0, point[0] - bounds.max[0]);
    const dy = flat ? 0 : Math.max(bounds.min[1] - point[1], 0, point[1] - bounds.max[1]);
    const dz = Math.max(bounds.min[2] - point[2], 0, point[2] - bounds.max[2]);
    return Math.hypot(dx, dy, dz);
}

// 목표 위치와 실제 화면 크기에 맞춰 한 파일씩 로드합니다. / Stream one nearby, large-enough detail at a time.
export function createSpatialModelStreamer({ chunks, load, attach, onChange = () => {}, concurrency = 1,
    unloadDelayMs = 20000, retryDelayMs = 30000 }) {
    const entries = chunks.map((value) => ({ chunk: chunkOf(value), state: 'idle', asset: null, controller: null,
        cancelled: false, farSince: null, retryAt: 0, shadow: null, visible: false, attempts: 0, focusDistance: Infinity, proximityDistance: Infinity, viewDistance: Infinity }));
    let closed = false; let active = 0; let current = null; let paused = false;

    const release = (entry) => {
        const value = entry.asset;
        entry.asset = null; entry.state = 'idle'; entry.shadow = null; entry.visible = false; entry.farSince = null;
        value?.dispose();
        if (value) onChange();
    };
    const wanted = (entry) => entry.proximityDistance <= entry.chunk.loadDistance && entry.viewDistance <= entry.chunk.maxViewDistance;
    const far = (entry) => entry.proximityDistance > entry.chunk.unloadDistance || entry.viewDistance > entry.chunk.maxViewDistance * 1.25;
    const measure = () => {
        for (const entry of entries) {
            entry.focusDistance = distance(current.focus, entry.chunk.bounds, true);
            entry.proximityDistance = Math.min(entry.focusDistance, distance(current.camera, entry.chunk.bounds, true));
            entry.viewDistance = distance(current.camera, entry.chunk.bounds);
        }
    };
    const display = (entry) => {
        if (!entry.asset) return;
        // 장식 청크만 GPU 제출 거리와 다운로드 거리를 분리합니다. / Opt-in detail can stay warm without rendering.
        // A hidden chunk only returns 15% inside the exit limit; geometry and texture handles are retained.
        const budget = entry.chunk.renderDistance;
        const visible = !far(entry) && (budget === undefined || entry.viewDistance <= budget * (entry.visible ? 1 : 0.85));
        const root = entry.asset.root;
        let changed = root.visible !== visible;
        if (changed) root.visible = visible;
        entry.visible = visible;
        const shadow = visible && entry.viewDistance <= entry.chunk.shadowDistance;
        if (entry.shadow !== shadow) { entry.asset.setShadows?.(shadow); entry.shadow = shadow; changed = true; }
        if (changed) onChange();
    };

    function drain() {
        if (closed || paused || !current) return;
        const candidates = entries.filter((entry) => (entry.state === 'idle' || entry.state === 'failed')
            && entry.retryAt <= current.now && wanted(entry))
            .sort((a, b) => a.focusDistance - b.focusDistance || a.viewDistance - b.viewDistance);
        for (const entry of candidates) {
            if (active >= concurrency) break;
            const controller = new AbortController();
            entry.controller = controller; entry.cancelled = false; entry.state = 'loading'; entry.attempts += 1; active += 1;
            Promise.resolve().then(() => load(entry.chunk.url, { signal: controller.signal, chunk: entry.chunk })).then((value) => {
                if (closed || entry.cancelled || controller.signal.aborted) { value.dispose(); entry.state = 'idle'; return; }
                if (!value?.root) throw new Error('Loaded model has no root');
                entry.asset = value; entry.state = 'loaded'; entry.farSince = null;
                attach(value, entry.chunk); display(entry); onChange();
            }).catch((error) => {
                if (entry.asset) release(entry);
                entry.state = controller.signal.aborted || error?.name === 'AbortError' ? 'idle' : 'failed';
                if (entry.state === 'failed') entry.retryAt = (current?.now ?? 0) + retryDelayMs;
            }).finally(() => { entry.controller = null; active -= 1; drain(); });
        }
    }

    return {
        update(focus, { cameraPosition = focus, now = performance.now() } = {}) {
            if (closed) return;
            current = { focus: pointOf(focus), camera: pointOf(cameraPosition), now };
            measure();
            for (const entry of entries) {
                if (entry.state === 'loading' && far(entry)) { entry.cancelled = true; entry.controller?.abort(); }
                if (entry.state !== 'loaded') continue;
                display(entry);
                if (far(entry)) {
                    entry.farSince ??= now;
                    if (now - entry.farSince >= unloadDelayMs) release(entry);
                } else entry.farSince = null;
            }
            drain();
        },
        setPaused(value) {
            paused = value;
            if (paused) for (const entry of entries) {
                if (entry.state === 'loading') { entry.cancelled = true; entry.controller?.abort(); }
            }
            else drain();
        },
        isVisible(id) { return entries.some(entry => entry.chunk.id === id && entry.state === 'loaded' && entry.visible); },
        snapshot() {
            return entries.map((entry) => ({ id: entry.chunk.id, state: entry.state, visible: entry.asset?.root.visible ?? false,
                attempts: entry.attempts, focusDistance: entry.focusDistance, proximityDistance: entry.proximityDistance, viewDistance: entry.viewDistance }));
        },
        dispose() {
            if (closed) return;
            closed = true;
            for (const entry of entries) { entry.cancelled = true; entry.controller?.abort(); release(entry); }
        },
    };
}

