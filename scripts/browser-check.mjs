import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import worker from '../dist/server/index.js';

const review = fileURLToPath(new URL('../review/', import.meta.url));
await mkdir(review, { recursive: true });
const server = createServer(async (request, response) => {
  const result = await worker.fetch(new Request(`http://localhost${request.url}`, { method: request.method }));
  response.writeHead(result.status, Object.fromEntries(result.headers));
  response.end(Buffer.from(await result.arrayBuffer()));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
(async () => {
  const browser = await chromium.launch({headless: true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('console', m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(origin, {waitUntil:'networkidle'});
  await page.screenshot({path:review + 'desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Explore the experience',exact:true}).click();
  await page.getByRole('dialog',{name:'Interactive app preview'}).waitFor();
  await page.screenshot({path:review + 'explorer-desktop.png'});
  await page.getByRole('button',{name:'Night',exact:true}).last().click();
  await page.waitForFunction(()=>document.querySelector('#viewer-image').complete);
  if(!await page.locator('#viewer-image').getAttribute('src').then(x=>x.includes('night')))throw Error('night scene failed');
  await page.getByRole('button',{name:'Next captured direction'}).click();
  if(await page.locator('#direction-name').textContent()!=='North view')throw Error('direction failed');
  await page.locator('#viewer-save').click();
  if(await page.locator('#viewer-save').getAttribute('aria-pressed')!=='true')throw Error('favourite failed');
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Save photo',exact:true}).click();
  const download=await downloadPromise;
  console.log('Photo download:',download.suggestedFilename());
  await page.getByRole('button',{name:'Take a tour',exact:true}).click();
  for(let i=0;i<3;i++)await page.locator('#tour-next').click();
  await page.getByRole('button',{name:'Start exploring',exact:true}).click();
  if(!await page.locator('#tour-card').isHidden())throw Error('tour failed');
  const deepLink=page.url();
  await page.reload({waitUntil:'networkidle'});
  if(!await page.locator('#explorer').evaluate(el=>el.open))throw Error('deep link failed');
  await page.getByRole('button',{name:'Close preview',exact:true}).click();
  await page.getByRole('button',{name:'Your favourites',exact:false}).click();
  if(await page.locator('.destination-card').count()!==1)throw Error('favourites filter failed');
  await page.reload({waitUntil:'networkidle'});
  if(await page.getByRole('button',{name:'Remove New York from favourites',exact:true}).count()!==1)throw Error('favourites persistence failed');
  await page.locator('#place-search').fill('Sweden');
  if(await page.locator('.destination-card').count()!==1)throw Error('search failed');
  await page.locator('#place-search').fill('nowhere-123');
  if(!await page.locator('#empty-places').isVisible())throw Error('empty search failed');
  await page.locator('#place-search').fill('');
  await page.getByRole('button',{name:'See Stockholm in winter',exact:true}).click();
  if(!await page.locator('#viewer-image').getAttribute('src').then(x=>x.includes('winter')))throw Error('winter failed');
  if(await page.locator('#timelapse').isDisabled())throw Error('winter time-lapse should be available');
  await page.getByRole('button',{name:'Summer',exact:true}).click();
  await page.getByRole('button',{name:'Time-lapse',exact:true}).click();
  if(await page.locator('#timelapse').getAttribute('aria-pressed')!=='true')throw Error('time lapse failed');
  await page.getByRole('button',{name:'Close preview',exact:true}).click();
  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(origin,{waitUntil:'networkidle'});
  if(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile horizontal overflow');
  await mobile.screenshot({path:review + 'mobile.png',fullPage:true});
  await mobile.getByRole('button',{name:'Step inside',exact:false}).click();
  await mobile.screenshot({path:review + 'explorer-mobile.png'});
  if(await mobile.evaluate(()=>document.querySelector('#viewer').scrollWidth>innerWidth))throw Error('mobile preview overflow');
  await mobile.getByRole('button',{name:'Night',exact:true}).last().click();
  await mobile.getByRole('button',{name:'Collapse view controls',exact:true}).click();
  if(!await mobile.locator('#panel-controls').isHidden())throw Error('collapse failed');
  await mobile.getByRole('button',{name:'Expand view controls',exact:true}).click();
  await mobile.getByRole('button',{name:'Close preview',exact:true}).click();
  for (const target of [page, mobile]) {
    await target.goto(`${origin}/?place=stockholm&season=winter`, {waitUntil:'networkidle'});
    for (const state of ['day', 'night', 'opening']) {
      const button = target.locator(`[data-time="${state}"]`);
      if(await button.isDisabled())throw Error(`Winter ${state} is disabled`);
      await button.click();
      await target.waitForFunction(() => {
        const image = document.querySelector('#viewer-image');
        return image.complete && image.naturalWidth > 0;
      });
      if(!await target.locator('#viewer-image').getAttribute('src').then(src=>src.endsWith(`stockholm-winter-${state}.jpg`)))throw Error(`Winter ${state} capture failed`);
    }
    await target.locator('#timelapse').click();
    await target.waitForFunction(()=>document.querySelector('#viewer-image').getAttribute('src').endsWith('stockholm-winter-night.jpg'), null, {timeout:7000});
    await target.locator('#timelapse').click();
    if(await target.locator('#timelapse').getAttribute('aria-pressed')!=='false')throw Error('Winter time-lapse did not pause');
    await target.reload({waitUntil:'networkidle'});
    if(!await target.locator('#viewer-image').getAttribute('src').then(src=>src.endsWith('stockholm-winter-night.jpg')))throw Error('Winter time deep link was not restored');
    await target.screenshot({path:review + `winter-night-${target.viewportSize().width}.png`});
    await target.locator('#next-direction').click();
    if(!await target.locator('#viewer-image').getAttribute('src').then(src=>src.endsWith('stockholm-winter-north.jpg')))throw Error('Winter direction failed');
    await target.reload({waitUntil:'networkidle'});
    if(!await target.locator('#viewer-image').getAttribute('src').then(src=>src.endsWith('stockholm-winter-north.jpg')))throw Error('Winter direction deep link was not restored');
    const winterDownloadPromise = target.waitForEvent('download');
    await target.locator('#photo-button').click();
    if((await winterDownloadPromise).suggestedFilename()!=='planet-render-360-stockholm-winter-north.jpg')throw Error('Winter photo download failed');
    await target.locator('[data-season-choice="summer"]').click();
    if(!await target.locator('#viewer-image').getAttribute('src').then(src=>src.endsWith('stockholm-opening.jpg')))throw Error('Summer switch did not restore summer capture');
    await target.locator('#close-explorer').click();
    for (const [id, name] of [['san_francisco', 'San Francisco'], ['helsinki', 'Helsinki']]) {
      await target.goto(`${origin}/?place=${id}`, {waitUntil:'networkidle'});
      if(await target.locator('#viewer-title').textContent()!==name)throw Error(`${name} deep link failed`);
      await target.screenshot({path:review + `${id}-${target.viewportSize().width}.png`});
      for (const state of ['opening', 'day', 'night']) {
        await target.locator(`[data-time="${state}"]`).click();
        await target.waitForFunction(() => {
          const image = document.querySelector('#viewer-image');
          return image.complete && image.naturalWidth > 0;
        });
        if(!await target.locator('#viewer-image').getAttribute('src').then(src=>src.includes(`${id}-${state}.jpg`)))throw Error(`${name} ${state} capture failed`);
      }
      await target.locator('#info-button').click();
      if(!(await target.locator('#info-copy').textContent()).trim())throw Error(`${name} story missing`);
      await target.locator('#close-info').click();
      await target.locator('#next-direction').click();
      if(await target.locator('#direction-name').textContent()!=='North view')throw Error(`${name} direction failed`);
      if(await target.evaluate(()=>document.querySelector('#viewer').scrollWidth>innerWidth))throw Error(`${name} preview overflows`);
      await target.locator('#close-explorer').click();
    }
  }
  if(errors.length)throw Error(errors.join('\n'));
  console.log('PASS: desktop and phone layout, opening/closing, day/night, directions, favourites/persistence, photo download, guided tour, deep links, search/empty state, winter lighting/directions/time-lapse/photo, collapsing panels, San Francisco and Helsinki captures; no browser errors.');
  console.log('Deep link restored correctly after reload.');
  await browser.close();
  server.close();
})().catch(e=>{console.error(e);server.close();process.exit(1)});
