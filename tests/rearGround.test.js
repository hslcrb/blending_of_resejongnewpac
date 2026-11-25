import test from 'node:test';
import assert from 'node:assert/strict';
import { rearGroundHeight } from '../src/rearGround.js';

const rise = 3.65 / 24;

test('the rear stair climbs along x and includes the wider middle landing', () => {
    for (const [x, expected] of [
        [21.45, rise], [19.55, 6 * rise], [17.65, 11 * rise],
        [17.30, 12 * rise], [16.70, 12 * rise],
        [16.37, 13 * rise], [14.47, 18 * rise], [12.19, 24 * rise],
    ]) {
        assert.ok(Math.abs(rearGroundHeight(x, -112) - expected) < 1e-8, `height at x=${x}`);
    }
    assert.equal(rearGroundHeight(11.6, -112), 3.65, 'top landing');
    assert.equal(rearGroundHeight(11.6, -105), 3.65, 'existing upper landing');
});

test('the removed wide stair no longer creates a raised floor in the garden', () => {
    for (const [x, z] of [[10, -115], [21.5, -115], [22, -112], [11, -112], [16, -114.1]]) {
        assert.equal(rearGroundHeight(x, z), null, `ground at ${x}, ${z}`);
    }
});
