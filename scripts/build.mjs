import { mkdir, readdir, readFile, rm, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const mimeTypes = {
  '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
};
async function collect(directory, prefix = '') {
  const files = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(files, await collect(filename, relative));
    else files[`/${relative}`] = { type: mimeTypes[path.extname(entry.name)] || 'application/octet-stream', body: (await readFile(filename)).toString('base64') };
  }
  return files;
}
const files = await collect(path.join(root, 'public'));
const worker = `const files = ${JSON.stringify(files)};
export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', {status: 405, headers: {Allow: 'GET, HEAD'}});
    const file = files[url.pathname === '/' ? '/index.html' : url.pathname];
    if (!file) return new Response('Not found', {status: 404});
    const headers = {
      'Content-Type': file.type,
      'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com; form-action 'none'"
    };
    if (request.method === 'HEAD') return new Response(null, {headers});
    const body = Uint8Array.from(atob(file.body), char => char.charCodeAt(0));
    return new Response(body, {headers});
  }
};
`;
await rm(path.join(root, 'dist'), { recursive: true, force: true });
await mkdir(path.join(root, 'dist/server'), { recursive: true });
await mkdir(path.join(root, 'dist/.openai'), { recursive: true });
await writeFile(path.join(root, 'dist/server/index.js'), worker);
await copyFile(path.join(root, '.openai/hosting.json'), path.join(root, 'dist/.openai/hosting.json'));
console.log(`Built ${Object.keys(files).length} files into a dependency-free Sites Worker (${(Buffer.byteLength(worker) / 1024 / 1024).toFixed(2)} MB).`);
