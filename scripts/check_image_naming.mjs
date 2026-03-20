#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const TARGET_GLOB_HINT = 'docs/4_Growth_Ops/content/101_academy/101-*.md';

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  return YAML.parse(match[1]) || {};
}

function collectImagePaths(frontmatter) {
  const result = [];
  if (frontmatter?.image) result.push(frontmatter.image);
  const images = frontmatter?.images || {};
  if (images.cover) result.push(images.cover);
  if (Array.isArray(images.body)) result.push(...images.body);
  if (Array.isArray(images.cards)) result.push(...images.cards);
  return result.filter(Boolean);
}

function isWellNamed(stem, imagePath) {
  const base = path.basename(String(imagePath));
  return base.startsWith(`${stem}_`) || base === `${stem}.png`;
}

function main() {
  const root = process.cwd();
  const academyDir = path.join(root, 'docs', '4_Growth_Ops', 'content', '101_academy');
  const files = walk(academyDir).filter((f) => /\/101-\d+_.+\.md$/.test(f));

  const issues = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const fm = parseFrontmatter(content);
    if (!fm) continue;

    const stem = path.basename(file, '.md');
    const paths = collectImagePaths(fm);
    for (const p of paths) {
      if (!isWellNamed(stem, p)) {
        issues.push({ file, image: p, expectedPrefix: `${stem}_` });
      }
    }
  }

  if (issues.length === 0) {
    console.log('OK: image naming is consistent with article filenames.');
    console.log(`Checked in ${TARGET_GLOB_HINT}`);
    return;
  }

  console.error(`Found ${issues.length} naming issue(s):`);
  for (const issue of issues) {
    console.error(`- ${issue.file}`);
    console.error(`  image: ${issue.image}`);
    console.error(`  expected prefix: ${issue.expectedPrefix}`);
  }
  process.exit(1);
}

main();
