const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
const origin=process.env.AREA_TEST_ORIGIN||'http://127.0.0.1:3151';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPxoAAAAASUVORK5CYII=','base64');
async function prepare(p){if(process.env.GEOGRAPHY_UPSTREAM_PATH)await p.route('**/src/geographyLayer.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:require('node:fs').readFileSync(process.env.GEOGRAPHY_UPSTREAM_PATH,'utf8').replace("from 'three'","from '/node_modules/.vite/deps/three.js'").replace("from './mapProjection.js'","from '/src/mapProjection.js'")}));await p.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.maps\.eox\.at)\//,r=>r.fulfill({status:200,contentType:'image/png',body:pixel,headers:{'access-control-allow-origin':'*'}}));await p.goto(origin+'/map/');await p.waitForFunction(()=>{const b=document.querySelector('.mode-switch button');return b && !b.disabled},null,{timeout:120000});await p.getByRole('status').filter({hasText:'행정경계와 지면 자료를 표시합니다'}).waitFor({timeout:60000});}
async function selectRegion(p,code){await p.getByLabel('지역',{exact:true}).selectOption(code);await p.locator('.national-card').first().getByRole('button',{name:'이 후보의 위치 보기'}).click();}
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 // 늦은 서울 격자 요청 중 더 나중에 선택한 제주가 우선합니다.
 let p=await b.newPage({viewport:{width:1200,height:900}});await prepare(p);let release,start;let gate=new Promise(r=>release=r),started=new Promise(r=>start=r);
 await p.route('**/area/seoul-grid.json',async route=>{start();await gate;await route.continue()});
 await selectRegion(p,'26');await started;await selectRegion(p,'50');release();
 await p.getByRole('status').filter({hasText:'문화시설 변경 후보의 대표 위치'}).waitFor({timeout:120000});
 await p.locator('.geography-info').getByText(/제주특별자치도/).first().waitFor({timeout:60000});await p.waitForTimeout(2500);
 assert.equal(await p.locator('.geography-info').getByText(/부산광역시/).count(),0);await p.close();console.log('PASS: later Jeju selection survives delayed earlier Busan focus');
 // 느린 부산 행정동 응답이 회관의 수동 돋보기 결과를 덮지 않습니다.
 p=await b.newPage({viewport:{width:1200,height:900}});await prepare(p);gate=new Promise(r=>release=r);started=new Promise(r=>start=r);
 await p.route('**/gis/admin-dong/regions/26.geojson.gz',async route=>{start();await gate;await route.continue()});
 await selectRegion(p,'26');await started;await p.getByRole('status').filter({hasText:'문화시설 변경 후보의 대표 위치'}).waitFor({timeout:120000});
 await p.getByRole('button',{name:'광화문 주변',exact:true}).click();await p.getByRole('button',{name:'돋보기',exact:true}).click();
 await p.locator('.viewer-canvas canvas').first().click({position:{x:500,y:300}});await p.getByRole('status').filter({hasText:'선택 지점 주변 건물'}).waitFor({timeout:60000});
 release();await p.locator('.geography-info').getByText(/서울특별시/).first().waitFor({timeout:60000});await p.waitForTimeout(3000);
 assert.equal(await p.locator('.geography-info').getByText(/부산광역시/).count(),0);await p.close();console.log('PASS: manual Seoul magnifier survives delayed Busan boundary response');
 // 느린 카메라 이동 자체도 수동 돋보기보다 늦게 적용하지 않습니다.
 p=await b.newPage({viewport:{width:1200,height:900}});await prepare(p);gate=new Promise(r=>release=r);started=new Promise(r=>start=r);
 await p.route('**/area/seoul-grid.json',async route=>{start();await gate;await route.continue()});
 await selectRegion(p,'26');await started;await p.getByRole('button',{name:'광화문 주변',exact:true}).click();await p.getByRole('button',{name:'돋보기',exact:true}).click();
 await p.locator('.viewer-canvas canvas').first().click({position:{x:500,y:300}});await p.getByRole('status').filter({hasText:'선택 지점 주변 건물'}).waitFor({timeout:60000});release();await p.waitForTimeout(2500);
 assert.equal(await p.getByRole('button',{name:'광화문 주변',exact:true}).getAttribute('aria-pressed'),'true');assert.equal(await p.getByRole('status').filter({hasText:'문화시설 변경 후보의 대표 위치'}).count(),0);await p.close();console.log('PASS: manual view and click cancel delayed national camera focus');
 // 이전 서울 검색의 느린 응답은 나중의 부산 후보를 덮지 않습니다.
 p=await b.newPage({viewport:{width:1200,height:900}});await prepare(p);
 await p.getByRole('button',{name:'현재 중심 건물 조회'}).click();await p.getByRole('heading',{name:'돋보기 · 건물 정보'}).waitFor({timeout:60000});
 await p.getByLabel('서울 전체 주소·건물명 검색').fill('세종로 81-3');await p.getByRole('button',{name:'전체 검색',exact:true}).click();
 await p.getByRole('status').filter({hasText:/검색 결과 [1-9]/}).waitFor({timeout:120000});
 const result=p.getByRole('list',{name:'서울 전체 검색 결과'}).getByRole('button').first();const tile=await result.getAttribute('data-tile');
 gate=new Promise(r=>release=r);started=new Promise(r=>start=r);await p.route(`**/area/buildings/${tile}.json.gz`,async route=>{start();await gate;await route.continue()});
 await result.click();await started;await selectRegion(p,'26');release();
 await p.locator('.geography-info').getByText(/부산광역시/).first().waitFor({timeout:60000});await p.waitForTimeout(2500);
 assert.equal(await p.locator('.building-info article').count(),0);await p.locator('.building-info').getByText(/서울 밖.*서울 건물 자료/).first().waitFor({timeout:60000});
 await p.close();console.log('PASS: newer Busan location survives delayed Seoul search result');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
