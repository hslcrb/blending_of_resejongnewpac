import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const align4 = value => Math.ceil(value / 4) * 4;
const inside = (file, directory) => file === directory || file.startsWith(directory + path.sep);

// GLB 문서와 내장 BIN 읽기 / Read the GLB document and embedded BIN.
function parseGLB(bytes) {
    if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) {
        throw new Error('Invalid GLB 2 header');
    }
    let json;
    let binary;
    for (let offset = 12; offset < bytes.length;) {
        const length = bytes.readUInt32LE(offset);
        const type = bytes.readUInt32LE(offset + 4);
        const data = bytes.subarray(offset + 8, offset + 8 + length);
        if (data.length !== length) throw new Error('Truncated GLB chunk');
        if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
        else if (type === 0x004e4942) binary = data;
        else throw new Error('Refusing to drop an unknown GLB chunk');
        offset += 8 + length;
    }
    if (!json || !binary || json.buffers?.[0]?.uri !== undefined) throw new Error('Expected an embedded buffer 0');
    return { json, binary: binary.subarray(0, json.buffers[0].byteLength) };
}

function writeGLB(json, binary) {
    const encoded = Buffer.from(JSON.stringify(json));
    const jsonChunk = Buffer.alloc(align4(encoded.length), 0x20);
    encoded.copy(jsonChunk);
    const binChunk = Buffer.alloc(align4(binary.length));
    binary.copy(binChunk);
    const output = Buffer.alloc(28 + jsonChunk.length + binChunk.length);
    output.writeUInt32LE(0x46546c67, 0);
    output.writeUInt32LE(2, 4);
    output.writeUInt32LE(output.length, 8);
    output.writeUInt32LE(jsonChunk.length, 12);
    output.writeUInt32LE(0x4e4f534a, 16);
    jsonChunk.copy(output, 20);
    output.writeUInt32LE(binChunk.length, 20 + jsonChunk.length);
    output.writeUInt32LE(0x004e4942, 24 + jsonChunk.length);
    binChunk.copy(output, 28 + jsonChunk.length);
    return output;
}

function sliceChecked(binary, offset, length) {
    if (!Number.isInteger(offset) || !Number.isInteger(length) || offset < 0 || length < 0 || offset + length > binary.length) {
        throw new Error('Buffer reference is outside the embedded BIN');
    }
    return binary.subarray(offset, offset + length);
}

// 같은 사용처 집합의 압축 뷰 묶기 / Bucket only views with identical consuming GLB sets.
export async function deduplicateStreamGeometry(options = {}) {
    const rootDir = path.resolve(options.rootDir || process.cwd());
    const publicDir = path.join(rootDir, 'public');
    const manifestPath = path.resolve(options.manifestPath || path.join(publicDir, 'model/streaming-manifest.json'));
    const outputDir = path.resolve(options.outputDir || path.join(publicDir, 'model/stream-shared'));
    const minSharedBytes = options.minSharedBytes ?? 4096;
    const minBucketSavings = options.minBucketSavings ?? 65536;
    const excludeCore = options.excludeCore ?? true;
    if (!inside(outputDir, publicDir)) throw new Error('Output must stay inside the project public directory');
    const originalManifestBytes = await fs.readFile(manifestPath);
    const manifest = JSON.parse(originalManifestBytes);
    const entries = [{ id: 'core', entry: manifest.core }, ...manifest.chunks.map(entry => ({ id: entry.id, entry }))];
    const sources = [];
    const classes = new Map();
    for (const { id, entry } of entries) {
        const filename = path.resolve(publicDir, entry.url.replace(/^\/+/, ''));
        if (!inside(filename, publicDir)) throw new Error('Source URL escapes public directory');
        const sourceDir = path.dirname(filename);
        if (inside(outputDir, sourceDir) || inside(sourceDir, outputDir)) throw new Error('Refusing to overwrite a source directory');
        const bytes = await fs.readFile(filename);
        const { json, binary } = parseGLB(bytes);
        const source = { id, entry, filename, bytes, json, binary, selected: new Map() };
        sources.push(source);
        for (let index = 0; index < (json.bufferViews?.length || 0); index++) {
            const ext = json.bufferViews[index].extensions?.EXT_meshopt_compression;
            if (!ext) continue;
            if (ext.buffer !== 0) throw new Error('Input meshopt data must be embedded in buffer 0');
            const data = sliceChecked(binary, ext.byteOffset || 0, ext.byteLength);
            const metadata = [ext.count, ext.byteStride, ext.mode, ext.filter || 'NONE'];
            const key = sha(data) + ':' + JSON.stringify(metadata);
            if (!classes.has(key)) classes.set(key, { key, data, metadata, consumers: new Set(), references: [] });
            const record = classes.get(key);
            record.consumers.add(id);
            record.references.push({ source, index });
        }
    }

    const groups = new Map();
    for (const record of classes.values()) {
        if (record.data.length < minSharedBytes || record.consumers.size < 2 || (excludeCore && record.consumers.has('core'))) continue;
        const consumers = [...record.consumers].sort();
        const signature = JSON.stringify(consumers);
        if (!groups.has(signature)) groups.set(signature, { consumers, classes: [] });
        groups.get(signature).classes.push(record);
    }
    await fs.mkdir(path.join(outputDir, 'shared'), { recursive: true });
    const publicPrefix = '/' + path.relative(publicDir, outputDir).split(path.sep).join('/');
    const buckets = [];
    for (const group of groups.values()) {
        const savings = group.classes.reduce((sum, record) => sum + record.data.length * (record.consumers.size - 1), 0);
        if (savings < minBucketSavings) continue;
        const pieces = [];
        let size = 0;
        for (const record of group.classes.sort((a, b) => a.key.localeCompare(b.key))) {
            const aligned = align4(size);
            if (aligned !== size) pieces.push(Buffer.alloc(aligned - size));
            record.offset = aligned;
            pieces.push(record.data);
            size = aligned + record.data.length;
        }
        const bytes = Buffer.concat(pieces);
        const hash = sha(bytes);
        const uri = `shared/${hash}.bin`;
        const filename = path.join(outputDir, uri);
        await fs.writeFile(filename, bytes);
        const bucket = { uri, url: `${publicPrefix}/${uri}`, sha256: hash, bytes: bytes.length, consumers: group.consumers, views: group.classes.length, estimatedRepeatedBytesRemoved: savings, paddingBytes: bytes.length - group.classes.reduce((n, record) => n + record.data.length, 0) };
        buckets.push(bucket);
        for (const record of group.classes) {
            for (const reference of record.references) reference.source.selected.set(reference.index, { bucket, offset: record.offset });
        }
    }

    // 원본과 fallback buffer 인덱스 보존 / Preserve source files and the existing virtual fallback buffer indices.
    const files = [];
    for (const source of sources) {
        if (!source.selected.size) {
            files.push({ id: source.id, url: source.entry.url, sourceUrl: source.entry.url, optimized: false, sourceBytes: source.bytes.length, bytes: source.bytes.length, sha256: sha(source.bytes), externalRequests: 0 });
            continue;
        }
        const json = structuredClone(source.json);
        const externalBuffers = new Map();
        const embeddedRanges = new Map();
        const pieces = [];
        let size = 0;
        const retain = (offset, length) => {
            const key = `${offset}:${length}`;
            if (embeddedRanges.has(key)) return embeddedRanges.get(key);
            const aligned = align4(size);
            if (aligned !== size) pieces.push(Buffer.alloc(aligned - size));
            pieces.push(sliceChecked(source.binary, offset, length));
            embeddedRanges.set(key, aligned);
            size = aligned + length;
            return aligned;
        };
        for (let index = 0; index < json.bufferViews.length; index++) {
            const view = json.bufferViews[index];
            const ext = view.extensions?.EXT_meshopt_compression;
            const selected = source.selected.get(index);
            if (selected) {
                const { bucket, offset } = selected;
                if (!externalBuffers.has(bucket.uri)) {
                    externalBuffers.set(bucket.uri, json.buffers.length);
                    json.buffers.push({ uri: bucket.uri, byteLength: bucket.bytes });
                }
                ext.buffer = externalBuffers.get(bucket.uri);
                ext.byteOffset = offset;
            } else if (ext) {
                ext.byteOffset = retain(ext.byteOffset || 0, ext.byteLength);
            } else if (view.buffer === 0) {
                view.byteOffset = retain(view.byteOffset || 0, view.byteLength);
            } else {
                throw new Error('Unexpected non-meshopt reference to a virtual/external input buffer');
            }
        }
        const binary = pieces.length ? Buffer.concat(pieces) : Buffer.alloc(4);
        json.buffers[0].byteLength = binary.length;
        const output = writeGLB(json, binary);
        const basename = path.basename(source.filename);
        await fs.writeFile(path.join(outputDir, basename), output);
        source.entry.url = `${publicPrefix}/${basename}`;
        source.entry.bytes = output.length;
        files.push({ id: source.id, url: source.entry.url, sourceUrl: '/' + path.relative(publicDir, source.filename).split(path.sep).join('/'), optimized: true, sourceBytes: source.bytes.length, bytes: output.length, sha256: sha(output), externalRequests: externalBuffers.size, buckets: [...externalBuffers.keys()] });
    }
    manifest.revision = `${manifest.revision || 'stream'}-shared-v1`;
    const originalTotalBytes = sources.reduce((sum, source) => sum + source.bytes.length, 0);
    const outputGlbBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    const sharedBytes = buckets.reduce((sum, bucket) => sum + bucket.bytes, 0);
    const report = { version: 1, mode: 'identical-consumer-set buckets', minSharedBytes, minBucketSavings, excludeCore, originalManifestSha256: sha(originalManifestBytes), originalTotalBytes, outputGlbBytes, sharedBytes, totalUniquePayloadBytes: outputGlbBytes + sharedBytes, savedBytes: originalTotalBytes - outputGlbBytes - sharedBytes, maxAdditionalRequestsPerGLB: Math.max(0, ...files.map(file => file.externalRequests)), overfetchBytesExcludingAlignment: 0, buckets, files };
    const sourceSnapshot = path.join(outputDir, 'source-streaming-manifest.json');
    if (manifestPath !== sourceSnapshot) await fs.writeFile(sourceSnapshot, originalManifestBytes);
    await fs.writeFile(path.join(outputDir, 'streaming-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await fs.writeFile(path.join(outputDir, 'deduplication-report.json'), JSON.stringify(report, null, 2) + '\n');
    return { ...report, manifest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const options = {};
    for (let i = 2; i < process.argv.length; i++) {
        const flag = process.argv[i];
        if (flag === '--manifest') options.manifestPath = process.argv[++i];
        else if (flag === '--output') options.outputDir = process.argv[++i];
        else throw new Error(`Unknown argument: ${flag}`);
        if (process.argv[i] === undefined) throw new Error(`Missing value for ${flag}`);
    }
    const result = await deduplicateStreamGeometry(options);
    console.log(JSON.stringify({ buckets: result.buckets.length, rewrittenGLBs: result.files.filter(f => f.optimized).length, originalTotalBytes: result.originalTotalBytes, totalUniquePayloadBytes: result.totalUniquePayloadBytes, savedBytes: result.savedBytes, core: result.files.find(f => f.id === 'core'), maxAdditionalRequestsPerGLB: result.maxAdditionalRequestsPerGLB }, null, 2));
}
