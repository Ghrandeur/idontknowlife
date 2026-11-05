const {chromium}=require('@playwright/test');
const base=process.env.BASE_URL||'http://127.0.0.1:3000';
const routes=['/','/pages/about.html','/pages/department.html','/pages/faculty.html','/pages/departments.html','/pages/leaders.html','/pages/parliamentarians.html','/pages/newsletter-login.html','/pages/marketplace.html','/pages/archive.html','/pages/gallery.html','/pages/documents.html','/pages/past-questions.html','/pages/companion.html','/pages/social-handles.html','/pages/newsletter.html','/admin/login.html'];
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:900});
  for(const route of routes){
   const response=await page.goto(base+route);
   if(!response.ok())throw Error('Route failed: '+route);
   await page.locator('.loading-state').waitFor({state:'detached',timeout:10000});
   await page.evaluate(()=>document.fonts.ready);
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Horizontal overflow: '+width+' '+route);
   if(await page.locator('a').evaluateAll(as=>as.some(a=>a.href.includes('fahssauniuyo.vercel.app'))))throw Error('Legacy site navigation on '+route);
   if(route==='/pages/department.html'&&await page.locator('.mls-discipline-card').count()!==6)throw Error('Missing introductory discipline cards.');
   console.log(width,route,'OK');
  }
 }
 await page.goto(base+'/pages/past-questions.html');
 await page.locator('#page-search').fill('BIOINFORMATICS');
 if(await page.locator('.document-row').count()!==1)throw Error('Study resource search failed.');
 await page.locator('#page-search').fill('no-such-resource');
 if(!await page.locator('.empty-panel').isVisible())throw Error('Search empty state failed.');
 await page.goto(base+'/pages/companion.html');
 await page.locator('[data-action="question"]').first().click();
 await page.locator('#site-dialog').waitFor({state:'visible'});
 await page.keyboard.press('Escape');
 await page.locator('#site-dialog').waitFor({state:'hidden'});
 if(errors.length)throw Error(errors.join('\n'));
 await browser.close();console.log('All departmental smoke tests passed. Start server.py before running this test.');
})().catch(error=>{console.error(error);process.exit(1);});
