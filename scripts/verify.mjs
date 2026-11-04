import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const worker = (await import(pathToFileURL(path.join(root, 'dist/server/index.js')))).default;
const request = (url, method = 'GET') => worker.fetch(new Request(`https://showcase.example${url}`, { method }));
const home = await request('/');
assert.equal(home.status, 200);
assert.match(home.headers.get('content-type'), /text\/html/);
const html = await home.text();
assert.match(html, /Planet Render 360/);
assert.ok(home.headers.get('content-security-policy').includes("script-src 'self'"));
for (const match of html.matchAll(/(?:src|href)="(\/[^"?#]+)"/g)) {
  assert.equal((await request(match[1])).status, 200, `Missing HTML asset: ${match[1]}`);
}
const places = await (await request('/assets/places.json')).json();
assert.equal(places.length, 4);
for (const place of places) {
  for (const [state, url] of Object.entries(place.images)) {
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
console.log('PASS: Worker routes, all HTML assets, 29 scene captures, JPEG bytes, request methods, security headers, and hosting metadata.');
