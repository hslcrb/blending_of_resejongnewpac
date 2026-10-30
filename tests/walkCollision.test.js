import test from 'node:test';
import assert from 'node:assert/strict';
import { canWalk } from '../src/walkCollision.js';

test('the walker cannot enter the lobby counters and benches', () => {
    // These are the furniture centers in the exported GLB's x/z coordinates.
    for (const [x, z] of [[17, -7.7], [48, -7.7], [7, -3.6], [57, -3.6]]) {
        assert.equal(canWalk(x, z), false, `furniture at ${x}, ${z}`);
    }
});

test('a walking step stops at a counter rather than passing through it', () => {
    let x = 25;
    for (let i = 0; i < 70; i += 1) {
        if (canWalk(x - 0.2, -7.7)) x -= 0.2;
    }
    assert.ok(x >= 20.4 && x < 20.6, `stopped at x=${x}`);
});

test('the main entrance and circulation aisle stay accessible', () => {
    for (const [x, z] of [[12.78, 3.1], [22.95, 3.1], [33.1, 3.1], [43.27, 3.1], [53.43, 3.1],
        [33.1, 0], [33.1, -7.7], [12, -3.6], [62, -3.6]]) {
        assert.equal(canWalk(x, z), true, `walkway at ${x}, ${z}`);
    }
});

test('the extended forecourt is walkable without crossing its front edge', () => {
    assert.equal(canWalk(33.1, 55), true);
    assert.equal(canWalk(33.1, 77.9), true);
    assert.equal(canWalk(33.1, 78.1), false);
});

test('the enlarged front gardens stay protected while the central approach remains open', () => {
    assert.equal(canWalk(14, 33), false);
    assert.equal(canWalk(58, 33), false);
    assert.equal(canWalk(-61, 35), false);
    assert.equal(canWalk(33, 33), true);
});

test('rear garden paths stay open while planted islands and the edge are blocked', () => {
    assert.equal(canWalk(8, -132), true);
    assert.equal(canWalk(0, -142), true);
    assert.equal(canWalk(0, -132), false);
    assert.equal(canWalk(0, -151), false);
    assert.equal(canWalk(8, -167), false);
});

test('the rear wing colonnade stays open between pillars and stops at the wall', () => {
    assert.equal(canWalk(-15, -108.5), true);
    assert.equal(canWalk(-19.12, -108.5), false);
    assert.equal(canWalk(-15, -102.8), false);
    assert.equal(canWalk(2, -105), true);
    assert.equal(canWalk(3.5, -115), false, 'rear stair side wall');
    assert.equal(canWalk(10, -115), true, 'rear stair treads');
});

test('the lobby back wall keeps the eye clear of the camera near plane', () => {
    // The auditorium front is at z=-11.4; leave room for the camera.
    assert.equal(canWalk(33.1, -11.2), false);
    assert.equal(canWalk(33.1, -10.9), true);
    let z = -10;
    for (let i = 0; i < 20; i += 1) {
        if (canWalk(33.1, z - 0.2)) z -= 0.2;
    }
    assert.ok(z > -11.1, `stopped at z=${z}`);
});

test('the long side garden is blocked while the outside path stays open', () => {
    // Blender y=7..83 maps to negative z in the web viewer.
    for (const z of [-8, -37, -44, -56, -69, -79, -83]) {
        assert.equal(canWalk(76, z), false, `garden at z=${z}`);
        assert.equal(canWalk(79.5, z), true, `outer path at z=${z}`);
    }
    assert.equal(canWalk(76, -84), true, 'beyond the rear edge');
});
