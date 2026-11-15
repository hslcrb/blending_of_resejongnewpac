import * as THREE from 'three';

export function nearestFixtures(fixtures, point, budget = 8) {
    return fixtures.map((fixture,index)=>({fixture,index,distance:fixture.position.reduce((sum,v,i)=>sum+(v-point[i])**2,0)}))
        .filter(({fixture,distance})=>distance<fixture.distance**2)
        .sort((a,b)=>a.distance-b.distance||a.index-b.index).slice(0,budget).map(item=>item.fixture);
}
// Survey fixture locations are observed; light power is an artistic estimate, not photometry.
export function createSurveyLighting(parent, {onReady=()=>{}, onError=()=>{}}={}) {
    const group=new THREE.Group(); group.name='Survey20261101Lights'; parent.add(group);
    const abort=new AbortController(); let dead=false, level=0, fixtures=[], materials=[], overlay=null;
    const lights=Array.from({length:8},()=>{const light=new THREE.PointLight(0xffffff,0,1,2); light.castShadow=false; group.add(light); return light;});
    const setLevel=value=>{level=Math.max(0,Math.min(1,value)); for(const [material,base] of materials)material.emissiveIntensity=base*level; if(!level)for(const light of lights)light.intensity=0;};
    const ready=Promise.all([
        fetch('/model/survey-20261115/lighting.json',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('fixture manifest');return r.json();}),
        fetch('/model/survey-20261115/lighting.glb',{signal:abort.signal}).then(r=>{if(!r.ok)throw Error('fixture model');return r.arrayBuffer();}),
    ]).then(async ([manifest,data])=>{
        if(dead)return;
        const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
        if(dead)return;
        const gltf=await new GLTFLoader().parseAsync(data,'');
        overlay=gltf.scene;
        overlay.traverse(object=>{if(!object.isMesh)return;object.castShadow=false;object.receiveShadow=false;object.matrixAutoUpdate=false;object.updateMatrix(); for(const material of Array.isArray(object.material)?object.material:[object.material]) if(material.emissive && !materials.some(([m])=>m===material))materials.push([material,material.emissiveIntensity]);});
        if(dead){disposeOverlay();return;}
        fixtures=manifest.fixtures.filter(f=>Array.isArray(f.position)&&f.position.length===3&&f.position.every(Number.isFinite)&&Number.isFinite(f.intensity)&&f.intensity>=0&&Number.isFinite(f.distance)&&f.distance>0);
        group.add(overlay);setLevel(level);onReady();
    }).catch(error=>{disposeOverlay();group.removeFromParent();if(!dead)onError(error);});
    function disposeOverlay(){overlay?.traverse(o=>{if(o.isMesh){o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}});overlay=null;}
    return {ready,setLevel,update(position){const active=level?nearestFixtures(fixtures,position.toArray()):[];lights.forEach((light,i)=>{const f=active[i];light.intensity=f?f.intensity*level:0;if(f){light.position.fromArray(f.position);light.color.setRGB(...f.color);light.distance=f.distance;}});},dispose(){dead=true;abort.abort();disposeOverlay();group.removeFromParent();}};
}
