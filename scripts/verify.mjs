import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const worker = (await import(pathToFileURL(path.join(root, 'dist/server/index.js')))).default;
const request = (url, method = 'GET') => worker.fetch(new Request(new URL(url, 'https://showcase.example/'), { method }));
const home = await request('/');
assert.equal(home.status, 200);
assert.match(home.headers.get('content-type'), /text\/html/);
const html = await home.text();
assert.match(html, /Planet Render 360/);
assert.ok(home.headers.get('content-security-policy').includes("script-src 'self'"));
const localRefs = [...html.matchAll(/(?:src|href)="([^"?#:]+)"/g)].map(match => match[1]);
assert.ok(localRefs.length > 10, 'Expected local asset references in the HTML');
for (const ref of localRefs) {
  assert.ok(!ref.startsWith('/'), `Use a relative path so the site also works under a subpath (GitHub Pages): ${ref}`);
  assert.equal((await request(ref)).status, 200, `Missing HTML asset: ${ref}`);
}
const places = await (await request('/assets/places.json')).json();
assert.equal(places.length, 6);
for (const id of ['san_francisco', 'helsinki']) {
  const place = places.find(item => item.id === id);
  assert.ok(place, `Missing destination: ${id}`);
  for (const state of ['opening', 'day', 'night', 'north', 'east', 'south', 'west']) {
    assert.ok(place.images[state], `Missing ${id} capture: ${state}`);
  }
}
const winter = places.find(place => place.id === 'stockholm');
for (const state of ['opening', 'day', 'night', 'north', 'east', 'south', 'west']) {
  assert.ok(winter.images[`winter_${state}`], `Missing Stockholm winter ${state}`);
  assert.notEqual(winter.images[`winter_${state}`], winter.images[state]);
}
for (const place of places) {
  for (const [state, url] of Object.entries(place.images)) {
    assert.ok(!url.startsWith('/'), `Use a relative image path in places.json: ${url}`);
    const response = await request(url);
    assert.equal(response.status, 200, `Missing ${place.id} ${state}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    assert.equal(bytes[0], 0xff);
    assert.equal(bytes[1], 0xd8);
  }
}
assert.equal((await request('/missing')).status, 404);
assert.equal((await request('/', 'POST')).status, 405);
assert.equal((await request('/', 'HEAD')).status, 200);
assert.equal(await (await request('/', 'HEAD')).text(), '');
assert.deepEqual(JSON.parse(await readFile(path.join(root, '.openai/hosting.json'), 'utf8')), JSON.parse(await readFile(path.join(root, 'dist/.openai/hosting.json'), 'utf8')));
console.log('PASS: Worker routes, all HTML assets, 49 scene captures, JPEG bytes, request methods, security headers, and hosting metadata.');
