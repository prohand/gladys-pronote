// -----------------------------------------------------------------------------
// The fetcher that works around pawnote 1.6.2 on PRONOTE 2026.2: the instance
// page's `Start (…);} catch` breaks pawnote's parser, which then throws
// PageUnavailableError at every login. See src/pronote/fetcher.js.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPronoteFetcher, fixInstancePage } from '../src/pronote/fetcher.js';

// The real shape served by a PRONOTE 2026.2 instance page.
const PAGE_2026 =
  'window.addEventListener("load", () => {try{Start ({"h":4010264,"d":true,"a":6});} catch (e) {IE.sendLogFailStart (4010264, e)}});';
// What pawnote used to receive, and parses correctly on its own.
const PAGE_OLD = 'try{Start ({"h":4010264,"d":true,"a":6})}catch (e) {}';

test('fixInstancePage drops the semicolon PRONOTE 2026.2 adds after Start(…)', () => {
  assert.match(fixInstancePage(PAGE_2026), /Start \(\{"h":4010264,"d":true,"a":6\}\)\} catch/);
});

test('fixInstancePage leaves the older page untouched', () => {
  assert.equal(fixInstancePage(PAGE_OLD), PAGE_OLD);
});

test('fixInstancePage leaves a page without the pattern untouched', () => {
  const page = '<html><body>nothing to fix here</body></html>';
  assert.equal(fixInstancePage(page), page);
});

test('the fetcher fixes the instance page, not the other requests', async () => {
  const seen = [];
  const fakeFetch = async (url) => {
    seen.push(url);
    return { status: 200, text: async () => PAGE_2026, headers: {} };
  };
  const fetcher = createPronoteFetcher(fakeFetch);

  const instance = await fetcher({
    url: new URL('https://0123456a.index-education.net/pronote/mobile.eleve.html'),
  });
  assert.match(instance.content, /\}\)\} catch/);
  assert.doesNotMatch(instance.content, /\}\);\s*\} catch/);

  const api = await fetcher({
    url: new URL('https://0123456a.index-education.net/pronote/appelfonction/6/0/abc'),
    method: 'POST',
    content: 'body',
  });
  // Not the instance page: left exactly as the server sent it.
  assert.equal(api.content, PAGE_2026);
});

test('the fetcher passes method, headers, body and redirect through', async () => {
  let got;
  const fakeFetch = async (href, options) => {
    got = { href, options };
    return { status: 204, text: async () => '', headers: {} };
  };
  const fetcher = createPronoteFetcher(fakeFetch);
  const response = await fetcher({
    url: new URL('https://host/pronote/appelfonction/6/0/x'),
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    content: '{"a":1}',
    redirect: 'manual',
  });

  assert.equal(response.status, 204);
  assert.equal(got.href, 'https://host/pronote/appelfonction/6/0/x');
  assert.equal(got.options.method, 'POST');
  assert.equal(got.options.redirect, 'manual');
  assert.equal(got.options.body, '{"a":1}');
  assert.deepEqual(got.options.headers, { 'Content-Type': 'application/json' });
});
