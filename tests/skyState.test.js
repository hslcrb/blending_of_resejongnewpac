import test from 'node:test';
import assert from 'node:assert/strict';
import { seoulSolarPosition, sunDirection, cloudFractionFromMetar } from '../src/skyState.js';

test('서울 낮과 밤의 태양 고도가 다르고 회관 북쪽 축을 따른다', () => {
  const noon = seoulSolarPosition(new Date('2026-06-21T03:00:00Z'));
  const midnight = seoulSolarPosition(new Date('2026-06-20T15:00:00Z'));
  assert.ok(noon.elevation > 1.1 && noon.elevation < 1.4);
  assert.ok(midnight.elevation < 0);
  const north = sunDirection({azimuth:0,elevation:0});
  assert.ok(north.x > 0.999 && Math.abs(north.z) < 1e-9);
});

test('김포공항 관측의 구름 상태를 사용하고 누락된 보고는 알 수 없음으로 둔다', () => {
  assert.equal(cloudFractionFromMetar({cover:'CAVOK',clouds:[]}), 0);
  assert.equal(cloudFractionFromMetar({clouds:[{cover:'FEW'},{cover:'BKN'}]}), 0.75);
  assert.equal(cloudFractionFromMetar({clouds:[{cover:'OVC'}]}), 1);
  assert.equal(cloudFractionFromMetar({clouds:[]}), null);
  assert.equal(cloudFractionFromMetar(null), null);
});
