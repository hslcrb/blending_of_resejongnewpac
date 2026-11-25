import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canWalk } from '../src/walkCollision.js';

const read = (name) => readFile(new URL('../'+name, import.meta.url));
test('Garden chunk is versioned independently and uses the field order', async () => {
    const manifest = JSON.parse(await read('public/model/streaming-manifest.json'));
    const garden = manifest.chunks.find(c => c.id === 'gratitude-garden');
    assert.match(garden.url, /gratitude-plaza\.glb$/);
    const data = JSON.parse(await read('src/gratitudeGardenLayout.json'));
    assert.equal(data.countries.length,23);
    assert.deepEqual(data.countries.slice(0,4).map(x=>x[0]),['us','au','gb','nl']);
    assert.deepEqual(data.countries.slice(7,9).map(x=>x[0]),['se','ph']);
    assert.equal(data.countries.at(-1)[0],'kr');
    const bytes=await read('public'+garden.url);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),garden.sha256);
});
test('Garden stone bases are impassable but adjacent aisles remain open', () => {
    assert.equal(canWalk(63.40,75.8,true),false);
    assert.equal(canWalk(64,75.8,true),true);
    assert.equal(canWalk(63.4,77.1,true),true);
});
