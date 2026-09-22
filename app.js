export const REPO = 'impleotv/license-center-release';
export const RELEASES_URL = `https://github.com/${REPO}/releases`;
export const PAGE_SIZE = 10;
export const packages = [
  {name: 'license-center-amd64-installer.exe', label: 'Windows installer', group: 'desktop', description: 'Recommended. Signed setup for Windows x64, including WebView2 setup.'},
  {name: 'license-center.exe', label: 'Windows executable', group: 'desktop', description: 'Signed standalone desktop app for Windows x64. Requires WebView2 Runtime.'},
  {name: version => `license-center_${version}_all.deb`, label: 'Debian / Ubuntu', group: 'server', description: 'Managed Docker deployment for Linux AMD64 and ARM64. Requires Docker and Compose v2.'},
  {name: 'license-center-server-linux-amd64', label: 'Linux AMD64', group: 'server', description: 'Standalone server for Intel and AMD 64-bit systems.'},
  {name: 'license-center-server-linux-arm64', label: 'Linux ARM64', group: 'server', description: 'Standalone server for 64-bit ARM systems.'},
  {name: 'license-center-server-windows-amd64.exe', label: 'Windows server', group: 'server', description: 'Standalone server for Windows x64. Serves the browser console.'},
];

export function stableReleases(releases) {
  return releases.filter(r => !r.draft && !r.prerelease && /^v\d+\.\d+\.\d+$/.test(r.tag_name))
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at));
}

export async function fetchReleases(fetcher = fetch) {
  const releases = [];
  for (let page = 1; page <= 100; page++) {
    const response = await fetcher(`https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`, {
      headers: {Accept: 'application/vnd.github+json'}, signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) throw new Error(`GitHub returned HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error('Unexpected release response');
    releases.push(...batch);
    if (batch.length < 100) return stableReleases(releases);
  }
  throw new Error('Release history exceeded the supported limit. Use GitHub releases.');
}

export function assetFor(release, name) {
  const resolved = typeof name === 'function' ? name(release?.tag_name.replace(/^v/, '')) : name;
  return release?.assets?.find(asset => asset.name === resolved && asset.browser_download_url?.startsWith(`${RELEASES_URL}/download/`));
}

export function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function link(asset, label, className = 'text-link') {
  return asset ? `<a class="${className}" href="${escapeHtml(asset.browser_download_url)}">${escapeHtml(label)}</a>` : '<span class="unavailable">Not available</span>';
}

function notesUrl(release) { return `${RELEASES_URL}/tag/${encodeURIComponent(release.tag_name)}`; }
function formatDate(date) { return new Intl.DateTimeFormat(undefined, {year: 'numeric', month: 'short', day: 'numeric'}).format(new Date(date)); }
function formatBytes(bytes) { return Number.isFinite(bytes) ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : ''; }

export function renderCard(pkg, release) {
  const asset = assetFor(release, pkg.name);
  const icon = pkg.label.startsWith('Windows') ? 'windows' : 'linux';
  return `<article class="download-card"><img class="card-icon" src="assets/platform-${icon}.svg" alt="" width="44" height="44"><h3>${pkg.label}</h3><p>${pkg.description}</p>${link(asset, `Download ${pkg.label}`, 'download-button')}${asset ? `<p class="asset-size">${escapeHtml(asset.name)} · ${formatBytes(asset.size)}</p>` : ''}</article>`;
}

export function renderHistory(releases, page) {
  return releases.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(release => `<tr><td><span class="version-name">${escapeHtml(release.tag_name)}</span></td><td>${formatDate(release.published_at)}</td><td><div class="asset-links">${packages.map(pkg => {
    const asset = assetFor(release, pkg.name);
    return asset ? link(asset, pkg.label, 'asset-link') : `<span class="asset-link muted">${pkg.label} unavailable</span>`;
  }).join('')}</div></td><td><a class="text-link" href="${notesUrl(release)}">Release notes</a><br>${link(assetFor(release, 'SHA256SUMS.txt'), 'Checksums')}</td></tr>`).join('');
}

export async function init(doc = document, fetcher = fetch) {
  const select = name => doc.querySelector(`[data-${name}]`);
  let older = [], page = 0;
  const updateHistory = () => {
    select('version-rows').innerHTML = older.length ? renderHistory(older, page) : '<tr><td colspan="4">No older stable releases yet.</td></tr>';
    select('page-status').textContent = older.length ? `Page ${page + 1} of ${Math.ceil(older.length / PAGE_SIZE)}` : '';
    select('previous').disabled = page === 0;
    select('next').disabled = (page + 1) * PAGE_SIZE >= older.length;
  };
  select('previous').addEventListener('click', () => { if (page > 0) { page--; updateHistory(); } });
  select('next').addEventListener('click', () => { if ((page + 1) * PAGE_SIZE < older.length) { page++; updateHistory(); } });
  const renderPackages = latest => {
    for (const group of ['desktop', 'server']) select(`${group}-grid`).innerHTML = packages.filter(pkg => pkg.group === group).map(pkg => renderCard(pkg, latest)).join('');
  };
  try {
    const releases = await fetchReleases(fetcher);
    const latest = releases[0];
    if (!latest) {
      select('latest-version').textContent = 'Coming soon';
      select('latest-date').textContent = 'No stable releases yet';
      select('status-message').textContent = 'No stable License Center releases have been published yet.';
      renderPackages(null);
      updateHistory();
      return;
    }
    select('latest-version').textContent = latest.tag_name;
    select('latest-date').textContent = formatDate(latest.published_at);
    select('latest-notes').href = notesUrl(latest);
    select('checksums').innerHTML = link(assetFor(latest, 'SHA256SUMS.txt'), 'Download checksums');
    select('status-message').textContent = `Showing packages from ${latest.tag_name}.`;
    select('deb-command').textContent = `sudo apt install ./license-center_${latest.tag_name.slice(1)}_all.deb\nsudo license-centerctl configure`;
    renderPackages(latest);
    older = releases.slice(1);
    updateHistory();
  } catch {
    select('latest-version').textContent = 'Unavailable';
    select('latest-date').textContent = 'Release lookup unavailable';
    select('status-message').textContent = 'Could not load GitHub releases. Use the GitHub releases link below to download License Center.';
    renderPackages(null);
    select('version-rows').innerHTML = `<tr><td colspan="4">Release history could not be loaded. <a href="${RELEASES_URL}">Open GitHub releases</a>.</td></tr>`;
  }
}

if (typeof document !== 'undefined') init();
