import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Texture } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { extractSurveyGeometry } from '../src/surveyGeometry.js';

const assets = new URL('../public/model/survey-20261115/', import.meta.url);
test('survey foot finish reaches Three COLOR_0 with the existing stone texture', async () => {
    const data = await readFile(new URL('colonnade-geometry.glb', assets));
    const manifest = JSON.parse(await readFile(new URL('colonnade-replacements.json', assets)));
    const loader = new GLTFLoader().register(() => ({
        name: 'TEST_HEADLESS_TEXTURE', loadTexture: () => Promise.resolve(new Texture())
    }));
    const gltf = await loader.parseAsync(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength), '');
    const patch = extractSurveyGeometry(gltf, manifest);
    const stone = patch.root.children.find(o => (o.userData.name || o.name) === 'stone');
    assert.equal(patch.root.children.length, 4);
    assert.ok(stone?.isMesh && stone.material.map?.isTexture && stone.material.vertexColors);
    const tint = stone.geometry.getAttribute('color');
    const points = stone.geometry.getAttribute('position');
    const centres = Array.from({length: 7}, (_, i) => -27.4434261322 + i * 8.3280639648);
    const affected = new Set();
    let count = 0;
    for (let i = 0; i < tint.count; i++) {
        if ([tint.getX(i), tint.getY(i), tint.getZ(i)].every(channel => channel >= .99998)) continue;
        const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
        const column = centres.findIndex(cx => Math.abs(x - cx) <= .721);
        assert.ok(column >= 0 && Math.abs(z + 108.6733322144) <= .966 && y >= -.001 && y <= 1.081);
        affected.add(column);
        count++;
    }
    assert.equal(affected.size, 7);
    assert.equal(count, 592);
});
