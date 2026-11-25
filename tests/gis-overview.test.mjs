import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const base = resolve('public/gis');
const manifest = JSON.parse(readFileSync(resolve(base, 'manifest.json'), 'utf8'));
const load = name => JSON.parse(gunzipSync(readFileSync(resolve(base, name))));
const digest = name => createHash('sha256').update(readFileSync(resolve(base, name))).digest('hex');

function ringContains(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
function polygonContains(polygon, x, y) {
    return ringContains(polygon[0], x, y) && !polygon.slice(1).some(ring => ringContains(ring, x, y));
}
function geometryContains(geometry, x, y) {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons.some(polygon => polygonContains(polygon, x, y));
}
function coordinates(value, check) {
    if (typeof value[0] === 'number') return check(value);
    for (const child of value) coordinates(child, check);
}

test('백지도 내보내기는 압축 해시와 모든 시도·시군구 도형을 보존한다', () => {
    assert.equal(manifest.crs, 'EPSG:5186');
    const name = 'national-admin.json.gz', data = load(name), asset = manifest.assets[name];
    assert.equal(digest(name), asset.sha256);
    assert.equal(data.crs.properties.name, manifest.crs);
    assert.equal(data.features.length, 3206);
    assert.equal(data.features.filter(f => f.properties.layer === '시도_백지도').length, 30);
    assert.equal(data.features.filter(f => f.properties.layer === '시군구_백지도_').length, 3176);
    assert.ok(data.features.every(f => !('path' in f.properties.fields)), '개인 로컬 원본 경로는 공개하지 않는다');
    const seoul = data.features.find(f => f.properties.layer === '시도_백지도' && f.properties.fields.MNG_NAM === '서울특별시');
    assert.ok(seoul && geometryContains(seoul.geometry, 197897, 552531), '변환한 서울 경계에 회관 위치가 들어간다');
});

test('서울 지면 선은 한정된 범위, 원본 레이어, 유효 좌표와 필드를 보존한다', () => {
    const name = 'seoul-ground.json.gz', data = load(name), asset = manifest.assets[name];
    assert.equal(digest(name), asset.sha256);
    assert.equal(data.crs.properties.name, 'EPSG:5186');
    assert.ok(asset.compressedBytes < 20 * 1024 * 1024);
    assert.equal(data.features.length, Object.values(asset.layers).reduce((a, b) => a + b, 0));
    assert.ok(asset.layers['행정경계'] > 0 && asset.layers['실폭하천'] > 0 && asset.layers['일반국도'] > 0);
    const ids = new Set();
    for (const f of data.features) {
        assert.ok(!ids.has(f.id), `duplicate: ${f.id}`); ids.add(f.id);
        assert.ok(['LineString', 'MultiLineString'].includes(f.geometry.type));
        assert.equal(typeof f.properties.fid, 'number');
        assert.equal(typeof f.properties.fields, 'object');
        coordinates(f.geometry.coordinates, ([e, n]) => {
            assert.ok(Number.isFinite(e) && Number.isFinite(n));
            assert.ok(e >= 175000 && e <= 225000 && n >= 525000 && n <= 575000, `${e}, ${n}`);
        });
    }
});
