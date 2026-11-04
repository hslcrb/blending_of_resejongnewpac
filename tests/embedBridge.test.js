import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmbedBridge } from '../src/embedBridge.js';
test('내장 뷰어 높이를 허용된 리뉴얼 출처에만 버전과 함께 알리고 종료한다',()=>{
 const messages=[];let disconnected=false, callback;
 class Observer {constructor(fn){callback=fn}observe(){}disconnect(){disconnected=true}}
 const stop=createEmbedBridge({root:{scrollHeight:1420},parent:{postMessage:(msg,origin)=>messages.push({msg,origin})},Observer,requestFrame:fn=>fn()});
 callback(); assert.equal(messages[0].msg.type,'sejong3d:height');assert.equal(messages[0].msg.height,1420);assert.equal(messages[0].msg.version,1);
 assert.ok(messages.every(x=>x.origin!=='*'));assert.ok(messages.some(x=>x.origin==='https://renewsejongpac.rhee.life'));stop();assert.equal(disconnected,true);
});
