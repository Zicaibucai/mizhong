import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearedPaths,
  detectFormat,
  diffUnits,
  estimateBatchTokens,
  hashDocument,
  hashText,
  pendingUnits,
  splitIntoBatches,
  type FieldState,
  type TranslationUnit,
} from '@/lib/translation/document';
import { buildUnitPrompt, parseUnitResponse } from '@/lib/translation/batch';
import { validatePageForPublish, readPageDraft, emptyPageTranslations } from '@/lib/page-draft';
import { ADMIN_LOCALES } from '@/lib/admin/validation';

/**
 * 文档模型与页面草稿的纯函数测试。
 *
 * 这些函数决定了「哪些字段要重翻」「一次送多少出去」「路径怎么回填」——
 * 引擎的部分已经在 sync-engine.test.ts 里端到端测过，这里补的是边界：
 * 切批是否稳定、哈希是否只认内容、路径清空是否只清自己写过的。
 */

function unit(path: string, text: string, label = '字段'): TranslationUnit {
  return { path, label, text, format: detectFormat(text) };
}

describe('哈希：只认内容', () => {
  test('同样的文本在任何时候都得到同样的哈希', () => {
    assert.equal(hashText('特塑钩子'), hashText('特塑钩子'));
    assert.equal(hashText('abc'), hashText('abc'));
  });

  test('改一个字符就变', () => {
    assert.notEqual(hashText('特塑钩子'), hashText('特塑钩子。'));
    assert.notEqual(hashText('a'), hashText('A'));
    assert.notEqual(hashText('a'), hashText('a '));
  });

  test('空串与空白串不一样 —— 「清空」与「填了空格」是两件事', () => {
    assert.notEqual(hashText(''), hashText(' '));
  });

  test('输出是定长的十六进制', () => {
    for (const text of ['', 'a', '中'.repeat(500)]) {
      assert.match(hashText(text), /^[0-9a-f]{16}$/);
    }
  });

  test('文档哈希与区块顺序无关 —— 调整顺序不该让全部译文变成过期', () => {
    const a = [unit('blocks.x.title', '甲'), unit('blocks.y.title', '乙')];
    const b = [unit('blocks.y.title', '乙'), unit('blocks.x.title', '甲')];
    assert.equal(hashDocument(a), hashDocument(b));
  });

  test('文档哈希对内容敏感', () => {
    const a = [unit('translations.name', '甲')];
    const b = [unit('translations.name', '乙')];
    assert.notEqual(hashDocument(a), hashDocument(b));
  });
});

describe('逐字段比对', () => {
  const units = [unit('translations.name', '特塑钩子'), unit('translations.description', '正文')];

  test('目标为空 → missing', () => {
    const diffs = diffUnits(units, {}, {});
    assert.deepEqual(diffs.map((item) => item.state), ['missing', 'missing']);
  });

  test('哈希对得上 → synced', () => {
    const current = { 'translations.name': 'Hook', 'translations.description': 'Body' };
    const states: Record<string, FieldState> = {
      'translations.name': { hash: hashText('特塑钩子') },
      'translations.description': { hash: hashText('正文') },
    };
    assert.deepEqual(diffUnits(units, current, states).map((item) => item.state), ['synced', 'synced']);
    assert.equal(pendingUnits(diffUnits(units, current, states), units).length, 0);
  });

  test('中文改了 → 只有那一个字段 stale', () => {
    const current = { 'translations.name': 'Hook', 'translations.description': 'Body' };
    const states: Record<string, FieldState> = {
      'translations.name': { hash: hashText('旧名字') },
      'translations.description': { hash: hashText('正文') },
    };
    const diffs = diffUnits(units, current, states);
    assert.deepEqual(diffs.map((item) => item.state), ['stale', 'synced']);
    assert.deepEqual(
      pendingUnits(diffs, units).map((item) => item.path),
      ['translations.name'],
    );
  });

  test('没有逐字段记录时按 fallback 判定（回滚、老数据都靠它）', () => {
    const current = { 'translations.name': 'Hook', 'translations.description': 'Body' };
    assert.deepEqual(
      diffUnits(units, current, {}, 'stale').map((item) => item.state),
      ['stale', 'stale'],
    );
    assert.deepEqual(
      diffUnits(units, current, {}, 'synced').map((item) => item.state),
      ['synced', 'synced'],
    );
  });

  test('目标为空时，即使有哈希记录也算 missing', () => {
    const states: Record<string, FieldState> = { 'translations.name': { hash: hashText('特塑钩子') } };
    const diffs = diffUnits(units, { 'translations.name': '   ' }, states);
    assert.equal(diffs[0].state, 'missing', '纯空白视为没有内容');
  });
});

describe('清空只清自己写过的', () => {
  test('中文删掉的路径会被识别出来', () => {
    const states: Record<string, FieldState> = {
      'translations.name': { hash: 'x' },
      'translations.seoTitle': { hash: 'y' },
    };
    const units = [unit('translations.name', '特塑钩子')];
    assert.deepEqual(clearedPaths(states, units), ['translations.seoTitle']);
  });

  test('没翻译过的路径不会被误清 —— 人工填的内容不该被同步抹掉', () => {
    const units = [unit('translations.name', '特塑钩子')];
    assert.deepEqual(clearedPaths({}, units), []);
  });
});

describe('分批：稳定、可复现', () => {
  test('同一份文档切出来的批次永远一样', () => {
    const units = Array.from({ length: 20 }, (_, index) => unit(`f${index}`, '内'.repeat(500)));
    const a = splitIntoBatches(units).map((batch) => batch.map((item) => item.path));
    const b = splitIntoBatches(units).map((batch) => batch.map((item) => item.path));
    assert.deepEqual(a, b);
    assert.ok(a.length > 1, '应当被切成多批');
  });

  test('每批都不超过字符上限', () => {
    const units = Array.from({ length: 30 }, (_, index) => unit(`f${index}`, '字'.repeat(400)));
    for (const batch of splitIntoBatches(units)) {
      const total = batch.reduce((sum, item) => sum + item.text.length, 0);
      assert.ok(total <= 6_000, `批次 ${total} 超过上限`);
    }
  });

  test('单个超长字段自成一批，不与别的字段粘在一起', () => {
    const units = [unit('big', '字'.repeat(7_000)), unit('small', '短')];
    const batches = splitIntoBatches(units);
    assert.equal(batches[0].length, 1);
    assert.equal(batches[0][0].path, 'big');
    assert.equal(batches[1][0].path, 'small');
  });

  test('空文档切出空批次列表', () => {
    assert.deepEqual(splitIntoBatches([]), []);
  });
});

describe('内容形态识别', () => {
  test('HTML 片段', () => {
    assert.equal(detectFormat('<p>正文</p>'), 'html');
    assert.equal(detectFormat('前置 <b>加粗</b> 后置'), 'html');
  });

  test('Markdown', () => {
    assert.equal(detectFormat('## 标题'), 'markdown');
    assert.equal(detectFormat('- 第一项\n- 第二项'), 'markdown');
    assert.equal(detectFormat('这是 **重点**'), 'markdown');
  });

  test('普通文本不会被误判 —— 宁可少一条强调，也不要让模型以为该加标签', () => {
    assert.equal(detectFormat('25 mm × 30 mm'), 'text');
    assert.equal(detectFormat('材质：不锈钢'), 'text');
    assert.equal(detectFormat('A-2026 型'), 'text');
  });
});

describe('提示词与回填', () => {
  test('提示词里带路径、语言名与保留规则', () => {
    const prompt = buildUnitPrompt([unit('translations.name', '特塑钩子', '商品名称')], ['en', 'ja']);
    assert.match(prompt, /translations\.name/);
    assert.match(prompt, /English/);
    assert.match(prompt, /Japanese/);
    assert.match(prompt, /特塑钩子/);
  });

  test('有 HTML 字段时追加标签保留规则', () => {
    const prompt = buildUnitPrompt([unit('description', '<p>正文</p>')], ['en']);
    assert.match(prompt, /HTML/);
  });

  test('纯文本时不追加 HTML 规则', () => {
    const prompt = buildUnitPrompt([unit('name', '特塑钩子')], ['en']);
    assert.equal(prompt.includes('这段是 HTML 片段'), false);
  });

  test('返回只接受认识的键；多出来的忽略，缺的当作没翻出来', () => {
    const parsed = parseUnitResponse(
      { translations: { en: { 'translations.name': 'Hook', 额外的键: '忽略我' }, vi: {} } },
      ['translations.name', 'translations.description'],
      ['en', 'vi'],
    );
    assert.ok(parsed);
    assert.deepEqual(Object.keys(parsed.en), ['translations.name']);
    assert.equal(parsed.vi, undefined, '一条都没翻出来的语言不出现在结果里');
  });

  test('返回空串视为没翻出来，不会写入空值', () => {
    const parsed = parseUnitResponse(
      { translations: { en: { 'translations.name': '   ' } } },
      ['translations.name'],
      ['en'],
    );
    assert.equal(parsed, null);
  });

  test('结构不对时返回 null，不编造内容', () => {
    assert.equal(parseUnitResponse(null, ['a'], ['en']), null);
    assert.equal(parseUnitResponse({}, ['a'], ['en']), null);
    assert.equal(parseUnitResponse({ translations: 'nope' }, ['a'], ['en']), null);
  });

  test('token 估算随字段数与语言数增长', () => {
    const one = estimateBatchTokens([unit('a', '中'.repeat(100))], 1);
    const many = estimateBatchTokens([unit('a', '中'.repeat(100))], 10);
    assert.ok(many > one);
    assert.ok(one > 0);
  });
});

describe('页面草稿形状与发布校验', () => {
  function validDraft() {
    const translations = emptyPageTranslations();
    translations.zh = { title: '首页', seoTitle: '标题', seoDescription: '描述' };
    translations.en = { title: 'Home', seoTitle: '', seoDescription: '' };
    return {
      slug: 'home',
      translations,
      blocks: [
        {
          id: 'b1',
          key: 'hero',
          enabled: true,
          sortOrder: 0,
          values: Object.fromEntries(
            ADMIN_LOCALES.map((locale) => [
              locale,
              { title: `${locale} title`, subtitle: '', body: '', ctaLabel: '', ctaHref: '' },
            ]),
          ) as never,
        },
      ],
    };
  }

  const messages = {
    slugRequired: 'slug 必填',
    slugFormat: 'slug 格式不对',
    titleRequired: '中文标题必填',
    seoWithoutTitle: '有 SEO 没标题',
  };

  test('正常草稿通过', () => {
    assert.deepEqual(validatePageForPublish(validDraft(), messages), { ok: true });
  });

  test('slug 缺失或格式不对会被拦下', () => {
    const draft = validDraft();
    draft.slug = '';
    assert.equal(validatePageForPublish(draft, messages).ok, false);

    draft.slug = 'Not A Slug';
    assert.equal(validatePageForPublish(draft, messages).ok, false);
  });

  test('中文标题为空时不能发布 —— 中文是母版，没有它别的语言无从谈起', () => {
    const draft = validDraft();
    draft.translations.zh.title = '';
    const result = validatePageForPublish(draft, messages);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.message, '中文标题必填');
  });

  test('某种语言只有 SEO 没有标题时不能发布 —— 否则该语言页面会渲染出空白标题', () => {
    const draft = validDraft();
    draft.translations.vi = { title: '', seoTitle: '有 SEO', seoDescription: '' };
    const result = validatePageForPublish(draft, messages);
    assert.equal(result.ok, false);
    assert.equal(result.ok === false && result.message, '有 SEO 没标题');
  });

  test('读不认识的草稿返回 null，让调用方回退到线上内容而不是打挂页面', () => {
    assert.equal(readPageDraft(null), null);
    assert.equal(readPageDraft({ 乱写的: 1 }), null);
    assert.ok(readPageDraft(validDraft()));
  });
});
