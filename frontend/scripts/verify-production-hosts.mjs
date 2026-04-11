const SITE_URL = (process.env.VERIFY_SITE_URL || 'https://ziso.cc').replace(/\/$/, '');
const WWW_URL = (process.env.VERIFY_WWW_URL || 'https://www.ziso.cc').replace(/\/$/, '');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function fetchWithManualRedirect(url) {
  const response = await fetch(url, { redirect: 'manual' });
  return response;
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function extractCanonical(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || null;
}

function extractHtmlLang(html) {
  return html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] || null;
}

function extractAlternateLinks(html) {
  return [...html.matchAll(/<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["'][^>]+href=["']([^"']+)["']/gi)]
    .map((match) => ({ hreflang: match[1], href: match[2] }));
}

async function verifyRedirect(pathname) {
  const response = await fetchWithManualRedirect(`${WWW_URL}${pathname}`);
  assert([301, 308].includes(response.status), `Expected permanent redirect for ${pathname}, got ${response.status}`);
  const location = response.headers.get('location');
  assert(location === `${SITE_URL}${pathname}`, `Expected ${pathname} redirect to ${SITE_URL}${pathname}, got ${location}`);
}

async function verifyRobots() {
  const response = await fetch(`${SITE_URL}/robots.txt`);
  const body = await response.text();
  assert(response.status === 200, `robots.txt expected 200, got ${response.status}`);
  const normalized = normalizeWhitespace(body);
  assert(normalized.includes(`Host: ${SITE_URL}`), `robots.txt Host mismatch: ${normalized}`);
  assert(normalized.includes(`Sitemap: ${SITE_URL}/sitemap.xml`), `robots.txt Sitemap mismatch: ${normalized}`);
}

async function verifySitemap() {
  const response = await fetch(`${SITE_URL}/sitemap.xml`);
  const body = await response.text();
  assert(response.status === 200, `sitemap.xml expected 200, got ${response.status}`);
  const locs = [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  assert(locs.length > 0, 'sitemap.xml has no <loc> entries');
  const invalid = locs.filter((loc) => !loc.startsWith(`${SITE_URL}/`) && loc !== SITE_URL);
  assert(invalid.length === 0, `sitemap.xml contains non-canonical locs: ${invalid.slice(0, 5).join(', ')}`);
}

async function verifyAsset(pathname) {
  const response = await fetch(`${SITE_URL}${pathname}`);
  assert(response.status === 200, `${pathname} expected 200, got ${response.status}`);
}

async function verifyPage(pathname, expectedLang) {
  const response = await fetch(`${SITE_URL}${pathname}`);
  const html = await response.text();
  assert(response.status === 200, `${pathname} expected 200, got ${response.status}`);

  const canonical = extractCanonical(html);
  assert(canonical === `${SITE_URL}${pathname}`, `${pathname} canonical mismatch: ${canonical}`);

  const alternates = extractAlternateLinks(html);
  assert(alternates.length > 0, `${pathname} missing hreflang alternates`);
  const invalidAlternate = alternates.find((item) => !item.href.startsWith(`${SITE_URL}/`) && item.href !== SITE_URL);
  assert(!invalidAlternate, `${pathname} has non-canonical hreflang target: ${invalidAlternate?.href}`);

  const htmlLang = extractHtmlLang(html);
  assert(htmlLang === expectedLang, `${pathname} html lang mismatch: expected ${expectedLang}, got ${htmlLang}`);
}

async function main() {
  console.log(`Verifying production host contract for ${SITE_URL} (www alias: ${WWW_URL})`);

  await verifyRedirect('/robots.txt');
  await verifyRedirect('/sitemap.xml');
  await verifyRedirect('/llms.txt');

  await verifyRobots();
  await verifySitemap();
  await verifyAsset('/llms.txt');
  await verifyAsset('/logo.png');

  await verifyPage('/', 'en');
  await verifyPage('/pricing', 'en');
  await verifyPage('/cn', 'zh-CN');
  await verifyPage('/es', 'es');
  await verifyPage('/ko', 'ko');

  console.log('Production host verification passed.');
}

main().catch((error) => {
  console.error(`Production host verification failed: ${error.message}`);
  process.exit(1);
});
