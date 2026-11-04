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
