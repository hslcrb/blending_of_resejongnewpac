const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const assert=require('node:assert/strict');
const origin=process.env.AREA_TEST_ORIGIN||'http://127.0.0.1:3151';
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPxoAAAAASUVORK5CYII=','base64');
async function prepare(p){if(process.env.GEOGRAPHY_UPSTREAM_PATH)await p.route('**/src/geographyLayer.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:require('node:fs').readFileSync(process.env.GEOGRAPHY_UPSTREAM_PATH,'utf8').replace("from 'three'","from '/node_modules/.vite/deps/three.js'").replace("from './mapProjection.js'","from '/src/mapProjection.js'")}));await p.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.maps\.eox\.at)\//,r=>r.fulfill({status:200,contentType:'image/png',body:pixel,headers:{'access-control-allow-origin':'*'}}));await p.goto(origin+'/map/');await p.waitForFunction(()=>{const b=document.querySelector('.mode-switch button');return b && !b.disabled},null,{timeout:120000});await p.getByRole('status').filter({hasText:'행정경계와 지면 자료를 표시합니다'}).waitFor({timeout:60000});}
async function selectRegion(p,code){await p.getByLabel('지역',{exact:true}).selectOption(code);await p.locator('.national-card').first().getByRole('button',{name:'이 후보의 위치 보기'}).click();}
(async()=>{const b=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 let p=await b.newPage({viewport:{width:1200,height:900}});await prepare(p);
 await p.route('**/area/buildings/*.json.gz',route=>route.abort());await selectRegion(p,'11');
 await p.getByRole('status').filter({hasText:'선택 위치의 서울 건물 정보를 불러오지 못했습니다'}).waitFor({timeout:60000});
 await p.locator('.geography-info').getByText(/서울특별시/).first().waitFor({timeout:60000});
 await p.unroute('**/area/buildings/*.json.gz');await p.waitForTimeout(600);
 await p.getByRole('button',{name:'선택 위치 건물 정보 다시 불러오기'}).click();
 await p.getByRole('status').filter({hasText:/선택 위치 주변 서울 건물 \d+건/}).waitFor({timeout:60000});await p.close();console.log('PASS: Seoul building failure and retry keep independent boundary information');
 p=await b.newPage({viewport:{width:1200,height:900}});await prepare(p);
 await p.route('**/gis/admin-dong/regions/26.geojson.gz',route=>route.abort());await selectRegion(p,'26');
 await p.getByRole('status').filter({hasText:'일부 행정경계 자료를 불러오지 못했습니다'}).waitFor({timeout:60000});
 await p.getByText(/서울 밖.*서울 건물 자료/).first().waitFor({timeout:60000});
 await p.unroute('**/gis/admin-dong/regions/26.geojson.gz');await p.getByRole('button',{name:'경계 자료 다시 불러오기'}).click();
 await p.locator('.geography-info').getByText(/부산광역시/).first().waitFor({timeout:60000});await p.close();console.log('PASS: Busan boundary failure and retry preserves the selected location');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
