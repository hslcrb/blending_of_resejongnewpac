import test from 'node:test';
import assert from 'node:assert/strict';
import { walkKeyForEvent } from '../src/walkKeys.js';

test('physical WASD keys navigate regardless of the active keyboard layout', () => {
    for (const [code, korean, expected] of [
        ['KeyW', 'ㅈ', 'w'],
        ['KeyA', 'ㅁ', 'a'],
        ['KeyS', 'ㄴ', 's'],
        ['KeyD', 'ㅇ', 'd'],
    ]) {
        assert.equal(walkKeyForEvent({ code, key: korean }), expected);
        assert.equal(walkKeyForEvent({ code, key: 'Process' }), expected);
        assert.equal(walkKeyForEvent({ code, key: expected.toUpperCase() }), expected);
    }
});

test('arrows, either Shift key, and events without a physical code remain usable', () => {
    assert.equal(walkKeyForEvent({ code: 'ArrowUp', key: 'ArrowUp' }), 'arrowup');
    assert.equal(walkKeyForEvent({ code: 'ArrowLeft', key: 'ArrowLeft' }), 'arrowleft');
    assert.equal(walkKeyForEvent({ code: 'ShiftLeft', key: 'Shift' }), 'shift');
    assert.equal(walkKeyForEvent({ code: 'ShiftRight', key: 'Shift' }), 'shift');
    assert.equal(walkKeyForEvent({ key: 'W' }), 'w');
    assert.equal(walkKeyForEvent({ code: 'KeyQ', key: 'q' }), '');
});
