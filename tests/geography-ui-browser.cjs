const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
const origin=process.env.AREA_TEST_ORIGIN||'http://127.0.0.1:3142';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPxoAAAAASUVORK5CYII=','base64');
async function prepare(page,failDong=false){
 await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.maps\.eox\.at)\//,route=>route.fulfill({status:200,contentType:'image/png',body:pixel,headers:{'access-control-allow-origin':'*'}}));
 if(failDong)await page.route('**/gis/admin-dong/regions/11.geojson.gz',route=>route.abort());
 await page.goto(origin+'/');
 await page.waitForFunction(()=>!document.querySelector('.mode-switch button')?.disabled,null,{timeout:120000});
}
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1200,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await prepare(p);
 await p.getByRole('status').filter({hasText:'행정경계와 지면 자료를 표시합니다'}).waitFor({timeout:60000});
 await p.getByRole('button',{name:'돋보기',exact:true}).click();
 await p.getByRole('button',{name:'현재 중심 건물 조회'}).click();
 await p.getByRole('heading',{name:'행정경계 · 지면 정보'}).waitFor({timeout:60000});
 await p.getByRole('heading',{name:'돋보기 · 건물 정보'}).waitFor({timeout:60000});
 await p.getByLabel('서울 전체 주소·건물명 검색').fill('세종로 81-3');await p.getByRole('button',{name:'전체 검색',exact:true}).click();
 await p.getByRole('status').filter({hasText:/검색 결과 [1-9]/}).waitFor({timeout:120000});
 await p.getByRole('list',{name:'서울 전체 검색 결과'}).getByRole('button').first().click();
 await p.getByRole('heading',{name:'종로구',exact:true}).waitFor({timeout:60000});
 assert.ok(await p.locator('.geography-info article').count()>0);
 await p.getByRole('button',{name:'전시천리안 (全視千里眼)'}).click();await p.getByRole('button',{name:'서울 전역',exact:true}).click();
 await p.getByRole('status').filter({hasText:'서울 전역과 광화문 주변'}).waitFor({timeout:120000});
 await p.waitForFunction(()=>Number(document.querySelector('canvas.area-projection')?.dataset.geographyLabels)>0,null,{timeout:60000});
 await p.getByRole('button',{name:'전국 행정동 전체 보기'}).click();
 await p.getByRole('status').filter({hasText:'전국 행정동 16 / 16개 광역권'}).waitFor({timeout:120000});
 await p.waitForFunction(()=>Number(document.querySelector('canvas.area-projection')?.dataset.geographyLabels)>0,null,{timeout:60000});
 if(process.env.GEOGRAPHY_EVIDENCE_PATH) await p.locator('.view-frame').screenshot({path:process.env.GEOGRAPHY_EVIDENCE_PATH});
 await p.setViewportSize({width:390,height:844});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await p.getByRole('button',{name:'전국 행정동 전체 보기'}).click();await p.getByRole('button',{name:'광화문 주변',exact:true}).click();await p.getByRole('button',{name:'직접 걷기'}).click();
 assert.equal(await p.getByRole('button',{name:'직접 걷기'}).getAttribute('aria-pressed'),'true');assert.deepEqual(errors,[]);await p.close();
 const q=await b.newPage({viewport:{width:1200,height:900}});await prepare(q,true);
 await q.getByRole('status').filter({hasText:'일부 행정경계 자료를 불러오지 못했습니다'}).waitFor({timeout:60000});
 await q.unroute('**/gis/admin-dong/regions/11.geojson.gz');await q.getByRole('button',{name:'경계 자료 다시 불러오기'}).click();
 await q.getByRole('status').filter({hasText:'행정경계와 지면 자료를 표시합니다'}).waitFor({timeout:60000});await q.close();
 console.log('PASS: real boundary UI, metadata, label projection, nationwide regions, mobile, walking and retry');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
