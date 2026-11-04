const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
(async () => {
 const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const hashes=[];
  for (const [instant,clock] of [['2026-06-21T03:00:00Z','12:00'],['2026-06-20T15:00:00Z','00:00']]) {
   const page=await browser.newPage({viewport:{width:1200,height:900}}); const errors=[];
   page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error' && /shader|WebGLProgram/i.test(m.text())) errors.push(m.text())});
   await page.addInitScript(value=>{const Original=Date;const fixed=Original.parse(value);class FixedDate extends Original {constructor(...args){super(...(args.length?args:[fixed]))} static now(){return fixed}};globalThis.Date=FixedDate},instant);
   await page.route('**/api/weather',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({station:'RKSS',observedAt:instant,cover:'BKN',clouds:[{cover:'BKN'}],temperature:18})}));
   await page.goto((process.env.AREA_TEST_ORIGIN || 'http://127.0.0.1:3141')+'/');
   await page.getByRole('button',{name:'모형 보기'}).waitFor({state:'visible',timeout:120000});
   await page.waitForFunction(()=>!document.querySelector('.mode-switch button')?.disabled,null,{timeout:120000});
   await page.getByText(new RegExp(`서울 시간 ${clock}`)).waitFor({timeout:30000});
   await page.getByText(/김포공항 구름 관측/).waitFor({timeout:30000});
   const shot=await page.locator('.viewer-canvas').screenshot(); hashes.push(crypto.createHash('sha256').update(shot).digest('hex'));
   assert.deepEqual(errors,[]);await page.close();
  }
  assert.notEqual(hashes[0],hashes[1]);console.log('PASS: 서울 낮·밤, 관측 정보, 실제 WebGL 장면');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
