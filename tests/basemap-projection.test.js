import test from 'node:test';
import assert from 'node:assert/strict';
import { latLonTo5186, grid5186ToLatLon, geoToWorld, worldToGeo, lonLatToTile, tileToLonLat } from '../src/mapProjection.js';

test('EPSG:5186 converts known QGIS coordinates and preserves local and Seoul axes', () => {
    const expected = [
        [197897,552531,126.97619427450437,37.572319804958916],
        [200000,600000,127,38],
        [220000,530000,127.22578553429288,37.36910000246007],
        [389076.8035813294,288993.75599273696,129.0756,35.1796], // 부산
        [156437.51964552596,100758.48149363999,126.5312,33.4996], // 제주
        [186570.2815992431,284800.08501414314,126.8526,35.1595], // 광주
        [631946.2645831318,527009.3225898705,131.8666,37.2422], // 독도
        [480381.33303666255,1083064.0316850508,130.4,42.3], // 북부
        [91760.93912744592,715080.0263362041,125.75,39.03], // 평양
    ];
    for (const [e,n,lon,lat] of expected) {
        const ll=grid5186ToLatLon(e,n);
        assert.ok(Math.abs(ll.lon-lon)<0.000002 && Math.abs(ll.lat-lat)<0.000002);
        const grid=latLonTo5186(lon,lat);
        assert.ok(Math.hypot(grid.easting-e,grid.northing-n)<0.2);
        for (const mode of ['local','seoul']) {
            const world=geoToWorld(mode,e,n), actual=worldToGeo(mode,world.x,world.z);
            assert.equal(actual.easting,e); assert.equal(actual.northing,n);
        }
    }
    assert.deepEqual(geoToWorld('local',197897,552531),{x:0,z:0});
    assert.deepEqual(geoToWorld('seoul',197897,552531),{x:-2103,z:-2531});
});

test('WMTS XYZ tile math places Sejong in 13/6985/3172 and reverses corners', () => {
    const tile=lonLatToTile(126.9761942745,37.572319805,13);
    assert.equal(Math.floor(tile.x),6985);assert.equal(Math.floor(tile.y),3172);
    const ll=tileToLonLat(tile.x,tile.y,13);
    assert.ok(Math.abs(ll.lon-126.9761942745)<1e-9 && Math.abs(ll.lat-37.572319805)<1e-9);
});
