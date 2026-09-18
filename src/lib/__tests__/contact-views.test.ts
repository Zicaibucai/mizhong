import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveContactViews, type ContactRow } from '@/lib/content';

/**
 * 联系方式摊平的测试。
 *
 * 这一组锁的是一个**线上真的发生过**的 bug：后台填了联系方式，前台不显示，
 * 页脚反而冒出一组过时的邮箱和电话。
 *
 * 根因是空串遮蔽：后台保存时会给每种语言都写一行翻译，没填的字段存成 `''`
 * 而不是 NULL；而 `(tr?.value ?? row.value)` 里的 `??` 只在 null / undefined
 * 时下沉，`''` 被当成一个值 —— 于是「填了共享值、没填该语言」的联系方式整条消失。
 *
 * 它不报错，也不抛异常，只是安静地少显示几条 —— 所以必须有测试盯着。
 */

const LABELS = {
  EMAIL: '邮箱',
  WHATSAPP: 'WhatsApp',
  PHONE: '电话',
  WECHAT: '微信',
  ADDRESS: '地址',
} as const;

/** 后台保存出来的典型行：每种语言都有一行，没填的字段是空串 */
function row(overrides: Partial<ContactRow> = {}): ContactRow {
  return {
    id: 'c1',
    type: 'EMAIL',
    value: 'ida_zhou@htdmaterials.net',
    href: null,
    translations: [],
    ...overrides,
  };
}

describe('联系方式摊平', () => {
  test('某语言的翻译行是空串时，仍然显示共享值（这就是那个线上 bug）', () => {
    const views = resolveContactViews(
      [
        row({
          translations: [
            { locale: 'zh', label: '', value: '' },
            { locale: 'en', label: '', value: '' },
          ],
        }),
      ],
      'zh',
      LABELS,
    );

    assert.equal(views.length, 1, '填了共享值的联系方式不该被丢掉');
    assert.equal(views[0].value, 'ida_zhou@htdmaterials.net');
    assert.equal(views[0].label, '邮箱', '标签也没填时用类型默认名');
    assert.equal(views[0].href, 'mailto:ida_zhou@htdmaterials.net', '没有自定义链接时按类型推导');
  });

  test('翻译行是 null 时同样下沉到共享值', () => {
    const views = resolveContactViews(
      [row({ translations: [{ locale: 'zh', label: null, value: null }] })],
      'zh',
      LABELS,
    );
    assert.equal(views[0].value, 'ida_zhou@htdmaterials.net');
  });

  test('翻译行填了值就用它，优先于共享值', () => {
    const views = resolveContactViews(
      [
        row({
          value: 'shared@example.com',
          translations: [{ locale: 'zh', label: '销售咨询', value: 'sales@example.com' }],
        }),
      ],
      'zh',
      LABELS,
    );
    assert.equal(views[0].value, 'sales@example.com');
    assert.equal(views[0].label, '销售咨询');
  });

  test('其它语言填了值不会影响当前语言', () => {
    const views = resolveContactViews(
      [
        row({
          translations: [
            { locale: 'en', label: 'Sales', value: 'sales@example.com' },
            { locale: 'zh', label: '', value: '' },
          ],
        }),
      ],
      'zh',
      LABELS,
    );
    assert.equal(views[0].value, 'ida_zhou@htdmaterials.net', '中文没填就退回共享值');
    assert.equal(views[0].label, '邮箱');
  });

  test('共享值与翻译行都没有内容时才不显示 —— 绝不用占位数据顶上', () => {
    const views = resolveContactViews(
      [row({ value: '', translations: [{ locale: 'zh', label: '', value: '' }] })],
      'zh',
      LABELS,
    );
    assert.deepEqual(views, []);
  });

  test('纯空白的共享值也算没填', () => {
    const views = resolveContactViews([row({ value: '   ' })], 'zh', LABELS);
    assert.deepEqual(views, []);
  });

  test('地址类型没有自定义链接时不推导出可点链接（没有 mailto 那种默认）', () => {
    const views = resolveContactViews(
      [row({ type: 'ADDRESS', value: '某某路 1 号', href: null })],
      'zh',
      LABELS,
    );
    assert.equal(views[0].value, '某某路 1 号');
    assert.equal(views[0].href, null);
  });

  test('危险的链接协议被挡掉', () => {
    const views = resolveContactViews(
      [row({ href: 'javascript:alert(1)' })],
      'zh',
      LABELS,
    );
    // sanitizeHref 返回 null 之后会退回按类型推导，绝不会把 javascript: 放行
    assert.equal(views[0].href, 'mailto:ida_zhou@htdmaterials.net');
  });
});
