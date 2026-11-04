import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {regionCodeFromBuilding} from '../src/geographyView.js';

function inRing(ring,x,y){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
 const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
}return inside;}
function contains(geometry,x,y){const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
 return polygons.some(p=>p.length&&inRing(p[0],x,y)&&!p.slice(1).some(r=>inRing(r,x,y)));}
test('전국 변경 후보의 서울 코드와 서울 자치구 도형 위치가 일치한다',()=>{
 const districts=JSON.parse(gunzipSync(readFileSync('public/gis/admin-dong/seoul-districts.geojson.gz'))).features;
 const candidates=JSON.parse(readFileSync('public/data/national-cultural-changes.geojson','utf8')).features;
 let checked=0;
 for(const f of candidates){if(!f.geometry)continue;const [x,y]=f.geometry.coordinates;const actual=districts.some(d=>contains(d.geometry,x,y));const code=regionCodeFromBuilding(f.properties.fields.A30);if(!code)continue;assert.equal(code==='11',actual,`원본 ${f.id}`);checked++;}
 assert.ok(checked>300);
});
