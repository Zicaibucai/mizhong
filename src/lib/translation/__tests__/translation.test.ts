import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TARGET_LOCALES,
  buildTranslationUserPrompt,
  mergeTranslations,
  parseTranslationRequest,
  parseTranslationResponse,
} from '@/lib/translation/fields';
import { translateWithDeepSeek } from '@/lib/translation/deepseek';
import { maskApiKey } from '@/lib/translation/settings';
import type { TranslationSettings } from '@/lib/translation/settings';
import { locales } from '@/lib/i18n/config';

const settings: TranslationSettings = {
  apiKey: 'sk-test-key-abcdefghijklmnop',
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  source: 'database',
  keyStorage: 'encrypted',
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('请求校验（信任边界）', () => {
  test('中文字段有值时正常通过', () => {
    const result = parseTranslationRequest({
      source: { name: '不锈钢挂钩', description: '用于沙发固定' },
      targets: ['en', 'ja'],
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.deepEqual(result.data.targets, ['en', 'ja']);
      assert.equal(result.data.source.name, '不锈钢挂钩');
    }
  });

  test('纯空白字段被丢掉，不会送去翻译', () => {
    const result = parseTranslationRequest({
      source: { name: '有内容', description: '   ', spec: '\n\t' },
      targets: ['en'],
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(Object.keys(result.data.source), ['name']);
  });

  test('所有字段都为空时拒绝请求', () => {
    const result = parseTranslationRequest({ source: { name: '  ', description: '' }, targets: ['en'] });
    assert.deepEqual(result, { ok: false, reason: 'empty' });
  });

  test('不在白名单里的字段名会被 Zod 拒绝', () => {
    const result = parseTranslationRequest({
      source: { name: 'x', secretField: 'y' },
      targets: ['en'],
    });
    assert.deepEqual(result, { ok: false, reason: 'invalid' });
  });

  test('不在白名单里的目标语言会被拒绝', () => {
    const result = parseTranslationRequest({ source: { name: 'x' }, targets: ['de'] });
    assert.deepEqual(result, { ok: false, reason: 'invalid' });
  });

  test('单个字段超过上限时拒绝（比总体积限制更早触发）', () => {
    const result = parseTranslationRequest({
      source: { description: 'a'.repeat(10_001) },
      targets: ['en'],
    });
    assert.deepEqual(result, { ok: false, reason: 'invalid' });
  });

  test('每个字段都没超标但加起来超过总体积时拒绝', () => {
    // 10000 是单字段上限，这里每个字段 9000，五个加起来 45000 > 40000 的总体积上限
    const chunk = 'a'.repeat(9_000);
    const result = parseTranslationRequest({
      source: {
        name: chunk,
        shortDescription: chunk,
        description: chunk,
        sizeSummary: chunk,
        spec: chunk,
      },
      targets: ['en'],
    });
    assert.deepEqual(result, { ok: false, reason: 'too-large' });
  });

  test('中文不会被当成目标语言', () => {
    const result = parseTranslationRequest({ source: { name: 'x' }, targets: ['zh', 'en'] });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data.targets, ['en']);
  });

  test('重复的目标语言会去重', () => {
    const result = parseTranslationRequest({ source: { name: 'x' }, targets: ['en', 'en', 'ja'] });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.data.targets, ['en', 'ja']);
  });

  test('默认目标语言是除中文外的全部语言（加语言后自动跟上）', () => {
    assert.equal(DEFAULT_TARGET_LOCALES.length, locales.length - 1);
    assert.ok(!DEFAULT_TARGET_LOCALES.includes('zh'));
    assert.ok(DEFAULT_TARGET_LOCALES.includes('ar'));
    assert.ok(DEFAULT_TARGET_LOCALES.includes('hi'));
  });
});

describe('提示词', () => {
  const request = { source: { name: '挂钩' }, targets: ['en', 'ja'] as const };

  test('包含需求指定的系统提示词要点', () => {
    const prompt = buildTranslationUserPrompt({ source: { name: '挂钩' }, targets: ['en'] });
    assert.match(prompt, /只输出 JSON/);
  });

  test('把语言代码与英文语言名一起写进提示词', () => {
    const prompt = buildTranslationUserPrompt({ source: request.source, targets: [...request.targets] });
    assert.match(prompt, /en: English/);
    assert.match(prompt, /ja: Japanese/);
  });

  test('要求的返回结构里带着同名字段，避免译文错位', () => {
    const prompt = buildTranslationUserPrompt({ source: { name: '挂钩' }, targets: ['en'] });
    assert.match(prompt, /"translations"/);
    assert.match(prompt, /"name": "译文"/);
  });
});

describe('返回结果校验', () => {
  const request = { source: { name: '挂钩' as const }, targets: ['en', 'ja'] as const };
  const full = { source: { name: '挂钩' }, targets: ['en', 'ja'] as ('en' | 'ja')[] };

  test('结构正确时正常解析', () => {
    const parsed = parseTranslationResponse(
      { translations: { en: { name: 'Hook' }, ja: { name: 'フック' } } },
      { source: request.source, targets: [...request.targets] },
    );
    assert.deepEqual(parsed?.values, { en: { name: 'Hook' }, ja: { name: 'フック' } });
  });

  test('缺少 translations 键时返回 null', () => {
    assert.equal(parseTranslationResponse({ result: {} }, full), null);
  });

  test('模型返回非对象时返回 null', () => {
    assert.equal(parseTranslationResponse('not json', full), null);
  });

  test('多余的语言与字段被忽略', () => {
    const parsed = parseTranslationResponse(
      {
        translations: {
          en: { name: 'Hook', secret: 'x' },
          de: { name: 'Haken' },
          ja: { name: 'フック' },
        },
      },
      full,
    );
    assert.deepEqual(Object.keys(parsed?.values ?? {}).sort(), ['en', 'ja']);
    assert.deepEqual(Object.keys(parsed?.values.en ?? {}), ['name']);
  });

  test('空字符串视为「没翻出来」，不会写入空值', () => {
    const parsed = parseTranslationResponse({ translations: { en: { name: '  ' } } }, full);
    assert.equal(parsed, null);
  });
});

describe('合并译文（不覆盖人工翻译）', () => {
  const source = { name: '挂钩', description: '说明' };
  const incoming = { en: { name: 'Hook', description: 'Description' }, ja: { name: 'フック' } };

  test('目标为空时写入', () => {
    const outcome = mergeTranslations(incoming, {}, source, { overwrite: false });
    assert.deepEqual(outcome.applied.en, { name: 'Hook', description: 'Description' });
    assert.deepEqual(outcome.skipped, []);
  });

  test('目标已有内容时默认跳过，并报告被跳过的位置', () => {
    const outcome = mergeTranslations(incoming, { en: { name: '我手工填的' } }, source, {
      overwrite: false,
    });
    assert.equal(outcome.applied.en?.name, undefined);
    assert.equal(outcome.applied.en?.description, 'Description');
    assert.deepEqual(outcome.skipped, [{ locale: 'en', field: 'name' }]);
  });

  test('勾选覆盖后会更新已有译文', () => {
    const outcome = mergeTranslations(incoming, { en: { name: '我手工填的' } }, source, {
      overwrite: true,
    });
    assert.equal(outcome.applied.en?.name, 'Hook');
    assert.deepEqual(outcome.skipped, []);
  });

  test('原文为空的字段，即使模型给了译文也不接受', () => {
    const outcome = mergeTranslations(
      { en: { name: 'Hook', seoTitle: '模型多给的' } },
      {},
      { name: '挂钩' },
      { overwrite: true },
    );
    assert.equal(outcome.applied.en?.seoTitle, undefined);
    assert.deepEqual(outcome.unexpected, [{ locale: 'en', field: 'seoTitle' }]);
  });

  test('空白的目标值视为「没有内容」，会被写入', () => {
    const outcome = mergeTranslations(incoming, { en: { name: '   ' } }, source, { overwrite: false });
    assert.equal(outcome.applied.en?.name, 'Hook');
  });
});

describe('DeepSeek 请求失败时不破坏表单', () => {
  const request = { source: { name: '挂钩' }, targets: ['en'] as const };

  test('没有配置 Key 时直接返回 not-configured，不发起请求', async () => {
    let called = false;
    globalThis.fetch = (async () => {
      called = true;
      throw new Error('不该被调用');
    }) as typeof fetch;

    const result = await translateWithDeepSeek({ ...settings, apiKey: '' }, { source: request.source, targets: [...request.targets] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'not-configured');
    assert.equal(called, false);
  });

  test('Key 无效时立刻返回，不重试', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response('unauthorized', { status: 401 });
    }) as typeof fetch;

    const result = await translateWithDeepSeek(settings, { source: request.source, targets: [...request.targets] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'auth');
    assert.equal(calls, 1, '401 不该重试');
  });

  test('网络异常时返回错误对象而不是抛异常', async () => {
    globalThis.fetch = (async () => {
      throw new Error('ENOTFOUND');
    }) as typeof fetch;

    const result = await translateWithDeepSeek(settings, { source: request.source, targets: [...request.targets] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'network');
  });

  test('返回内容不是合法 JSON 时返回 bad-response', async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: '这不是 JSON' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    const result = await translateWithDeepSeek(settings, { source: request.source, targets: [...request.targets] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'bad-response');
  });

  test('5xx 会重试，且尝试次数不超过上限', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return new Response('boom', { status: 500 });
    }) as typeof fetch;

    const result = await translateWithDeepSeek(settings, { source: request.source, targets: [...request.targets] });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, 'server');
    assert.equal(calls, 3, '最多 3 次尝试（1 次 + 2 次重试）');
    assert.equal(result.attempts, 3);
  });

  test('成功时返回解析好的译文', async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translations: { en: { name: 'Hook' } } }) } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as typeof fetch;

    const result = await translateWithDeepSeek(settings, { source: request.source, targets: [...request.targets] });
    assert.equal(result.ok, true);
    if (result.ok) assert.deepEqual(result.values, { en: { name: 'Hook' } });
  });

  test('请求头里带 Key，但错误详情里不含 Key', async () => {
    let seenAuth = '';
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      seenAuth = String((init.headers as Record<string, string>).Authorization ?? '');
      return new Response('bad request', { status: 400 });
    }) as unknown as typeof fetch;

    const result = await translateWithDeepSeek(settings, { source: request.source, targets: [...request.targets] });
    assert.match(seenAuth, /^Bearer sk-test/);
    assert.equal(result.ok, false);
    if (!result.ok) assert.doesNotMatch(result.detail ?? '', /sk-test/);
  });
});

describe('API Key 脱敏', () => {
  test('只露前 3 位与后 4 位', () => {
    const masked = maskApiKey('sk-1234567890abcdef');
    assert.match(masked, /^sk-•+cdef$/);
    assert.doesNotMatch(masked, /567890/);
  });

  test('短 Key 全部打码', () => {
    assert.equal(maskApiKey('short'), '•••••');
  });

  test('空 Key 返回空串', () => {
    assert.equal(maskApiKey(''), '');
  });
});
