const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:700,height:700}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const mode of ['local','national']){
  await page.goto('http://127.0.0.1:4178/tests/geography-render.html?mode='+mode);
  await page.waitForFunction(()=>window.__layer && window.__statuses.some(s=>s.state==='ready'),null,{timeout:60000});
  const result=await page.evaluate(async()=>{const overlay=window.__pixels(false),hidden=window.__pixels(true);const labels=window.__layer.getLabels();return {overlay,hidden,labels:labels.length,status:window.__statuses.at(-1)}});
  assert.ok(result.overlay>20,JSON.stringify({mode,...result}));if(mode==='local')assert.equal(result.hidden,0,JSON.stringify({mode,...result}));
  assert.ok(result.labels>0);assert.match(result.status.notice,/법정동/);assert.match(result.status.attribution,/SGIS/);
 }
 assert.deepEqual(errors,[]);console.log('PASS: real QGIS and administrative boundaries in WebGL, high-altitude overlay and source attribution');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
