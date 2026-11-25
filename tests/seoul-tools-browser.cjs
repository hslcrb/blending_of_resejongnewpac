const {chromium}=require('playwright'); const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const p=await b.newPage({viewport:{width:1200,height:900}}),errors=[]; p.on('pageerror',e=>errors.push(e.message));
 await p.goto((process.env.AREA_TEST_ORIGIN||'http://127.0.0.1:3141')+'/map/'); await p.waitForFunction(()=>!document.querySelector('.mode-switch button')?.disabled,null,{timeout:120000});
 await p.getByRole('button',{name:'현재 중심 건물 조회'}).click(); await p.getByRole('heading',{name:'돋보기 · 건물 정보'}).waitFor({timeout:60000});
 assert.equal(await p.locator('.building-info article').first().locator('dt').count(),29);
 await p.getByLabel('서울 전체 주소·건물명 검색').fill('세종로 81-3');await p.getByRole('button',{name:'전체 검색'}).click();await p.getByRole('status').filter({hasText:/검색 결과 [1-9]/}).waitFor({timeout:120000});
 await p.getByRole('list',{name:'서울 전체 검색 결과'}).getByRole('button').first().click();await p.getByRole('status').filter({hasText:'선택한 건물의 모든 필드'}).waitFor({timeout:30000});assert.match(await p.locator('.building-info article').first().innerText(),/세종로 81-3/);
 await p.getByRole('button',{name:'위성지도',exact:true}).click();await p.locator('.map-attribution').getByText(/2016/).waitFor({timeout:30000});
 await p.getByRole('button',{name:'지면지도',exact:true}).click();await p.locator('.map-attribution').getByText(/OpenStreetMap/).waitFor({timeout:30000});
 await p.getByRole('heading',{name:'다른 지역의 문화·집회 건물 후보'}).waitFor();await p.getByRole('button',{name:'이 후보의 위치 보기'}).first().click();await p.getByRole('status').filter({hasText:'문화시설 변경 후보의 대표 위치'}).waitFor({timeout:120000});
 assert.deepEqual(errors,[]);console.log('PASS: 29개 건물 필드·검색·지도 출처·전국 후보 위치');
 }finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
