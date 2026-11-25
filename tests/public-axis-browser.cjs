const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const base=process.env.AXIS_ORIGIN||'http://127.0.0.1:3174';
const captures=process.env.AXIS_SCREENSHOTS;
const timeout={timeout:90000};

async function open(browser,viewport,scenario) {
    const p=await browser.newPage({ viewport });
    const errors=[];
    const models=[];
    p.on('pageerror',e=>errors.push(e.message));
    p.on('response',response=>{if(response.url().includes('/model/'))models.push({url:response.url(),status:response.status()});});
    if(scenario==='missing') await p.route('**/public-axis-20261125/theatre.glb',r=>r.fulfill({status:404,body:'missing'}));
    if(scenario==='before') await p.route('**/model/streaming-manifest.json',async r=>{
        const f=await r.fetch();const data=await f.json();
        delete data.sTheatrePatch;
        const garden=data.chunks.find(e=>e.id==='gratitude-garden');
        garden.url='/model/stream/20261103-gratitude-garden.glb';
        data.chunks=data.chunks.filter(x=>x.id!=='gwanghwamun-north-axis');
        await r.fulfill({response:f,json:data});
    });
    await p.goto(base+'/explore/',{waitUntil:'domcontentloaded',timeout:90000});
    const frame=p.locator('.view-frame');
    await frame.scrollIntoViewIfNeeded();
    const news=p.getByLabel('장소 바로 보기');
    await p.waitForFunction(()=>document.querySelector('select.view-location:not([disabled])'),null,timeout);
    await p.getByLabel('낮과 밤 조명').selectOption('day',{timeout:90000});
    assert.equal(await p.locator('canvas.campus-webgl').count(),1);
    return {p,frame,news,errors,models};
}

async function snap(frame,name) {
    if(captures) await frame.screenshot({path:path.join(captures,name+'.jpg'),quality:82,timeout:90000});
}

(async()=>{
    const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});
    try{
        if(captures)await fs.mkdir(captures,{recursive:true});
        const desktop={width:1140,height:820};
        for(const scenario of ['after','missing','before']){
            const {p,frame,news,errors,models}=await open(browser,desktop,scenario);
            try{
                await news.selectOption('s-theatre',timeout);
                await p.waitForTimeout(950);
                await snap(frame,'web-theatre-'+scenario);
                if(scenario==='after'){
                    assert.ok(models.some(r=>r.url.endsWith('/theatre.glb')&&r.status===200));
                }
                if(scenario==='missing'){
                    assert.ok(models.some(r=>r.url.endsWith('/theatre.glb')&&r.status===404));
                    assert.equal(await p.getByRole('button',{name:'처음 시점',exact:true}).isEnabled(),true);
                    assert.deepEqual(errors,[]);
                    continue;
                }
                const gardenEnd=scenario==='after'?'/gratitude.glb':'/20261103-gratitude-garden.glb';
                const gardenPromise=!models.some(r=>r.url.endsWith(gardenEnd)&&r.status===200) && p.waitForResponse(r=>r.url().endsWith(gardenEnd)&&r.status()===200,timeout);
                await news.selectOption('gratitude-garden',timeout);
                if(gardenPromise) await gardenPromise;
                await p.waitForTimeout(1050);
                await snap(frame,'web-gratitude-'+scenario);
                const northReady=scenario==='after'&&!models.some(r=>r.url.endsWith('/gwanghwamun.glb')&&r.status===200)&&p.waitForResponse(r=>r.url().endsWith('/gwanghwamun.glb')&&r.status()===200,timeout);
                await p.getByLabel('장소 바로 보기').selectOption('north-axis',timeout);
                if(northReady) await northReady;
                await p.waitForTimeout(1250);
                await snap(frame,'web-north-'+scenario);
                assert.deepEqual(errors,[]);
            }finally{await p.close();}
        }
        const {p,frame,errors}=await open(browser,{width:390,height:844},'after');
        try{
            assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
            assert.ok(await p.locator('.view-actions').evaluate(el=>{
                const frame=el.closest('.view-frame').getBoundingClientRect();
                return Array.from(el.children).every(c=>{const r=c.getBoundingClientRect();return r.left>=frame.left&&r.right<=frame.right;});
            }));
            await p.getByLabel('장소 바로 보기').selectOption('north-axis',timeout);
            await p.waitForTimeout(2200);await snap(frame,'web-north-mobile');
            await p.getByRole('button',{name:'직접 걷기'}).evaluate(el=>el.click());
            assert.equal(await p.getByRole('button',{name:'직접 걷기'}).getAttribute('aria-pressed'),'true');
            assert.deepEqual(errors,[]);
        }finally{await p.close();}
        console.log('PASS local Chromium: before/after views, assets, missing theatre fallback, narrow screen, legacy walking toggle');
    }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
