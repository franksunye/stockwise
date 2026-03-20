#!/usr/bin/env node

import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import YAML from 'yaml';

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_URL = process.env.GRSAI_BASE_URL || 'https://grsaiapi.com';
const DEFAULT_MODEL = 'nano-banana-fast';
const DEFAULT_IMAGE_SIZE = '1K';
const DEFAULT_ASPECT_RATIO = 'auto';
const DEFAULT_POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 180000;
const DEFAULT_ASSET_FILE =
  'docs/4_Growth_Ops/content/101_academy/101-68_general_llm_illusion.md';
const DEFAULT_PUBLIC_DIR = 'frontend/public';
const DEFAULT_ENV_FILE = '.env.local';
const SUPPORTED_TASKS = ['cover', 'body-1', 'body-2', 'card-1', 'card-2'];
const SUPPORTED_MODES = ['auto', 'text2image', 'image2image'];
const REFERENCE_KEYS_FALLBACK = [
  'urls',
  'image_url',
  'image',
  'input_image',
  'reference_image',
  'reference_image_url',
  'image_urls',
  'input_images',
];

function printHelp() {
  console.log(`
Usage:
  node scripts/grsai_generate_image.mjs --prompt "..." [options]
  node scripts/grsai_generate_image.mjs --from-asset [options]

Required:
  One of:
    --prompt                 Image prompt text
    --from-asset             Load prompt/output from article frontmatter

Options:
  --asset-file               Markdown asset path (default: ${DEFAULT_ASSET_FILE})
  --task                     cover | body-1 | body-2 | card-1 | card-2 (default: cover)
  --mode                     auto | text2image | image2image (default: auto)
  --reference                Reference image URL or local file path (for image2image)
  --reference-key            Preferred request key for reference image (default: urls)
  --output                   Local output path for downloaded image
  --model                    Model name, default: ${DEFAULT_MODEL}
  --image-size               Image size, default: ${DEFAULT_IMAGE_SIZE}
  --aspect-ratio             Aspect ratio, default: ${DEFAULT_ASPECT_RATIO}
  --base-url                 API host, default: ${DEFAULT_BASE_URL}
  --poll-interval            Poll interval in ms, default: ${DEFAULT_POLL_INTERVAL_MS}
  --timeout                  Timeout in ms, default: ${DEFAULT_TIMEOUT_MS}
  --force                    Regenerate even if output file already exists
  --dry-run                  Print request payload only, do not call API
  --help                     Show this message

Environment:
  GRSAI_API_KEY              Required API key
  GRSAI_BASE_URL             Optional API host override

Examples:
  node scripts/grsai_generate_image.mjs --from-asset --task cover

  node scripts/grsai_generate_image.mjs --from-asset --task body-1 \\
    --mode image2image

  node scripts/grsai_generate_image.mjs \\
    --prompt "一张黑底高对比的财经概念图，机械小龙虾钳握住方向盘，刹车线断裂" \\
    --output tmp/nano-banana-cover.png
`);
}

function parseArgs(argv) {
  const args = {
    model: DEFAULT_MODEL,
    imageSize: DEFAULT_IMAGE_SIZE,
    aspectRatio: DEFAULT_ASPECT_RATIO,
    baseUrl: DEFAULT_BASE_URL,
    assetFile: DEFAULT_ASSET_FILE,
    task: 'cover',
    mode: 'auto',
    fromAsset: false,
    referenceKey: 'urls',
    pollInterval: DEFAULT_POLL_INTERVAL_MS,
    timeout: DEFAULT_TIMEOUT_MS,
    force: false,
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--prompt':
        args.prompt = next;
        i += 1;
        break;
      case '--from-asset':
        args.fromAsset = true;
        break;
      case '--asset-file':
        args.assetFile = next;
        i += 1;
        break;
      case '--task':
        args.task = next;
        i += 1;
        break;
      case '--mode':
        args.mode = next;
        i += 1;
        break;
      case '--reference':
        args.reference = next;
        i += 1;
        break;
      case '--reference-key':
        args.referenceKey = next;
        i += 1;
        break;
      case '--output':
        args.output = next;
        i += 1;
        break;
      case '--model':
        args.model = next;
        i += 1;
        break;
      case '--image-size':
        args.imageSize = next;
        i += 1;
        break;
      case '--aspect-ratio':
        args.aspectRatio = next;
        i += 1;
        break;
      case '--base-url':
        args.baseUrl = next;
        i += 1;
        break;
      case '--poll-interval':
        args.pollInterval = Number(next);
        i += 1;
        break;
      case '--timeout':
        args.timeout = Number(next);
        i += 1;
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--force':
        args.force = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`);
    }
  }
  return args;
}

function parseFrontmatter(markdownText) {
  const match = markdownText.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) throw new Error('Markdown frontmatter not found');
  return YAML.parse(match[1]) || {};
}

async function loadEnvFileIfPresent(envFilePath = DEFAULT_ENV_FILE) {
  if (process.env.GRSAI_API_KEY || !existsSync(envFilePath)) return;
  const raw = await fs.readFile(envFilePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, valueRaw] = match;
    let value = valueRaw.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function dedupePrefix(prefix, prompt) {
  if (!prefix || !prompt) return String(prompt || '');
  const normalizedPrefix = String(prefix).trim();
  const normalizedPrompt = String(prompt).trim();
  if (!normalizedPrefix || !normalizedPrompt) return normalizedPrompt;
  if (normalizedPrompt.startsWith(normalizedPrefix)) return normalizedPrompt;
  if (
    normalizedPrompt.includes('Premium editorial finance style') &&
    normalizedPrefix.includes('Premium editorial finance style')
  ) {
    return normalizedPrompt;
  }
  return `${normalizedPrefix}\n\n${normalizedPrompt}`;
}

function resolveLocalOutputPath(outputPath) {
  if (!outputPath) return outputPath;
  if (path.isAbsolute(outputPath) && outputPath.startsWith('/images/')) {
    return path.join(DEFAULT_PUBLIC_DIR, outputPath.slice(1));
  }
  return outputPath;
}

function pickAspectRatioByTask(task, fallback) {
  if (fallback && fallback !== DEFAULT_ASPECT_RATIO) return fallback;
  if (task === 'cover') return '16:9';
  if (task.startsWith('card-')) return '3:4';
  return '3:2';
}

function buildAssetPrompt(frontmatter, task) {
  const prefix = frontmatter?.visual_style_prefix || '';
  const imagePrompts = frontmatter?.image_prompts || {};
  const derivative = frontmatter?.derivative_guidance || {};

  if (task === 'cover') {
    const coverPrompt = imagePrompts?.cover;
    if (!coverPrompt) throw new Error('Missing image_prompts.cover in asset frontmatter');
    return dedupePrefix(prefix, coverPrompt);
  }

  if (task.startsWith('body-')) {
    const index = Number(task.split('-')[1]) - 1;
    const bodyGuidance = derivative?.body?.[index];
    if (!bodyGuidance) {
      throw new Error(`Missing derivative_guidance.body[${index}] in asset frontmatter`);
    }
    return dedupePrefix(prefix, bodyGuidance);
  }

  if (task.startsWith('card-')) {
    const index = Number(task.split('-')[1]) - 1;
    const cardGuidance = derivative?.cards?.[index];
    if (!cardGuidance) {
      throw new Error(`Missing derivative_guidance.cards[${index}] in asset frontmatter`);
    }
    return dedupePrefix(prefix, cardGuidance);
  }

  throw new Error(`Unsupported task: ${task}`);
}

function pickAssetOutput(frontmatter, task) {
  const images = frontmatter?.images || {};
  if (task === 'cover') return images?.cover || frontmatter?.image || null;
  if (task.startsWith('body-')) {
    const index = Number(task.split('-')[1]) - 1;
    return images?.body?.[index] || null;
  }
  if (task.startsWith('card-')) {
    const index = Number(task.split('-')[1]) - 1;
    return images?.cards?.[index] || null;
  }
  return null;
}

function pickAssetCoverPath(frontmatter) {
  return resolveLocalOutputPath(frontmatter?.images?.cover || frontmatter?.image || null);
}

function pickTaskMode(mode, task) {
  if (mode !== 'auto') return mode;
  return task === 'cover' ? 'text2image' : 'image2image';
}

function isUrl(value) {
  return typeof value === 'string' && /^https?:\/\//.test(value);
}

async function fileToDataUrl(filePath) {
  const bytes = await fs.readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

async function resolveReferenceData(referenceInput) {
  if (!referenceInput) return null;
  if (isUrl(referenceInput) || referenceInput.startsWith('data:image/')) return referenceInput;
  const localPath = resolveLocalOutputPath(referenceInput);
  if (!existsSync(localPath)) return null;
  return fileToDataUrl(localPath);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickTaskId(payload) {
  return (
    payload?.task_id ||
    payload?.taskId ||
    payload?.id ||
    payload?.data?.task_id ||
    payload?.data?.taskId ||
    payload?.data?.id ||
    null
  );
}

function collectImageCandidates(value, out = []) {
  if (!value) return out;
  if (typeof value === 'string') {
    if (
      value.startsWith('http://') ||
      value.startsWith('https://') ||
      value.startsWith('data:image/')
    ) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectImageCandidates(item, out);
    return out;
  }
  if (typeof value === 'object') {
    const preferredKeys = [
      'image',
      'image_url',
      'imageUrl',
      'url',
      'src',
      'b64_json',
      'images',
      'image_urls',
      'imageUrls',
      'output',
      'outputs',
      'result',
      'results',
      'data',
    ];
    for (const key of preferredKeys) {
      if (key in value) collectImageCandidates(value[key], out);
    }
    for (const nested of Object.values(value)) collectImageCandidates(nested, out);
  }
  return [...new Set(out)];
}

function pickStatus(payload) {
  return (
    payload?.status ||
    payload?.data?.status ||
    payload?.result?.status ||
    payload?.task_status ||
    null
  );
}

function isFinishedStatus(status) {
  if (!status) return false;
  return ['success', 'completed', 'finished', 'done', 'succeeded'].includes(
    String(status).toLowerCase(),
  );
}

function isFailedStatus(status) {
  if (!status) return false;
  return ['failed', 'error', 'cancelled'].includes(String(status).toLowerCase());
}

async function requestJson(url, apiKey, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    // Handle SSE-like payloads: lines in form "data: {...}"
    const sseMatches = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.replace(/^data:\s*/, '').trim())
      .filter(Boolean);

    if (sseMatches.length > 0) {
      const last = sseMatches[sseMatches.length - 1];
      try {
        json = JSON.parse(last);
      } catch {
        throw new Error(`Non-JSON SSE payload from ${url}: ${last.slice(0, 300)}`);
      }
    } else {
      throw new Error(`Non-JSON response from ${url}: ${text.slice(0, 300)}`);
    }
  }
  if (!response.ok) {
    throw new Error(
      `Request failed ${response.status} ${response.statusText}: ${JSON.stringify(json)}`,
    );
  }
  return json;
}

async function saveImage(candidate, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  if (candidate.startsWith('data:image/')) {
    const [, , data] = candidate.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/) || [];
    if (!data) throw new Error('Unsupported data URL image payload');
    await fs.writeFile(outputPath, Buffer.from(data, 'base64'));
    return;
  }

  let lastError = null;

  try {
    const response = await fetch(candidate);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
    return;
  } catch (error) {
    lastError = error;
  }

  try {
    await execFileAsync('curl', [
      '-L',
      '--fail',
      '--silent',
      '--show-error',
      '--insecure',
      candidate,
      '-o',
      outputPath,
    ]);
    return;
  } catch (error) {
    lastError = error;
  }

  try {
    await execFileAsync('python3', [
      '-c',
      [
        'import ssl, sys, urllib.request',
        'url = sys.argv[1]',
        'out = sys.argv[2]',
        'ctx = ssl._create_unverified_context()',
        'with urllib.request.urlopen(url, context=ctx, timeout=60) as r:',
        '    data = r.read()',
        "with open(out, 'wb') as f:",
        '    f.write(data)',
      ].join('\n'),
      candidate,
      outputPath,
    ]);
    return;
  } catch (error) {
    lastError = error;
  }

  throw lastError || new Error('Failed to download image');
}

function buildBasePayload(args, prompt) {
  return {
    model: args.model,
    prompt,
    imageSize: args.imageSize,
    aspectRatio: args.aspectRatio,
  };
}

function injectReference(payload, referenceKey, referenceData) {
  const next = { ...payload };
  if (referenceKey.endsWith('s')) {
    next[referenceKey] = [referenceData];
  } else {
    next[referenceKey] = referenceData;
  }
  return next;
}

async function submitWithFallback(args, apiKey, payloadBase, mode, referenceData) {
  const submitUrl = `${args.baseUrl}/v1/draw/nano-banana`;
  const keysToTry = mode === 'image2image'
    ? [args.referenceKey, ...REFERENCE_KEYS_FALLBACK.filter((k) => k !== args.referenceKey)]
    : [null];

  let lastError = null;
  for (const key of keysToTry) {
    const payload = key ? injectReference(payloadBase, key, referenceData) : payloadBase;
    try {
      const result = await requestJson(submitUrl, apiKey, payload);
      return { submitResult: result, payloadUsed: payload, referenceKeyUsed: key };
    } catch (error) {
      lastError = error;
      if (mode !== 'image2image') throw error;
      const message = String(error.message || '');
      const isPayloadError = /invalid|unknown|parameter|field|image|reference|400|422/i.test(message);
      if (!isPayloadError) throw error;
    }
  }
  throw lastError || new Error('Failed to submit image task');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) return void printHelp();
  await loadEnvFileIfPresent();

  if (!args.prompt && !args.fromAsset) {
    throw new Error('Missing required input: use --prompt or --from-asset');
  }
  if (!SUPPORTED_TASKS.includes(args.task)) {
    throw new Error(`Invalid --task value "${args.task}". Supported: ${SUPPORTED_TASKS.join(', ')}`);
  }
  if (!SUPPORTED_MODES.includes(args.mode)) {
    throw new Error(`Invalid --mode value "${args.mode}". Supported: ${SUPPORTED_MODES.join(', ')}`);
  }

  let prompt = args.prompt;
  let output = resolveLocalOutputPath(args.output);
  let reference = args.reference;
  let frontmatter = null;

  if (args.fromAsset) {
    if (!existsSync(args.assetFile)) throw new Error(`Asset file not found: ${args.assetFile}`);
    const markdown = await fs.readFile(args.assetFile, 'utf8');
    frontmatter = parseFrontmatter(markdown);
    prompt = buildAssetPrompt(frontmatter, args.task);
    if (!output) output = resolveLocalOutputPath(pickAssetOutput(frontmatter, args.task));
    args.aspectRatio = pickAspectRatioByTask(args.task, args.aspectRatio);
    if (!reference && args.task !== 'cover') {
      reference = pickAssetCoverPath(frontmatter);
    }
    console.log(`Using asset: ${args.assetFile}`);
    console.log(`Task: ${args.task}`);
    if (output) console.log(`Resolved output: ${output}`);
  }

  if (!prompt) throw new Error('Prompt is empty after resolving input');

  const mode = pickTaskMode(args.mode, args.task);
  let referenceData = null;
  if (mode === 'image2image') {
    referenceData = await resolveReferenceData(reference);
    if (!referenceData) {
      throw new Error(
        'Image2image mode requires a valid reference image. Provide --reference URL/path, or ensure asset cover exists locally.',
      );
    }
    console.log(`Mode: ${mode}`);
    console.log(`Reference source: ${reference}`);
  } else {
    console.log(`Mode: ${mode}`);
  }

  const apiKey = process.env.GRSAI_API_KEY;
  if (!apiKey && !args.dryRun) {
    throw new Error('Missing GRSAI_API_KEY environment variable');
  }

  // Safe default: do not regenerate assets that already exist unless explicitly forced.
  if (output && existsSync(output) && !args.force && !args.dryRun) {
    console.log(`Skip generation: output already exists -> ${output}`);
    console.log('Use --force to regenerate this image.');
    return;
  }

  const payloadBase = buildBasePayload(args, prompt);
  const shouldUsePolling = true;
  if (shouldUsePolling) {
    payloadBase.webHook = '-1';
    payloadBase.shutProgress = false;
  }
  if (args.dryRun) {
    const previewPayload =
      mode === 'image2image'
        ? injectReference(payloadBase, args.referenceKey, referenceData)
        : payloadBase;
    console.log(
      JSON.stringify(
        {
          submitUrl: `${args.baseUrl}/v1/draw/nano-banana`,
          resultUrl: `${args.baseUrl}/v1/draw/result`,
          mode,
          payload: previewPayload,
          output,
          referenceKey: mode === 'image2image' ? args.referenceKey : null,
          referencePreview:
            mode === 'image2image'
              ? (isUrl(referenceData) ? referenceData : '[data:image;base64]')
              : null,
        },
        null,
        2,
      ),
    );
    return;
  }

  console.log(`Submitting image task to ${args.baseUrl}/v1/draw/nano-banana ...`);
  const { submitResult, payloadUsed, referenceKeyUsed } = await submitWithFallback(
    args,
    apiKey,
    payloadBase,
    mode,
    referenceData,
  );
  if (referenceKeyUsed) {
    console.log(`Reference key used: ${referenceKeyUsed}`);
  }

  const immediateImages = collectImageCandidates(submitResult);
  if (immediateImages.length > 0) {
    const first = immediateImages[0];
    console.log(`Image ready immediately: ${first}`);
    if (output) {
      await saveImage(first, output);
      console.log(`Saved image to ${output}`);
    }
    return;
  }

  const taskId = pickTaskId(submitResult);
  if (!taskId) {
    throw new Error(
      `Could not find task id in submit response: ${JSON.stringify({
        submitResult,
        payloadUsed,
      })}`,
    );
  }
  console.log(`Task created: ${taskId}`);

  const startedAt = Date.now();
  while (Date.now() - startedAt < args.timeout) {
    await sleep(args.pollInterval);
    const result = await requestJson(
      `${args.baseUrl}/v1/draw/result`,
      apiKey,
      { id: taskId, task_id: taskId },
    );
    const status = pickStatus(result);
    const images = collectImageCandidates(result);

    if (images.length > 0 || isFinishedStatus(status)) {
      const first = images[0];
      if (!first) {
        throw new Error(`Task finished but no image URL found: ${JSON.stringify(result)}`);
      }
      console.log(`Image ready: ${first}`);
      if (output) {
        await saveImage(first, output);
        console.log(`Saved image to ${output}`);
      }
      return;
    }

    if (isFailedStatus(status)) {
      throw new Error(`Image task failed: ${JSON.stringify(result)}`);
    }
    console.log(`Waiting for image... status=${status || 'pending'}`);
  }

  throw new Error(`Timed out after ${args.timeout}ms waiting for image result`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
