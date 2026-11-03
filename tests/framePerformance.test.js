import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlowFrameDetector } from '../src/framePerformance.js';

test('a sustained 20fps view requests lower resolution after warmup and sampling', () => {
    const detector = createSlowFrameDetector(); let slow = false;
    for (let time = 0; time <= 8000; time += 50) slow ||= detector.sample(time);
    assert.equal(slow, true);
});

test('ten seconds offscreen do not make a healthy 60fps view lower its resolution', () => {
    const detector = createSlowFrameDetector(); let slow = false;
    for (let time = 0; time < 5000; time += 1000 / 60) slow ||= detector.sample(time);
    detector.sample(5000, false);
    for (let time = 15000; time < 23500; time += 1000 / 60) slow ||= detector.sample(time);
    assert.equal(slow, false);
});
