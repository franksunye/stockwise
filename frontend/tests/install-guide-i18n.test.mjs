import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const INSTALL_GUIDE_PATH = resolve(ROOT, 'src', 'components', 'InstallGuide.tsx');
const INSTALL_PROMPT_HOOK_PATH = resolve(ROOT, 'src', 'hooks', 'useInstallPrompt.ts');
const EN_MESSAGES_PATH = resolve(ROOT, 'src', 'messages', 'en.json');
const CN_MESSAGES_PATH = resolve(ROOT, 'src', 'messages', 'cn.json');

describe('install guide i18n regression', () => {
  it('wechat guide should instruct users to open in browser instead of add to home screen', () => {
    const src = readFileSync(INSTALL_GUIDE_PATH, 'utf-8');

    assert.ok(
      src.includes("closeLabel={t('closeAriaLabel')}") &&
      src.includes("{t('wechatDesc')}") &&
      src.includes("{t('wechatArrowHint')}") &&
      src.includes("{t('wechatStep1')}") &&
      src.includes("{t('wechatStep2')}"),
      'WeChat guide should use dedicated localized copy for opening in an external browser.',
    );
  });

  it('english install messages should include wechat-specific copy and dismiss label', () => {
    const src = readFileSync(EN_MESSAGES_PATH, 'utf-8');

    assert.ok(
      src.includes('"closeAriaLabel": "Dismiss install guide"') &&
      src.includes('"wechatDesc": "WeChat blocks direct PWA installation.') &&
      src.includes('"wechatStep2": "Choose \'Open in Browser\'"'),
      'English install copy should explain the correct WeChat escape flow.',
    );
  });

  it('chinese install messages should include wechat-specific copy and dismiss label', () => {
    const src = readFileSync(CN_MESSAGES_PATH, 'utf-8');

    assert.ok(
      src.includes('"closeAriaLabel": "关闭安装引导"') &&
      src.includes('"wechatDesc": "微信内置浏览器无法直接安装 PWA，请先在系统浏览器中打开当前页面，再继续安装。"') &&
      src.includes('"wechatStep2": "选择“在浏览器中打开”"'),
      'Chinese install copy should explain the correct WeChat escape flow.',
    );
  });

  it('android native install should fall back to manual guidance if install never completes', () => {
    const src = readFileSync(INSTALL_PROMPT_HOOK_PATH, 'utf-8');

    assert.ok(
      src.includes('const [showAndroidFallbackManual, setShowAndroidFallbackManual] = useState(false);'),
      'Install prompt hook should track whether the Android native prompt needs a manual fallback.',
    );
    assert.ok(
      src.includes("if (isAndroidChromium() && showAndroidFallbackManual) return 'android-manual';"),
      'Android Chromium should fall back to the manual install guide when native install does not complete.',
    );
    assert.ok(
      src.includes('await new Promise((resolve) => window.setTimeout(resolve, 1500));') &&
      src.includes('setShowAndroidFallbackManual(true);'),
      'Accepted Android install prompts should restore manual guidance if appinstalled never arrives.',
    );
  });
});
