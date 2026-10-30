import test from 'node:test';
import assert from 'node:assert/strict';
import { rearGroundHeight } from '../src/rearGround.js';

test('rear stairs rise evenly from the garden to the landing', () => {
    assert.equal(rearGroundHeight(10, -119.4), 3.6525 / 24);
    assert.equal(rearGroundHeight(10, -110.43), 3.6525);
    assert.equal(rearGroundHeight(10, -105), 3.6525);
    assert.equal(rearGroundHeight(0, -115), null);
    assert.equal(rearGroundHeight(10, -120), null);
});
