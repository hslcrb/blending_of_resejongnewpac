const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const base=process.env.THEATRE_ORIGIN||'http://127.0.0.1:3174';
const dir=process.env.THEATRE_SCREENSHOTS;
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--mute-audio']});try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?theatre=1');await page.getByRole('button',{name:'객석 입구',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(x=>x.textContent==='객석 입구')?.disabled,null,{timeout:120000});
 const canvas=page.locator('canvas');if(dir)await canvas.screenshot({path:path.join(dir,'grand-lobby.png')});
 await page.getByRole('button',{name:'객석 입구',exact:true}).click();await page.getByText('객석 입구',{exact:true}).last().waitFor();if(dir)await canvas.screenshot({path:path.join(dir,'grand-auditorium.png')});
 await page.getByRole('button',{name:'선택한 좌석에 앉기'}).click();await page.getByText(/에 앉아 있습니다/).waitFor();if(dir)await canvas.screenshot({path:path.join(dir,'grand-seated.png')});
 await page.getByRole('button',{name:'일어서기'}).click();assert.equal(await page.getByRole('button',{name:'일어서기'}).isDisabled(),true);
 const choices=await page.locator('select option').evaluateAll(options=>({second:options.find(o=>o.textContent.startsWith('2층'))?.value,first:options.find(o=>o.textContent.startsWith('1층 12열') && o.textContent.endsWith('-20'))?.value}));assert.ok(choices.second && choices.first);await page.locator('select').selectOption(choices.second);await page.getByRole('button',{name:'선택한 좌석에 앉기'}).click();await page.getByText(/2층 .*에 앉아 있습니다/).waitFor();await page.getByRole('button',{name:'일어서기'}).click();await page.locator('select').selectOption(choices.first);
 await page.getByRole('button',{name:'무대 뒤편',exact:true}).click();await page.getByRole('button',{name:'무대 전체',exact:true}).click();if(dir)await canvas.screenshot({path:path.join(dir,'grand-backstage.png')});
 await page.getByRole('button',{name:'객석 입구',exact:true}).click();await page.getByRole('button',{name:'선택한 좌석에 앉기'}).click();await page.getByRole('button',{name:'영상 재생'}).click();await page.getByText('영상과 공간 음향 재생 중').waitFor({timeout:45000});await page.getByLabel('영상에 반응하는 무대효과').check();assert.equal(await page.getByRole('button',{name:'영상 영사',exact:true}).getAttribute('aria-pressed'),'true');await page.waitForFunction(()=>Array.from(document.querySelectorAll('input[type=range]')).some(x=>Number(x.max)>10));await page.getByLabel('재생 위치').fill('40');await page.waitForTimeout(2500);if(dir)await canvas.screenshot({path:path.join(dir,'grand-projection.png')});await page.getByRole('button',{name:'일시 정지'}).click();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
 console.log('PASS: lobby, seating/standing, backstage, video and HRTF playback, effects, mobile layout');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
