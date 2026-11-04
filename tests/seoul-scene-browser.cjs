const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
  const page=await browser.newPage({viewport:{width:1200,height:900}}); const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.AREA_TEST_ORIGIN||'http://127.0.0.1:3141')+'/map/');
  await page.waitForFunction(()=>!document.querySelector('.mode-switch button')?.disabled,null,{timeout:120000});
  await page.getByRole('button',{name:'돋보기',exact:true}).click();
  await page.locator('.viewer-canvas canvas').first().click({position:{x:500,y:300}});
  await page.getByRole('status').filter({hasText:'선택 지점 주변 건물'}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'전시천리안 (全視千里眼)'}).click();
  await page.getByRole('status').filter({hasText:'695,753건'}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'서울 전역',exact:true}).click();
  await page.getByRole('status').filter({hasText:'서울 전역과 광화문'}).waitFor({timeout:120000});
  await page.locator('.viewer-canvas canvas').first().click({position:{x:500,y:300}});
  await page.getByRole('status').filter({hasText:'선택 지점 주변 건물'}).waitFor({timeout:60000});
  await page.getByRole('button',{name:'광화문 주변',exact:true}).click();
  await page.getByRole('button',{name:'직접 걷기'}).click();
  assert.equal(await page.getByRole('button',{name:'직접 걷기'}).getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[]);console.log('PASS: 기존 파빌리온 장면과 서울 전환, 돋보기·전시천리안, 직접 걷기');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
