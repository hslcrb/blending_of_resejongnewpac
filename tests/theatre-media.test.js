import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectLevel, createTheatreMedia } from '../src/theatreMedia.js';

test('stage intensity follows audio and relaxes on pause',()=>{
 assert.ok(effectLevel(0,255,true,true)>effectLevel(0,0,true,true));
 assert.equal(effectLevel(.8,255,false,true),0);
 assert.equal(effectLevel(.8,255,true,false),0);
});
test('audio and media resources are restored when disposed', async()=>{
 let resumed=0, removed=0, disposed=0, paused=0;
 const video={addEventListener(){},removeEventListener(){},play:async()=>{},pause(){paused++},load(){},removeAttribute(){},currentTime:0,paused:false};
 class Listener {constructor(){this.context={resume:async()=>{resumed++}}}}
 class Audio {constructor(){this.panner={panningModel:''}} setMediaElementSource(){return this} setRefDistance(){return this} setRolloffFactor(){return this} setVolume(){return this} disconnect(){} }
 class Analyser {getAverageFrequency(){return 200}}
 class Texture {dispose(){disposed++}}
 class Material {dispose(){disposed++}}
 const THREE={AudioListener:Listener,PositionalAudio:Audio,AudioAnalyser:Analyser,VideoTexture:Texture,MeshBasicMaterial:Material,SRGBColorSpace:'srgb',DoubleSide:2};
 const camera={add(){},remove(){removed++}}, original={}, screen={material:original,add(){},remove(){removed++}}, light={intensity:2};
 const m=createTheatreMedia({THREE,camera,screen,effectLights:[light],videoFactory:()=>video});
 await m.play(); assert.equal(resumed,1);m.setEffects(true);m.update();assert.ok(light.intensity>2);
 m.dispose();assert.equal(screen.material,original);assert.equal(light.intensity,2);assert.equal(disposed,2);assert.equal(removed,2);assert.ok(paused>0);
});

test('spatial sound comes from the actual screen geometry centre', async()=>{
 let sound, texture;
 const video={addEventListener(){},removeEventListener(){},play:async()=>{},pause(){},load(){},removeAttribute(){}};
 class Listener {constructor(){this.context={resume:async()=>{}}}}
 class Audio {constructor(){sound=this;this.position={set(x,y,z){Object.assign(this,{x,y,z});}};this.panner={}} setMediaElementSource(){return this} setRefDistance(){return this} setRolloffFactor(){return this} setVolume(){return this} disconnect(){} }
 class Analyser {} class Texture {constructor(){texture=this} dispose(){}} class Material {dispose(){}}
 const THREE={AudioListener:Listener,PositionalAudio:Audio,AudioAnalyser:Analyser,VideoTexture:Texture,MeshBasicMaterial:Material};
 const geometry={computeBoundingBox(){this.boundingBox={getCenter(position){position.set(0,6.75,-1.12)}}}};
 const screen={geometry,material:{},add(){},remove(){}},camera={add(){},remove(){}};
 const media=createTheatreMedia({THREE,camera,screen,videoFactory:()=>video});
 assert.deepEqual([sound.position.x,sound.position.y,sound.position.z],[0,6.75,-1.12]);assert.equal(texture.flipY,false);media.dispose();geometry.boundingBox={getCenter(position){position.set(0,0,0)}};const centred=createTheatreMedia({THREE,camera,screen,videoFactory:()=>video});assert.deepEqual([sound.position.x,sound.position.y,sound.position.z],[0,0,0]);centred.dispose();
});
