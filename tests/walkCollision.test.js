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
