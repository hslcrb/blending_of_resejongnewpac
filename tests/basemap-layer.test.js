import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBasemapLayer, groundFootprint } from '../src/basemapLayer.js';
import { worldToGeo, grid5186ToLatLon, lonLatToTile } from '../src/mapProjection.js';

function camera() {
    const c = new THREE.PerspectiveCamera(45, 1, 1, 1200);
    c.position.set(0, 500, 200); c.lookAt(0, 0, 0); c.updateMatrixWorld(true); return c;
}
const flush = () => new Promise(resolve => setTimeout(resolve, 20));

test('camera ground footprint and tile lifecycle only load the visible region', async () => {
    const scene = new THREE.Scene(), credit = {textContent:'',hidden:true};
    const requests = [], closed = []; let invalidations = 0;
    const layer = createBasemapLayer({scene, attributionElement:credit, invalidate:()=>invalidations++, loadImage: async (url, signal) => {
        requests.push({url,signal}); return {close() { closed.push(url); }};
    }});
    assert.ok(groundFootprint(camera(),0).length >= 3);
    layer.setProvider('satellite');
    layer.update(camera(), {width:800,height:800,mode:'local'});
    await flush();
    assert.ok(requests.length > 0 && requests.length <= 24);
    assert.ok(requests.every(r => r.url.includes('s2cloudless_3857')));
    assert.match(credit.textContent, /2016/); assert.equal(credit.hidden,false);
    assert.equal(layer.group.children.length,requests.length);
    layer.setBrightness(0.3);assert.ok(layer.group.children.every(mesh=>Math.abs(mesh.material.color.r-0.3)<1e-9));
    assert.throws(()=>layer.setProvider('toString'));
    const count = requests.length, invalidationsBefore = invalidations; layer.update(camera(), {width:800,height:800,mode:'local'}); await flush();
    assert.equal(requests.length,count,'unchanged view should not re-request');
    assert.equal(invalidations,invalidationsBefore,'unchanged view should not create a render loop');
    let geometryDisposed=0, materialDisposed=0, textureDisposed=0;
    for (const mesh of layer.group.children) {
        mesh.geometry.addEventListener('dispose',()=>geometryDisposed++);
        mesh.material.addEventListener('dispose',()=>materialDisposed++);
        mesh.material.map.addEventListener('dispose',()=>textureDisposed++);
    }
    layer.dispose();
    assert.equal(geometryDisposed,count);assert.equal(materialDisposed,count);assert.equal(textureDisposed,count);
    assert.equal(scene.children.includes(layer.group),false);
    assert.equal(layer.group.children.length,0); assert.equal(closed.length,count); assert.equal(credit.hidden,true);
});

test('provider switch aborts stale requests and failed images are reported and retryable', async () => {
    const scene = new THREE.Scene(), credit = {textContent:'',hidden:true}, requests=[];
    const errors=[];
    let fail = false;
    const layer = createBasemapLayer({scene,attributionElement:credit,onStatus:s=>errors.push(s),loadImage:(url,signal)=>{
        requests.push({url,signal});
        if (fail) return Promise.reject(new Error('unavailable'));
        return new Promise((resolve,reject) => signal.addEventListener('abort',()=>reject(Object.assign(new Error('aborted'),{name:'AbortError'}))));
    }});
    layer.setProvider('ground'); layer.update(camera(),{width:500,height:500,mode:'seoul'}); await flush();
    const old=requests.slice(); assert.ok(old.length>0 && old.length<=4);
    fail=true; layer.setProvider('satellite'); await flush();
    assert.ok(old.every(r=>r.signal.aborted));
    assert.ok(errors.some(s=>s.failed>0));
    const before=requests.length; layer.retry(); await flush(); assert.ok(requests.length>before);
    layer.dispose();
});


test('late image after disposal is closed and a sky-only view requests nothing', async () => {
    const scene = new THREE.Scene(), credit = {textContent:'',hidden:true}, resolvers=[];
    let closed=0;
    const layer=createBasemapLayer({scene,attributionElement:credit,loadImage:()=>new Promise(resolve=>resolvers.push(resolve))});
    const up=new THREE.PerspectiveCamera(45,1,1,1000);up.position.set(0,500,0);up.lookAt(0,1000,0);up.updateMatrixWorld(true);
    layer.setProvider('ground');layer.update(up,{width:500,height:500,mode:'local'});await flush();
    assert.equal(resolvers.length,0);
    layer.update(camera(),{width:500,height:500,mode:'local'});await flush();assert.ok(resolvers.length>0);
    layer.dispose();for(const resolve of resolvers)resolve({close(){closed++}});await flush();
    assert.equal(closed,resolvers.length);assert.equal(layer.group.children.length,0);
});


test('wide national view clips to Korea and tessellates low-zoom tiles', async () => {
    const scene=new THREE.Scene(), credit={textContent:'',hidden:true};
    const urls=[];
    const layer=createBasemapLayer({scene,attributionElement:credit,loadImage:async url=>{urls.push(url);return {close(){}}}});
    const c=new THREE.PerspectiveCamera(45,1,100,5000000);
    c.position.set(0,1700000,-50000);c.up.set(0,0,-1);c.lookAt(0,0,-50000);c.updateMatrixWorld(true);
    layer.setProvider('satellite');layer.update(c,{width:800,height:800,mode:'seoul'});await flush();await flush();
    assert.ok(urls.length>0 && urls.length<=24,`national request count ${urls.length}`);
    assert.ok(layer.group.children.some(mesh=>mesh.geometry.attributes.position.count>4), 'large tiles need curved reprojection mesh');
    for(const mesh of layer.group.children) {
      const pos=mesh.geometry.attributes.position, uv=mesh.geometry.attributes.uv;
      for(let i=0;i<pos.count;i++) {
        assert.ok(Number.isFinite(pos.getX(i)) && Number.isFinite(pos.getZ(i)));
        assert.ok(uv.getX(i)>=-0.00001 && uv.getX(i)<=1.00001 && uv.getY(i)>=-0.00001 && uv.getY(i)<=1.00001);
        const [,z,x,y]=mesh.name.match(/(\d+)\/(\d+)\/(\d+)$/).map(Number);
        const g=worldToGeo('seoul',pos.getX(i),pos.getZ(i)),ll=grid5186ToLatLon(g.easting,g.northing);
        const t=lonLatToTile(ll.lon,ll.lat,z);
        assert.ok(Math.abs(uv.getX(i)-(t.x-x))<0.001 && Math.abs(uv.getY(i)-(1-(t.y-y)))<0.001);

      }
    }
    const before=urls.length;
    const distant=new THREE.PerspectiveCamera(45,1,1,3000);
    distant.position.set(2000000,500,-50000);distant.up.set(0,0,-1);distant.lookAt(2000000,0,-50000);distant.updateMatrixWorld(true);
    layer.update(distant,{width:800,height:800,mode:'seoul'});await flush();
    assert.equal(urls.length,before,'outside peninsula must not fetch tiles');
    assert.equal(layer.group.children.length,0,'old visible tiles must be released');
    layer.dispose();
});
