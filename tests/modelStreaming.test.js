import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import * as THREE from 'three';
import { createSpatialModelStreamer, validateStreamManifest } from '../src/modelStreaming.js';
import { disposeModelResources, shouldCastModelShadow } from '../src/modelResources.js';

const chunk = (id, x = 0, extra = {}) => ({ id, url: `/${id}.glb`, bounds: { min: [x, 0, -10], max: [x + 10, 10, 10] }, loadDistance: 50, unloadDistance: 90, maxViewDistance: 100, shadowDistance: 35, ...extra });
const asset = () => ({ root: new THREE.Group(), disposed: 0, shadowStates: [], dispose() { this.disposed += 1; this.root.removeFromParent(); }, setShadows(value) { this.shadowStates.push(value); } });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
async function waitFor(predicate) {
    const deadline = Date.now() + 2000;
    while (!predicate() && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 5));
    assert.ok(predicate(), 'expected asynchronous model state was not reached');
}

test('a far detail makes no HTTP request until its focus and actual camera both approach', async () => {
    const requests = [];
    const server = createServer((req, res) => { requests.push(req.url); res.end('model bytes'); });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const attached = [];
    const streamer = createSpatialModelStreamer({
        chunks: [chunk('cafe', 200)],
        load: async (url, { signal }) => { const response = await fetch(origin + url, { signal }); await response.arrayBuffer(); return asset(); },
        attach: (value) => attached.push(value),
    });
    try {
        streamer.update([0, 0, 0], { cameraPosition: [0, 20, 0], now: 0 });
        await settle(); assert.deepEqual(requests, []);
        streamer.update([205, 0, 0], { cameraPosition: [205, 400, 0], now: 100 });
        await settle(); assert.deepEqual(requests, []);
        streamer.update([205, 0, 0], { cameraPosition: [205, 20, 0], now: 200 });
        await waitFor(() => attached.length === 1);
        assert.deepEqual(requests, ['/cafe.glb']);
    } finally { streamer.dispose(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});

test('one download runs at a time and nearest focused zone is requested first', async () => {
    const pending = []; const attached = [];
    const streamer = createSpatialModelStreamer({ chunks: [chunk('further', 35), chunk('nearer', 10)], load: (url) => new Promise((resolve) => pending.push({ url, resolve })), attach: (value) => attached.push(value) });
    streamer.update([0, 0, 0], { now: 0 });
    await settle(); assert.deepEqual(pending.map((item) => item.url), ['/nearer.glb']);
    pending[0].resolve(asset()); await settle();
    assert.deepEqual(pending.map((item) => item.url), ['/nearer.glb', '/further.glb']);
    pending[1].resolve(asset()); await settle();
    assert.equal(attached.length, 2); streamer.dispose();
});

test('an orbit camera beside a detail can load it while the orbit target remains at the main building', async () => {
    let calls = 0;
    const streamer = createSpatialModelStreamer({ chunks: [chunk('beside-camera', 200)], load: async () => { calls += 1; return asset(); }, attach() {} });
    streamer.update([0, 0, 0], { cameraPosition: [205, 20, 0], now: 0 });
    await settle(); assert.equal(calls, 1);
    streamer.dispose();
});

test('loaded detail survives threshold jitter but distant resources are evicted after 20 seconds', async () => {
    const assets = []; let calls = 0;
    const streamer = createSpatialModelStreamer({ chunks: [chunk('garden')], load: async () => { calls += 1; const value = asset(); assets.push(value); return value; }, attach() {} });
    streamer.update([5, 0, 0], { now: 0 }); await settle();
    assert.equal(calls, 1);
    streamer.update([80, 0, 0], { now: 100 });
    streamer.update([40, 0, 0], { now: 300 });
    assert.equal(calls, 1); assert.equal(assets[0].disposed, 0);
    streamer.update([200, 0, 0], { now: 1000 });
    assert.equal(assets[0].root.visible, false);
    streamer.update([200, 0, 0], { now: 20999 }); assert.equal(assets[0].disposed, 0);
    streamer.update([200, 0, 0], { now: 21001 }); assert.equal(assets[0].disposed, 1);
    streamer.update([5, 0, 0], { now: 22000 }); await settle(); assert.equal(calls, 2);
    streamer.dispose(); assert.equal(assets[1].disposed, 1);
});

test('teleport cancels the request and a late unmount result is disposed without attaching', async () => {
    let resolve; let signal; const attached = []; const value = asset();
    const streamer = createSpatialModelStreamer({ chunks: [chunk('detail')], load: (_url, options) => { signal = options.signal; return new Promise((done) => { resolve = done; }); }, attach: (item) => attached.push(item) });
    streamer.update([0, 0, 0], { now: 0 }); await settle();
    streamer.update([500, 0, 0], { now: 100 }); assert.equal(signal.aborted, true);
    streamer.dispose(); resolve(value); await settle();
    assert.equal(attached.length, 0); assert.equal(value.disposed, 1);
});

test('optional failures back off instead of retrying every animation frame', async () => {
    let calls = 0;
    const streamer = createSpatialModelStreamer({ chunks: [chunk('failed')], load: async () => { calls += 1; throw new Error('offline'); }, attach() {} });
    streamer.update([0, 0, 0], { now: 0 }); await settle(); assert.equal(calls, 1);
    for (let now = 16; now < 1000; now += 16) streamer.update([0, 0, 0], { now });
    await settle(); assert.equal(calls, 1);
    streamer.update([0, 0, 0], { now: 30001 }); await settle(); assert.equal(calls, 2); streamer.dispose();
});

test('manifest rejects malformed bounds and duplicate zone IDs before any download', () => {
    const core = { url: '/core.glb', bounds: { min: [-10, 0, -10], max: [10, 20, 10] } };
    assert.equal(validateStreamManifest({ version: 1, core, chunks: [chunk('ok')] }).chunks[0].id, 'ok');
    assert.throws(() => validateStreamManifest({ version: 1, core, chunks: [chunk('bad', 0, { bounds: { min: [5, 0, 0], max: [0, 0, 0] } })] }), /bounds/i);
    assert.throws(() => validateStreamManifest({ version: 1, core, chunks: [chunk('same'), chunk('same')] }), /duplicate/i);
    assert.throws(() => validateStreamManifest({ version: 1, core, focusBounds: { min: [8, 0, 0], max: [0, 0, 0] }, chunks: [] }), /bounds/i);
    const district = validateStreamManifest({ version: 1, core: { ...core, bounds: { min: [-500, 0, -500], max: [500, 150, 500] } }, focusBounds: core.bounds, chunks: [] });
    assert.equal(district.core.bounds.max[0], 500);
    assert.deepEqual(district.focusBounds, core.bounds);
});

test('shared geometry, all material texture slots and instance buffers are disposed once', () => {
    const root = new THREE.Group(); const geometry = new THREE.BoxGeometry(); const texture = new THREE.Texture(); const material = new THREE.MeshStandardMaterial({ map: texture, normalMap: texture, roughnessMap: texture });
    const instance = new THREE.InstancedMesh(geometry, material, 2); root.add(instance, new THREE.Mesh(geometry, material));
    const counts = { geometry: 0, material: 0, texture: 0, instance: 0 };
    geometry.addEventListener('dispose', () => counts.geometry++); material.addEventListener('dispose', () => counts.material++); texture.addEventListener('dispose', () => counts.texture++); instance.addEventListener('dispose', () => counts.instance++);
    disposeModelResources(root);
    assert.deepEqual(counts, { geometry: 1, material: 1, texture: 1, instance: 1 });
});

test('broad ground receives light without self-shadow acne while architecture and small curbs still cast', () => {
    const material = new THREE.MeshStandardMaterial();
    const mesh = { name: 'Surroundings - continuous plaza foundation', material, userData: {} };
    const box = (min, max) => new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
    assert.equal(shouldCastModelShadow(mesh, box([-210,-.48,-168],[240,0,260])), false);
    assert.equal(shouldCastModelShadow({ ...mesh, name: 'Stone roof and walls' }, box([-10,0,-10],[10,20,10])), true);
    assert.equal(shouldCastModelShadow({ ...mesh, name: 'Survey143 low planter curb' }, box([0,0,0],[6.5,.28,.18])), true);
    material.dispose();
});
