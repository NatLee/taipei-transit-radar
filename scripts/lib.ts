// Shared helpers for the data scripts: polite fetching with retries, gunzip, JSON output.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';

export const USER_AGENT = 'taipei-transit-radar data build (+https://github.com/NatLee/taipei-transit-radar)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetches with a few retries and backoff; tries each URL in `urls` in turn. */
export async function fetchWithRetry(
  urls: string | readonly string[],
  init: RequestInit = {},
  tries = 3,
): Promise<Response> {
  const list = typeof urls === 'string' ? [urls] : urls;
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    for (const url of list) {
      try {
        const res = await fetch(url, { ...init, headers: { 'User-Agent': USER_AGENT, ...init.headers } });
        if (res.ok) return res;
        lastError = new Error(`${url} answered HTTP ${res.status}`);
      } catch (err) {
        lastError = err;
      }
      console.warn(`  ! ${lastError instanceof Error ? lastError.message : String(lastError)}`);
    }
    await sleep(2000 * (attempt + 1));
  }
  throw lastError;
}

/** The Taipei e-bus feed serves gzip bytes as application/octet-stream, with a UTF-8 BOM inside. */
export async function fetchGzipJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url);
  const text = gunzipSync(Buffer.from(await res.arrayBuffer()))
    .toString('utf8')
    .replace(/^\uFEFF/, '');
  return JSON.parse(text) as T;
}

export async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data) + '\n', 'utf8');
}
