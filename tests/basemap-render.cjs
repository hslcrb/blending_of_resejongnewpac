const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const p=await b.newPage({viewport:{width:800,height:900}});let errors=[];p.on('pageerror',e=>errors.push(e.message));
for(const mode of ['local','seoul']) {
await p.goto('http://127.0.0.1:4177/tests/basemap-render.html?mode='+mode);
await p.waitForFunction(()=>window.__layer?.group.children.length>0,{timeout:30000});
await p.waitForFunction(()=>window.__sample()?.length===4,{timeout:30000});
const sample=await p.evaluate(()=>window.__sample());
const expected=[[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
for(let i=0;i<4;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(sample[i][j]-expected[i][j])<10,JSON.stringify(sample));
assert.match(await p.locator('#credit').textContent(),/OpenStreetMap/);assert.equal(await p.locator('#credit a').first().getAttribute('href'),'https://www.openstreetmap.org/copyright');assert.deepEqual(errors,[]);
}
await p.goto('http://127.0.0.1:4177/tests/basemap-render.html?mode=seoul&wide=1');
await p.waitForFunction(()=>{const x=window.__centerPixel?.();return x && (x[0]+x[1]+x[2])>128},null,{timeout:30000});
assert.ok(await p.evaluate(()=>window.__layer.group.children.some(mesh=>mesh.geometry.attributes.position.count>4)));
assert.deepEqual(errors,[]);
console.log('PASS: both scene axes, UV orientation, attribution and wide national WebGL render');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
