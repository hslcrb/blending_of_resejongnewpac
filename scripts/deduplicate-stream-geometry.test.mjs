import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const script = new URL('./deduplicate-stream-geometry.mjs', import.meta.url);

function glb(json, binary) {
    const source = Buffer.from(JSON.stringify(json));
    const j = Buffer.alloc(Math.ceil(source.length / 4) * 4, 0x20);
    source.copy(j);
    const b = Buffer.alloc(Math.ceil(binary.length / 4) * 4);
    binary.copy(b);
    const out = Buffer.alloc(28 + j.length + b.length);
    out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
    out.writeUInt32LE(j.length, 12); out.writeUInt32LE(0x4e4f534a, 16); j.copy(out, 20);
    out.writeUInt32LE(b.length, 20 + j.length); out.writeUInt32LE(0x004e4942, 24 + j.length);
    b.copy(out, 28 + j.length);
    return out;
}

function parse(bytes) {
    const n = bytes.readUInt32LE(12);
    return { json: JSON.parse(bytes.subarray(20, 20 + n)), bin: bytes.subarray(28 + n) };
}

async function fixture(t, includeCore = false) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sejong-stream-test-'));
    t.after(async () => {
        assert.ok(path.resolve(dir).startsWith(path.join(path.resolve(os.tmpdir()), 'sejong-stream-test-')));
        await fs.rm(dir, { recursive: true, force: true });
    });
    const sourceDir = path.join(dir, 'public/model/stream');
    await fs.mkdir(sourceDir, { recursive: true });
    const common = Buffer.from(Array.from({ length: 32 }, (_, i) => i + 1));
    const make = (name, share) => {
        const payload = share ? common : Buffer.alloc(32, 83);
        const local = Buffer.from([7, 9, 11, name.length, 17, 19, 23]);
        const bin = Buffer.concat([payload, local]);
        const json = {
            asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [] }],
            extensionsUsed: ['EXT_meshopt_compression'], extensionsRequired: ['EXT_meshopt_compression'],
            buffers: [{ byteLength: bin.length }, { byteLength: 64, extensions: { EXT_meshopt_compression: { fallback: true } } }],
            bufferViews: [
                { buffer: 1, byteOffset: 0, byteLength: 64, extensions: { EXT_meshopt_compression: { buffer: 0, byteOffset: 0, byteLength: 32, count: 16, byteStride: 4, mode: 'ATTRIBUTES', filter: 'NONE' } } },
                { buffer: 0, byteOffset: 32, byteLength: local.length },
            ],
        };
        return glb(json, bin);
    };
    const files = { core: make('core', includeCore), a: make('a', true), b: make('b', true) };
    for (const [id, bytes] of Object.entries(files)) await fs.writeFile(path.join(sourceDir, `${id}.glb`), bytes);
    const manifest = { version: 1, core: { url: '/model/stream/core.glb', bytes: files.core.length }, chunks: ['a', 'b'].map(id => ({ id, url: `/model/stream/${id}.glb`, bytes: files[id].length, loadDistance: 20, unloadDistance: 40 })) };
    const manifestPath = path.join(dir, 'public/model/streaming-manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest));
    return { dir, sourceDir, manifestPath, files, manifest, outputDir: path.join(dir, 'public/model/stream-shared') };
}

async function converter() {
    assert.ok(existsSync(script), 'deduplicator implementation is absent');
    return (await import(script.href)).deduplicateStreamGeometry;
}

test('shared exports preserve embedded bytes and fallback while leaving original files untouched', async t => {
    const convert = await converter();
    const f = await fixture(t);
    const result = await convert({ rootDir: f.dir, manifestPath: f.manifestPath, outputDir: f.outputDir, minSharedBytes: 1, minBucketSavings: 1 });
    assert.equal(result.buckets.length, 1);
    assert.equal(result.files.find(x => x.id === 'core').externalRequests, 0);
    assert.equal(result.manifest.core.url, f.manifest.core.url);
    const output = result.manifest.chunks.find(c => c.id === 'a');
    const rewritten = parse(await fs.readFile(path.join(f.dir, 'public', output.url)));
    const original = parse(f.files.a);
    assert.deepEqual(rewritten.json.buffers[1], original.json.buffers[1]);
    const ext = rewritten.json.bufferViews[0].extensions.EXT_meshopt_compression;
    const shared = await fs.readFile(path.resolve(f.outputDir, rewritten.json.buffers[ext.buffer].uri));
    assert.deepEqual(shared.subarray(ext.byteOffset, ext.byteOffset + ext.byteLength), original.bin.subarray(0, 32));
    const v = rewritten.json.bufferViews[1];
    assert.deepEqual(rewritten.bin.subarray(v.byteOffset, v.byteOffset + v.byteLength), original.bin.subarray(32, 39));
    assert.match(rewritten.json.buffers[ext.buffer].uri, /^shared\/[0-9a-f]{64}\.bin$/);
    for (const [id, bytes] of Object.entries(f.files)) assert.deepEqual(await fs.readFile(path.join(f.sourceDir, `${id}.glb`)), bytes);
    assert.deepEqual(JSON.parse(await fs.readFile(f.manifestPath)), f.manifest);
});

test('core-shared geometry stays embedded when core requests are excluded', async t => {
    const convert = await converter();
    const f = await fixture(t, true);
    const result = await convert({ rootDir: f.dir, manifestPath: f.manifestPath, outputDir: f.outputDir, minSharedBytes: 1, minBucketSavings: 1 });
    assert.equal(result.buckets.length, 0);
    assert.ok(result.files.every(file => file.externalRequests === 0));
});

test('converter refuses to overwrite its source directory', async t => {
    const convert = await converter();
    const f = await fixture(t);
    await assert.rejects(convert({ rootDir: f.dir, manifestPath: f.manifestPath, outputDir: f.sourceDir }), /source|overwrite/i);
});

test('an entirely externalized geometry buffer keeps a valid nonempty GLB buffer zero', async t => {
    const convert = await converter();
    const f = await fixture(t);
    for (const id of ['a', 'b']) {
        const source = parse(f.files[id]);
        source.json.bufferViews.pop();
        source.json.buffers[0].byteLength = 32;
        await fs.writeFile(path.join(f.sourceDir, `${id}.glb`), glb(source.json, source.bin.subarray(0, 32)));
    }
    const result = await convert({ rootDir: f.dir, manifestPath: f.manifestPath, outputDir: f.outputDir, minSharedBytes: 1, minBucketSavings: 1 });
    const output = result.manifest.chunks.find(c => c.id === 'a');
    const rewritten = parse(await fs.readFile(path.join(f.dir, 'public', output.url)));
    assert.ok(rewritten.json.buffers[0].byteLength >= 1, 'glTF buffers require a positive byteLength');
});
