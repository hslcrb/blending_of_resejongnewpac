const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const origin = process.env.AXIS_ORIGIN || 'http://127.0.0.1:3178';
const timeout = { timeout: 90000 };

(async () => {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH,
        args: ['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
    try {
        const out = process.env.AXIS_SCREENSHOTS;
        if (out) await fs.mkdir(out,{recursive:true});
        for (const [variant,width] of [['previous',1160],['close',1160],['mobile',390]]) {
            const page = await browser.newPage({ viewport: { width, height: 850 } });
            try {
                const errors=[];
                page.on('pageerror',e=>errors.push(e.message));
                if (variant==='previous') await page.route('**/model/streaming-manifest.json', async route => {
                    const source=await route.fetch();
                    const json=await source.json();
                    json.chunks.find(x=>x.id==='gratitude-garden').url='/model/public-axis-20261125/gratitude-field.glb';
                    await route.fulfill({response:source,json});
                });
                const target=(variant==='previous'?'gratitude-field':'gratitude-plaza')+'.glb';
                const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/'+target),timeout);
                await page.goto(origin+'/explore/', {waitUntil:'domcontentloaded',...timeout});
                const frame=page.locator('.view-frame');
                await frame.scrollIntoViewIfNeeded();
                await page.waitForFunction(()=>document.querySelector('select.view-location:not([disabled])'),null,timeout);
                await page.getByLabel('낮과 밤 조명').selectOption('day',timeout);
                await page.getByLabel('장소 바로 보기').selectOption('gratitude-garden',timeout);
                assert.equal((await response).status(),200);
                await page.waitForTimeout(1250);
                assert.equal(await frame.locator('canvas.campus-webgl').count(),1);
                if(width===390) assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
                assert.deepEqual(errors,[]);
                if(out) await frame.screenshot({path:path.join(out,`garden-web-${variant}.jpg`),quality:86,...timeout});
            } finally { await page.close(); }
        }
    } finally { await browser.close(); }
    console.log('PASS: previous and revised garden GLB, identical preset, mobile layout, no page errors');
})().catch(e=>{console.error(e);process.exitCode=1});
