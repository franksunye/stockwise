import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT_DIR, 'src', 'app');

// Dynamic APIs that force Next.js into request-time rendering
const DYNAMIC_APIS = [
  'headers()',
  'cookies()',
  'unstable_noStore()',
];

// Directories that are ALLOWED to be dynamic
const EXCLUDED_DIRS = [
  '(dashboard)',
  'admin',
  'api',
];

const BANNED_FILES = [
    'layout.tsx',
    'page.tsx'
];

function checkFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(ROOT_DIR, filePath);
    
    const violations = DYNAMIC_APIS.filter(api => content.includes(api));
    
    if (violations.length > 0) {
        console.error(`\x1b[31m[SSG Safety Violation]\x1b[0m ${relativePath} contains dynamic APIs: ${violations.join(', ')}`);
        return false;
    }
    return true;
}

function walk(dir, results = []) {
    const list = fs.readdirSync(dir);
    for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        
        // Skip excluded directories
        if (stat.isDirectory() && EXCLUDED_DIRS.includes(file)) {
            continue;
        }

        if (stat.isDirectory()) {
            walk(fullPath, results);
        } else if (BANNED_FILES.includes(file)) {
            results.push(fullPath);
        }
    }
    return results;
}

console.log('--- SSG Safety Check: Auditing public routes for dynamic rendering leaks ---');

try {
    const filesToAudit = walk(APP_DIR);
    let hasError = false;

    for (const file of filesToAudit) {
        if (!checkFile(file)) {
            hasError = true;
        }
    }

    if (hasError) {
        console.error('\n\x1b[31mERROR: Found dynamic rendering APIs in static-critical paths.\x1b[0m');
        console.error('These must be removed to ensure the public site remains SSG (market-speed & SEO).\n');
        process.exit(1);
    } else {
        console.log('\x1b[32m✔ All public routes are safe from dynamic rendering leaks.\x1b[0m\n');
    }
} catch (error) {
    console.error('Failed to run SSG safety check:', error);
    process.exit(1);
}
