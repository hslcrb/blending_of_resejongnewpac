import test from 'node:test';
import assert from 'node:assert/strict';
import { canWalk } from '../src/walkCollision.js';
import { surroundingsGroundHeight } from '../src/surroundingsGround.js';

test('expanded plaza and alley connect to the existing forecourt only for the expanded model', () => {
    assert.equal(canWalk(33, 90, true), true);
    assert.equal(canWalk(-85, 25, true), true);
    assert.equal(canWalk(33, 90), false, 'legacy model keeps its original bounds');
});

test('sunken plaza stairs connect the upper plaza to the lower floor without a height jump', () => {
    let last = 0;
    for (let z = 93.7; z <= 104; z += 0.05) {
        assert.equal(canWalk(-52.5, z, true), true, `stair access at ${z}`);
        const height = surroundingsGroundHeight(-52.5, z) ?? 0;
        assert.ok(height <= last + 1e-8 && last - height <= 0.1625 + 1e-8, `height at ${z}: ${height}`);
        last = height;
    }
    assert.equal(last, -3.25);
    assert.equal(canWalk(-30, 94, true), false, 'edge prevents a fall');
    assert.equal(canWalk(-52.5, 103.5, true), true, 'lower level accessible');
});

test('the ramp connects its upper landing and lower floor while keeping side rails solid', () => {
    for (let z = 93.8; z <= 99; z += 0.05) {
        assert.equal(canWalk(-44, z, true), true, `landing entry at ${z}`);
        assert.ok((surroundingsGroundHeight(-44, z) ?? 0) >= -0.1, `landing height at ${z}`);
    }
    let last = surroundingsGroundHeight(-44, 99);
    for (let x = -43.9; x <= -4.8; x += 0.1) {
        assert.equal(canWalk(x, 99, true), true, `ramp at ${x}`);
        const height = surroundingsGroundHeight(x, 99);
        assert.ok(height <= last + 1e-8 && last - height < 0.02, `ramp height at ${x}`);
        last = height;
    }
    assert.equal(last, -3.25);
    assert.equal(canWalk(-30, 98, true), false, 'upper ramp rail');
    assert.equal(canWalk(-30, 101, true), false, 'lower ramp rail');
});

test('Freedom Hall steps descend through the entrance and stop at the closed end', () => {
    let last = 0;
    for (let x = 109.7; x <= 120.5; x += 0.05) {
        assert.equal(canWalk(x, 63.5, true), true, `stair access at ${x}`);
        const height = surroundingsGroundHeight(x, 63.5) ?? 0;
        assert.ok(height <= last + 1e-8 && last - height <= 0.1625 + 1e-8, `height at ${x}: ${height}`);
        last = height;
    }
    assert.equal(last, -3.25);
    assert.equal(canWalk(110, 59, true), false, 'guarded side edge');
    assert.equal(canWalk(121.7, 63.5, true), false, 'closed portal');
});

test('individual monument columns and street crossings preserve open circulation', () => {
    assert.equal(canWalk(63, 72, true), false);
    assert.equal(canWalk(64, 72, true), true);
    assert.equal(canWalk(-135, 140, true), true);
    assert.equal(canWalk(155, 140, true), true);
    assert.equal(canWalk(0, 140, true), false);
    assert.equal(canWalk(0, 155, true), true);
});

test('the pavilion entrance opens to its raised floor while adjacent glass stays solid', () => {
    for (let x = 28.8; x <= 31.3; x += 0.1) {
        assert.equal(canWalk(x, -120.05, true), true, `entrance at ${x}`);
    }
    assert.equal(canWalk(29.4, -118.4, true), false);
    assert.equal(canWalk(32, -110.8, true), false);
    assert.equal(surroundingsGroundHeight(30, -120.05), 0.23);
    assert.equal(canWalk(31, -116), false, 'original pavilion remains blocked');
});

test('the history watercourse is blocked except at its modeled bridge and can be bypassed at its end', () => {
    assert.equal(canWalk(80, 116, true), false, 'water channel');
    assert.equal(canWalk(155, 116, true), true, 'bridge across the channel');
    assert.equal(canWalk(24, 116, true), true, 'path around channel end');
    assert.equal(canWalk(80, 114, true), true, 'near side of channel');
    assert.equal(canWalk(80, 118, true), true, 'far side of channel');
});

test('southern storefront fronts and side walls stop walkers while entry framing remains accessible', () => {
    assert.equal(canWalk(-118, 0, true), false, 'photo 048 front');
    assert.equal(canWalk(-123, -7, true), false, 'photo 048 side');
    assert.equal(canWalk(-118, 12, true), true, 'photo 048 recessed entrance');
    assert.equal(canWalk(-94, -20, true), false, 'photo 075 front');
    assert.equal(canWalk(-100, -11, true), false, 'photo 075 side');
    assert.equal(canWalk(-94, -14.4, true), true, 'photo 075 entrance');
    assert.equal(canWalk(-94, -30, true), true, 'neighbor entry frame');
    assert.equal(canWalk(-92, -20, true), true, 'public path remains open');
});
