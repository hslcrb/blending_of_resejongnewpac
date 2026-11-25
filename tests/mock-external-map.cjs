// Prevent browser regression tests from automatically scanning public map servers.
const {chromium}=require('playwright');
const original=chromium.launch.bind(chromium);
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aPxoAAAAASUVORK5CYII=','base64');
chromium.launch=async (...args)=>{
 const browser=await original(...args),newPage=browser.newPage.bind(browser);
 browser.newPage=async (...pageArgs)=>{
  const page=await newPage(...pageArgs);
  await page.route(/https:\/\/(tile\.openstreetmap\.org|tiles\.maps\.eox\.at)\//,route=>route.fulfill({status:200,contentType:'image/png',body:pixel,headers:{'access-control-allow-origin':'*'}}));
  return page;
 };
 return browser;
};
