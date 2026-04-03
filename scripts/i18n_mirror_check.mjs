import fs from 'fs';
import path from 'path';

const CONTENT_BASE = 'docs/4_Growth_Ops/content';
const CN_DIR = path.join(CONTENT_BASE, 'cn/101_academy');
const EN_DIR = path.join(CONTENT_BASE, 'en/101_academy');

function getFrontmatter(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const match = content.match(/^---([\s\S]*?)---/);
    if (!match) return {};
    const yaml = match[1];
    const metadata = {};
    yaml.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
            metadata[key.trim()] = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
        }
    });
    return metadata;
}

function checkMirror() {
    console.log('🔍 Starting i18n Mirror Integrity Check...\n');

    if (!fs.existsSync(CN_DIR) || !fs.existsSync(EN_DIR)) {
        console.error('Error: Directories not found.');
        return;
    }

    const cnFiles = fs.readdirSync(CN_DIR).filter(f => f.endsWith('.md'));
    const enFiles = fs.readdirSync(EN_DIR).filter(f => f.endsWith('.md'));

    const cnMap = new Map();
    const enMap = new Map();

    cnFiles.forEach(file => {
        const metadata = getFrontmatter(path.join(CN_DIR, file));
        const id = metadata.content_id || file.split('_')[0]; // Fallback to 101-01 style
        if (id) {
            cnMap.set(id, { file, title: metadata.title });
        }
    });

    enFiles.forEach(file => {
        const metadata = getFrontmatter(path.join(EN_DIR, file));
        const id = metadata.content_id || file.split('_')[0]; // Fallback to 101-01 style
        if (id) {
            enMap.set(id, { file, title: metadata.title });
        }
    });

    console.log(`📊 Statistics:`);
    console.log(`   - CN 101 Academy Assets: ${cnMap.size}`);
    console.log(`   - EN 101 Academy Assets: ${enMap.size}`);
    console.log(`   - Mirror Coverage: ${((enMap.size / cnMap.size) * 100).toFixed(1)}%\n`);

    console.log('❌ Missing EN Mirror (Top 20 Critical):');
    let count = 0;
    for (const [id, data] of cnMap.entries()) {
        if (!enMap.has(id)) {
            console.log(`   - [${id}] ${data.title} (${data.file})`);
            count++;
            if (count >= 20) break;
        }
    }

    if (count > 20) {
        console.log(`   ... and ${cnMap.size - enMap.size - 20} more.`);
    }

    console.log('\n✅ Check Complete.');
}

checkMirror();
