const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
const origin=process.env.AREA_TEST_ORIGIN||'http://127.0.0.1:3151';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPxoAAAAASUVORK5CYII=','base64');
async function prepare(p){if(process.env.GEOGRAPHY_UPSTREAM_PATH)await p.route('**/src/geographyLayer.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:require('node:fs').readFileSync(process.env.GEOGRAPHY_UPSTREAM_PATH,'utf8').replace("from 'three'","from '/node_modules/.vite/deps/three.js'").replace("from './mapProjection.js'","from '/src/mapProjection.js'")}));await p.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.maps\.eox\.at)\//,r=>r.fulfill({status:200,contentType:'image/png',body:pixel,headers:{'access-control-allow-origin':'*'}}));await p.goto(origin+'/');await p.waitForFunction(()=>{const b=document.querySelector('.mode-switch button');return b && !b.disabled},null,{timeout:120000});}
async function selectRegion(p,code){await p.getByLabel('지역',{exact:true}).selectOption(code);const card=p.locator('.national-card').first();await card.getByRole('button',{name:'이 후보의 위치 보기'}).click();}
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1200,height:900}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await prepare(p);
 await p.getByRole('button',{name:'돋보기',exact:true}).click();await p.getByRole('button',{name:'현재 중심 건물 조회'}).click();await p.getByRole('heading',{name:'돋보기 · 건물 정보'}).waitFor({timeout:60000});
 await p.getByLabel('서울 전체 주소·건물명 검색').fill('세종로 81-3');await p.getByRole('button',{name:'전체 검색',exact:true}).click();await p.getByRole('status').filter({hasText:/검색 결과 [1-9]/}).waitFor({timeout:120000});await p.getByRole('list',{name:'서울 전체 검색 결과'}).getByRole('button').first().click();await p.getByRole('heading',{name:'종로구',exact:true}).waitFor({timeout:60000});
 await selectRegion(p,'26');await p.getByRole('status').filter({hasText:'문화시설 변경 후보의 대표 위치'}).waitFor({timeout:120000});
 await p.getByText(/서울 밖.*서울 건물 자료/).first().waitFor({timeout:60000});
 await p.locator('.geography-info').getByText(/부산광역시/).first().waitFor({timeout:60000});
 assert.equal(await p.locator('.building-info article').count(),0);assert.equal(await p.locator('.geography-info').getByText('종로구',{exact:true}).count(),0);
 await p.locator('.viewer-canvas canvas').first().click({position:{x:500,y:300}});
 await p.getByRole('status').filter({hasText:'선택 지점 주변 건물'}).waitFor({timeout:60000});
 await p.locator('.building-info').getByText(/서울 밖.*서울 건물 자료/).first().waitFor({timeout:60000});
 assert.deepEqual(errors,[]);await p.close();console.log('PASS: selecting a Busan candidate clears old Seoul metadata and queries its administrative location');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
