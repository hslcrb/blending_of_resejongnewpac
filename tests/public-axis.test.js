import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { canWalk } from '../src/walkCollision.js';
import { surroundingsGroundHeight } from '../src/surroundingsGround.js';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
test('remains at old terrain when the S Theatre patch is not active', () => {
    assert.equal(surroundingsGroundHeight(33, -117), 0.23);
    assert.equal(canWalk(29.4, -121.9, true), false);
});
test('a loaded S Theatre uses the new door and descending public stair, with side rails', () => {
    const layout = { theatre: true };
    assert.equal(canWalk(36.5, -121.15, true, layout), true);
    assert.equal(canWalk(28.9, -121.15, true, layout), false);
    assert.equal(canWalk(35.25, -116, true, layout), false);
    assert.ok(surroundingsGroundHeight(32.4, -118, layout) > surroundingsGroundHeight(32.4, -114, layout));
    assert.equal(surroundingsGroundHeight(32.4, -113, layout), -3.16);
});
test('the north extension is walkable only when loaded and stays in the crossing and forecourt', () => {
    assert.equal(canWalk(317, 73, true), false);
    assert.equal(canWalk(317, 73, true, { north: true }), true);
    assert.equal(canWalk(350, 104, true, { north: true }), false);
    assert.equal(canWalk(420, 73, true, { north: true }), false);
});
test('the district manifest keeps the old core and declares the new north and gratitude assets', () => {
    const manifest = read('../public/model/streaming-manifest.json');
    assert.match(manifest.core.url, /20261105-unified-core/);
    for (const name of ['gratitude-garden', 'gwanghwamun-north-axis']) {
        const chunk = manifest.chunks.find((entry) => entry.id === name);
        assert.ok(chunk?.url.includes('public-axis-20261125/'));
        const asset = readFileSync(new URL('../public' + chunk.url, import.meta.url));
        assert.equal(asset.readUInt32LE(0), 0x46546c67);
        assert.equal(asset.length, chunk.bytes);
    }
});

import { createHash } from 'node:crypto';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { hideOldPavilionInterior, installSTheatrePatch, publicAxisWalkStart } from '../src/publicAxis.js';
import { geoToWorld, latLonTo5186 } from '../src/mapProjection.js';

const manifest = read('../public/model/streaming-manifest.json');
test('binary assets match manifest hashes, required named meshes and site coordinate reference', () => {
    for (const entry of [manifest.sTheatrePatch,...manifest.chunks.filter(c=>c.url.includes('/public-axis-20261125/'))]) {
        const buf = readFileSync(new URL('../public'+entry.url,import.meta.url));
        assert.equal(createHash('sha256').update(buf).digest('hex'),entry.sha256);
        const json = JSON.parse(buf.toString('utf8',20,20+buf.readUInt32LE(12)));
        assert.ok(json.images.length>=1,'authored texture maps are embedded');
        if(entry.id==='gratitude-garden') {
            assert.equal(new Set(json.nodes.filter(o=>o.name?.startsWith('Gratitude Light')).map(o=>o.name.split(' / ')[0])).size,23);
            assert.ok(json.nodes.some(o=>o.name==='Watercourse pedestrian bridge at crossing'));
        }
        if (entry.id==='gwanghwamun-north-axis') {
            const ref = latLonTo5186(126.977019,37.576044);
            const gate = geoToWorld('local',ref.easting,ref.northing);
            assert.ok(entry.bounds.min[0] < gate.x && gate.x < entry.bounds.max[0]);
            assert.ok(entry.bounds.min[2] < gate.z && gate.z < entry.bounds.max[2]);
        }
    }
});

test('missing mesh validation leaves the original geometry active', () => {
    const base=new Group();
    const names=manifest.sTheatrePatch.hideFromCore;
    for(const name of names) {
        const m=new Mesh(new BoxGeometry(),new MeshBasicMaterial());m.userData.name=name;base.add(m);
    }
    const correction=new Group();
    const append=(name)=>{const mesh=new Mesh(new BoxGeometry(),new MeshBasicMaterial());mesh.userData.name=name;correction.add(mesh);};
    append('Axis ground replacement / ground');
    assert.throws(()=>installSTheatrePatch(base,correction,names),/Incomplete stairs/);
    assert.ok(base.children.every(o=>o.visible));
    append('Axis ground replacement / plaza');
    for(let i=0;i<10;i++)append('Public axis '+i);
    installSTheatrePatch(base,correction,names);
    assert.ok(base.children.slice(0,-1).every(o=>!o.visible));
    assert.equal(base.children.at(-1),correction);
});


test('a location starts walking only when its terrain is available, on the public side of the glass', () => {
    assert.equal(publicAxisWalkStart('s-theatre',{}),null);
    assert.equal(publicAxisWalkStart('north-axis',{theatre:true}),null);
    for (const name of ['s-theatre','north-axis']) {
        const layout={theatre:true,north:true};
        const at=publicAxisWalkStart(name,layout);
        assert.ok(canWalk(at.x,at.z,true,layout));
        assert.equal(at.yaw,name==='s-theatre'?Math.PI/2:-Math.PI/2);
    }
});
test('only obsolete interior is retired inside the rear garden chunk', () => {
    const chunk=new Group();
    const stale=new Group();stale.userData.name='DAY pavilion temporary original art board';
    const garden=new Group();garden.userData.name='DAY perennial garden';
    chunk.add(stale,garden);hideOldPavilionInterior(chunk);
    assert.equal(stale.visible,false);assert.equal(garden.visible,true);
});

test('the pavilion GLB keeps the existing stone base and carries both new tier meshes', () => {
    const entry=manifest.chunks.find(c=>c.id==='gwanghwamun-north-axis');
    const evidence=read('../public/model/public-axis-20261125/gwanghwamun-pavilion-evidence.json');
    const previous=read('../public/model/public-axis-20261125/field-evidence.json').north;
    const json=readGlbMetadata(entry.url);
    const old=readGlbMetadata(previous.url);
    for (const key of ['url','sha256','bytes','objects','bounds']) assert.deepEqual(entry[key],evidence[key]);
    assert.equal(json.nodes.length,evidence.objects);
    const names=json.nodes.map(n=>n.name||'');
    for(const prefix of ['Lower pavilion / four continuous','Upper pavilion / four continuous',
        'Lower pavilion / posts','Upper pavilion / posts','Pavilion plinth','Upper / black plaque']) {
        assert.ok(names.some(n=>n.startsWith(prefix)),prefix);
    }
    const preserved=old.nodes.filter(n=>n.name?.startsWith('Gwanghwamun / three vaulted')||
        n.name?.startsWith('Gwanghwamun / Woldae stair')||
        n.name?.startsWith('Gwanghwamun / northern square'));
    assert.ok(preserved.length>0);
    assert.ok(preserved.every(n=>names.includes(n.name)));
    assert.equal(names.filter(n=>n.startsWith('Plaque gilt ')).length,3);
    assert.ok(!names.some(n=>n.includes('two timber halls')));
    assert.equal(entry.bounds.max[2],previous.bounds.max[2]);
    assert.ok(entry.bytes<1_500_000,'detailed streamed GLB budget');
});

function readGlbMetadata(url) {
    const buf=readFileSync(new URL('../public'+url,import.meta.url));
    return JSON.parse(buf.toString('utf8',20,20+buf.readUInt32LE(12)));
}
