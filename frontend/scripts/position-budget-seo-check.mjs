#!/usr/bin/env node
/**
 * Position Budget SEO — technical Check step (automatable subset of Spec 57 §14 PDCA).
 * Default host: production apex. Override: SEO_CHECK_BASE_URL=https://staging.example.com
 */

import process from 'node:process';

const BASE = (process.env.SEO_CHECK_BASE_URL || 'https://ziso.cc').replace(/\/$/, '');
const PAGE_PATH = '/tools/position-budget';
const pageUrl = `${BASE}${PAGE_PATH}`;

async function fetchText(url) {
  const res = await fetch(url, {
    redirect: 'follow',
    headers: {
      // Avoid some CDNs treating us as bot oddly; harmless for HTML fetch
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'StockWise-SEO-check/1.0 (+scripts/position-budget-seo-check.mjs)',
    },
  });
  const text = await res.text().catch(() => '');
  return { res, text };
}

function run() {
  return (async () => {
    console.log(`[position-budget-seo-check] BASE=${BASE}\n`);

    const { res, text } = await fetchText(pageUrl);
    let failed = false;

    const checks = [
      [`GET ${PAGE_PATH}`, res.ok],
      ['<title> includes "Position Budget"', /<title>[^<]*Position Budget/i.test(text)],
      ['meta description present', /name=["']description["']/i.test(text)],
      ['JSON-LD (application/ld+json)', /application\/ld\+json/i.test(text)],
      ['JSON-LD type SoftwareApplication', /["']SoftwareApplication["']/i.test(text)],
    ];

    for (const [label, ok] of checks) {
      const pass = !!ok;
      console.log(pass ? `  ✔ ${label}` : `  ✖ ${label}`);
      if (!pass) failed = true;
    }

    const sitemapUrl = `${BASE}/sitemap.xml`;
    const sm = await fetch(sitemapUrl, { redirect: 'follow' });
    const smText = sm.ok ? await sm.text() : '';
    const inSitemap = sm.ok && smText.includes('/tools/position-budget');

    console.log(sm.ok ? `  ✔ sitemap fetch ${sitemapUrl}` : `  ✖ sitemap fetch failed (${sm.status})`);
    if (!sm.ok || !inSitemap) {
      console.log('  ✖ sitemap contains /tools/position-budget');
      failed = true;
    } else {
      console.log('  ✔ sitemap contains /tools/position-budget');
    }

    if (failed) {
      console.error('\n[position-budget-seo-check] FAILED\n');
      process.exit(1);
    }
    console.log('\n[position-budget-seo-check] OK\n');
    process.exit(0);
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

run();
