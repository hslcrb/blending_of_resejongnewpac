// Exercise the actual exported screen mesh with a live HTMLVideoElement/VideoTexture.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(__dirname, '..');
const localThree = path.join(root, 'node_modules/three');
const threeRoot = fs.existsSync(localThree) ? localThree : path.resolve(root, '../..', 'node_modules/three');
const html = `<!doctype html><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/three/build/three.module.js"}}</script><script type="module">
import * as THREE from 'three'; import {GLTFLoader} from '/three/examples/jsm/loaders/GLTFLoader.js';
try {
 const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(640,360);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.appendChild(renderer.domElement);
 const source=document.createElement('canvas');source.width=160;source.height=90;const ctx=source.getContext('2d');
 function paint(){ctx.fillStyle='#ff0000';ctx.fillRect(0,0,80,45);ctx.fillStyle='#00ff00';ctx.fillRect(80,0,80,45);ctx.fillStyle='#0000ff';ctx.fillRect(0,45,80,45);ctx.fillStyle='#ffff00';ctx.fillRect(80,45,80,45);requestAnimationFrame(paint)}paint();
 const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=source.captureStream(30);await video.play();
 const tex=new THREE.VideoTexture(video);tex.flipY=false;tex.colorSpace=THREE.SRGBColorSpace;
 const gltf=await new GLTFLoader().loadAsync('/grand-theatre.glb');const screen=gltf.scene.getObjectByName('GrandProjectionScreen');if(!screen||!screen.isMesh)throw Error('스크린 Mesh가 없습니다');
 const scene=new THREE.Scene();screen.removeFromParent();screen.material=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false});scene.add(screen);
 const distance=21.08,camera=new THREE.PerspectiveCamera(2*Math.atan(4.5/distance)*180/Math.PI,640/360,.1,100);camera.position.set(0,6.75,20);camera.lookAt(0,6.75,-1.08);
 await new Promise(r=>setTimeout(r,600));renderer.render(scene,camera);
 const gl=renderer.getContext(),sample=(x,y)=>{const p=new Uint8Array(4);gl.readPixels(x,y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p]};
 window.videoTest={topLeft:sample(160,270),topRight:sample(480,270),bottomLeft:sample(160,90),bottomRight:sample(480,90),readyState:video.readyState};
} catch(e) {window.videoError=String(e.stack||e)}
</script>`;
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return}
 let file;
 if(req.url==='/grand-theatre.glb')file=path.join(root,'public/model/grand-theatre/grand-theatre.glb');
 else if(req.url.startsWith('/three/')){file=path.resolve(threeRoot,'.'+req.url.slice(6));if(!file.startsWith(threeRoot+path.sep)){res.writeHead(403).end();return}}
 else{res.writeHead(404).end();return}
 fs.readFile(file,(e,data)=>{if(e){res.writeHead(404).end();return}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'model/gltf-binary');res.end(data)});
});
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser;try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage({viewport:{width:640,height:360}});await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.videoTest||window.videoError,null,{timeout:30000});
 const out=await page.evaluate(()=>window.videoError?{error:window.videoError}:window.videoTest);if(out.error)throw Error(out.error);
 const is=(p,r,g,b)=>p[0]>r[0]&&p[0]<r[1]&&p[1]>g[0]&&p[1]<g[1]&&p[2]>b[0]&&p[2]<b[1];
 assert.ok(is(out.topLeft,[180,256],[-1,80],[-1,80]),`top left red: ${out.topLeft}`);
 assert.ok(is(out.topRight,[-1,80],[180,256],[-1,80]),`top right green: ${out.topRight}`);
 assert.ok(is(out.bottomLeft,[-1,80],[-1,80],[180,256]),`bottom left blue: ${out.bottomLeft}`);
 assert.ok(is(out.bottomRight,[180,256],[180,256],[-1,80]),`bottom right yellow: ${out.bottomRight}`);
 console.log('PASS exported screen displays all four video corners in correct orientation',JSON.stringify(out));
}finally{if(browser)await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
