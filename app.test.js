import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {RELEASES_URL, assetFor, fetchReleases, init, packages, renderCard, stableReleases} from './app.js';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const fixture = (version = '1.2.0', date = '2026-09-20T12:00:00Z') => ({
  tag_name: `v${version}`, published_at: date, draft: false, prerelease: false,
  assets: [...packages.map(pkg => typeof pkg.name === 'function' ? pkg.name(version) : pkg.name), 'SHA256SUMS.txt']
    .map(name => ({name, size: 12000, browser_download_url: `${RELEASES_URL}/download/v${version}/${name}`})),
});
const response = data => ({ok: true, json: async () => data});
const documentFor = () => new JSDOM(html, {url: 'https://impleotv.github.io/license-center-release/'}).window.document;

test('stable releases use publication date and exclude drafts and prereleases', () => {
  assert.deepEqual(stableReleases([fixture('2.0.0', '2026-08-01'), fixture(), {...fixture('3.0.0'), draft: true}, {...fixture('4.0.0'), prerelease: true}]).map(r => r.tag_name), ['v1.2.0', 'v2.0.0']);
});
test('all five package names match exactly and internal assets are not matched', () => {
  const release = fixture();
  assert.equal(packages.length, 5);
  assert.ok(!packages.some(pkg => pkg.name === 'license-center.exe'));
  for (const pkg of packages) assert.ok(assetFor(release, pkg.name));
  release.assets = [{name: 'license-center-windows-signing.zip'}, {name: 'other-license-center.exe'}];
  for (const pkg of packages) assert.equal(assetFor(release, pkg.name), undefined);
  assert.match(renderCard(packages[0], release), /Not available/);
});
test('unsafe asset URLs are not rendered', () => {
  const release = fixture();
  release.assets[0].browser_download_url = 'javascript:alert(1)';
  assert.equal(assetFor(release, packages[0].name), undefined);
});
test('fetches all GitHub pages before selecting latest by publication date', async () => {
  const calls = [];
  const releases = await fetchReleases(async url => {
    calls.push(url);
    return response(calls.length === 1 ? Array.from({length: 100}, (_, i) => fixture(`1.0.${i}`, '2026-08-01')) : [fixture('2.0.0')]);
  });
  assert.equal(calls.length, 2);
  assert.match(calls[1], /page=2$/);
  assert.equal(releases[0].tag_name, 'v2.0.0');
});
test('latest renders all downloads, checksums and versioned installation instructions', async () => {
  const doc = documentFor();
  await init(doc, async () => response([fixture()]));
  assert.equal(doc.querySelector('[data-latest-version]').textContent, 'v1.2.0');
  assert.equal(doc.querySelectorAll('.download-button').length, 5);
  assert.match(doc.querySelector('[data-checksums] a').href, /SHA256SUMS.txt$/);
  assert.match(doc.querySelector('[data-deb-command]').textContent, /license-center_1.2.0_all.deb/);
  assert.match(doc.querySelector('[data-version-rows]').textContent, /No older/);
});
test('history pagination omits latest and navigates both directions', async () => {
  const doc = documentFor();
  const releases = Array.from({length: 13}, (_, i) => fixture(`1.0.${i}`, new Date(Date.UTC(2026, 8, i + 1)).toISOString()));
  await init(doc, async () => response(releases));
  const rows = () => doc.querySelectorAll('[data-version-rows] tr');
  assert.equal(rows().length, 10);
  assert.doesNotMatch(doc.querySelector('[data-version-rows]').textContent, /v1\.0\.12/);
  doc.querySelector('[data-next]').click();
  assert.equal(rows().length, 2);
  assert.equal(doc.querySelector('[data-next]').disabled, true);
  doc.querySelector('[data-previous]').click();
  assert.equal(rows().length, 10);
});
test('empty release list differs from API failures and retains fallback', async () => {
  const empty = documentFor();
  await init(empty, async () => response([]));
  assert.equal(empty.querySelector('[data-latest-version]').textContent, 'Coming soon');
  for (const fetcher of [async () => ({ok: false, status: 403}), async () => {throw new Error('offline');}, async () => response({message: 'invalid'})]) {
    const doc = documentFor();
    await init(doc, fetcher);
    assert.equal(doc.querySelector('[data-latest-version]').textContent, 'Unavailable');
    assert.match(doc.querySelector('[data-status-message]').textContent, /Could not load/);
    assert.equal(doc.querySelector('.fallback a').href, RELEASES_URL);
    assert.equal(doc.querySelectorAll('.download-button').length, 0);
  }
});
