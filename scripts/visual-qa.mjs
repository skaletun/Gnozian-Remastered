import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.visual-qa');
await mkdir(root,{recursive:true});
const report={screens:[],assets:[],layout:{},errors:[],requests:[]};
const browser=await chromium.launch({
  headless:true,
  args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
});
const origin='http://127.0.0.1:4173/Gnozian-Remastered/';
const context=await browser.newContext({
  viewport:{width:844,height:390},deviceScaleFactor:2,
  isMobile:true,hasTouch:true,locale:'ru-RU',reducedMotion:'reduce',
});
const page=await context.newPage();
page.on('pageerror',error=>report.errors.push(String(error)));
page.on('response',response=>{
  if(response.status()>=400 && /(?:ui-art|ui-2d)/.test(response.url()))
    report.requests.push(response.status()+' '+response.url());
});

const shot=async(name,includePreview=false)=>{
  const p=path.join(root,name+'.jpg');
  const bytes=await page.screenshot({path:p,type:'jpeg',quality:65,animations:'disabled',fullPage:false});
  report.screens.push({name,bytes:bytes.length,viewport:page.viewportSize()});
  if(includePreview){
    const preview=await page.screenshot({type:'jpeg',quality:34,animations:'disabled'});
    console.log('GNOZIAN_VISUAL_'+name+'='+preview.toString('base64'));
  }
};
async function noHorizontalOverflow(screen){
  const result=await page.evaluate(()=>({
    screenWidth:innerWidth,
    scrollWidth:document.documentElement.scrollWidth,
    bodyWidth:document.body.scrollWidth,
  }));
  report.layout[screen]=result;
  if(result.scrollWidth>result.screenWidth+6)
    throw new Error(screen+' overflows horizontally: '+JSON.stringify(result));
}
async function clickVisible(locator,name){
  await locator.first().waitFor({state:'visible',timeout:15000});
  await locator.first().click({timeout:15000});
  console.log('QA_ACTION '+name);
}
async function main(){
  await page.goto(origin,{waitUntil:'domcontentloaded',timeout:40000});
  await page.locator('.rmm-root').waitFor({timeout:40000});
  await noHorizontalOverflow('mobile-menu');
  const initial=await page.locator('img[src*="/ui-2d/"]').count();
  if(initial<5)throw new Error('Mobile menu is missing generated SVGs: '+initial);
  await shot('01-mobile-menu',true);

  await clickVisible(page.locator('.rmm-grid button').filter({hasText:/Настройки|Settings/i}),'settings');
  await page.locator('.rm-panel').waitFor({timeout:20000});
  await noHorizontalOverflow('mobile-settings');
  await shot('02-mobile-settings');
  await clickVisible(page.locator('.rm-close'),'close settings');

  await clickVisible(page.locator('.rmm-grid button').filter({hasText:/Достижения|Achievements/i}),'achievements');
  await page.locator('.gnz-achievements-window').waitFor({timeout:20000});
  await noHorizontalOverflow('mobile-achievements');
  const achievements=await page.locator('.gnz-achievements-window').evaluate(el=>{
    const rect=el.getBoundingClientRect();
    return {top:rect.top,bottom:rect.bottom,width:rect.width,height:rect.height};
  });
  report.layout.achievements=achievements;
  if(achievements.bottom>390+3 || achievements.top< -3)
    throw new Error('Achievements modal exceeds mobile viewport '+JSON.stringify(achievements));
  await shot('03-mobile-achievements');
  await clickVisible(page.locator('.gnz-achievements-close'),'close achievements');

  await clickVisible(page.locator('.rmm-newgame'),'new game');
  await noHorizontalOverflow('mobile-newgame');
  await shot('04-mobile-newgame',true);
  await clickVisible(page.getByRole('button',{name:/Начать|Start/i}).last(),'start game');
  await page.locator('.rhm-toolbar').waitFor({timeout:90000});
  await page.locator('.rhm-yield-item').first().waitFor({timeout:30000});
  await page.waitForTimeout(1600);

  const loaded=await page.locator('.rhm-yield-item img[data-remaster-raster]').evaluateAll(images=>
    images.map(img=>({
      resource:img.getAttribute('data-remaster-raster'),
      complete:img.complete,
      width:img.naturalWidth,
      height:img.naturalHeight,
      src:img.currentSrc,
    }))
  );
  report.assets=loaded;
  const names=loaded.map(img=>img.resource).sort().join(',');
  if(names!=='food,gold,production,science')
    throw new Error('Four original generated raster art assets not mounted in live HUD: '+names);
  if(loaded.some(img=>!img.complete||img.width<35||img.height<35))
    throw new Error('Broken raster image in active game HUD: '+JSON.stringify(loaded));
  if(report.requests.length)throw new Error('Broken image network requests: '+report.requests.join('; '));
  await noHorizontalOverflow('mobile-game');
  const dock=await page.locator('.rhm-bottom').boundingBox();
  const nav=await page.locator('.rhm-toolbar').boundingBox();
  report.layout.dock=dock;
  report.layout.nav=nav;
  if(!dock||!nav||dock.height>65||nav.height>60)
    throw new Error('Oversized landscape HUD: '+JSON.stringify({dock,nav}));
  await shot('05-mobile-babylon-game',true);

  await clickVisible(page.locator('.rhm-resources-trigger'),'resource details');
  await page.locator('.rhm-resource-menu').waitFor({timeout:9000});
  await shot('06-mobile-resource-panel');

  const tablet=await browser.newContext({
    viewport:{width:1180,height:820},deviceScaleFactor:1.5,
    hasTouch:true,isMobile:true,locale:'ru-RU',reducedMotion:'reduce',
  });
  const tpage=await tablet.newPage();
  await tpage.goto(origin,{waitUntil:'domcontentloaded',timeout:40000});
  await tpage.locator('.rmm-root').waitFor({timeout:20000});
  await tpage.screenshot({path:path.join(root,'07-tablet-landscape-menu.jpg'),type:'jpeg',quality:65});
  await tablet.close();

  console.log('QA_PASS '+JSON.stringify({raster:loaded,layout:report.layout,screens:report.screens}));
}
try{
  await main();
}catch(error){
  report.errors.push(String(error));
  console.error('QA_FAIL '+String(error));
  await shot('99-failure').catch(()=>{});
  process.exitCode=1;
}finally{
  await writeFile(path.join(root,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
