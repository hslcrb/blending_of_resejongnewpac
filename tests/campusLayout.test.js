import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setCampusLayout } from '../src/campusLayout.js';
import { canWalk } from '../src/walkCollision.js';

const layout = JSON.parse(readFileSync(new URL('../public/model/campus-layout.json', import.meta.url), 'utf8'));

test('all seven exported curved planting islands are solid while paths and curved outside corners remain walkable', () => {
    setCampusLayout(layout);
    try {
        assert.equal(layout.westGarden.beds.length, 7);
        for (const bed of layout.westGarden.beds) {
            const [x, z] = bed.points.reduce((sum, point) => [sum[0] + point[0] / bed.points.length, sum[1] + point[1] / bed.points.length], [0, 0]);
            assert.equal(canWalk(x, z, true), false, bed.id);
            assert.equal(canWalk(x, z, false), true, `legacy has no new bed: ${bed.id}`);
        }
        for (const [x, z] of [[-56, -65], [-60.4, -82], [-54, -92], [-54, -104], [-75, -57.3]]) {
            assert.equal(canWalk(x, z, true), true, `curving path at ${x},${z}`);
        }
    } finally { setCampusLayout(null); }
});

test('walker clearance follows the actual curved edge rather than only the planting bounding box', () => {
    setCampusLayout({ version: 1, westGarden: { beds: [{ points: [[-60, -60], [-50, -60], [-60, -70]] }] } });
    try {
        assert.equal(canWalk(-55, -65, true), false, 'sloped edge is solid');
        assert.equal(canWalk(-54.9, -64.9, true), false, 'radius keeps feet clear of the curb');
        assert.equal(canWalk(-53, -67, true), true, 'outside triangular corner is passable');
    } finally { setCampusLayout(null); }
});
