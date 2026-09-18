import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChannels } from '@/lib/preview/util';
import { getDictionary } from '@/lib/i18n';
import type { ContactView } from '@/lib/content';

/**
 * 联系渠道汇总的测试。
 *
 * 这一组锁的是另一个线上真的发生过的问题：**后台加了联系方式，前台不显示**。
 *
 * 旧实现把 `CHANNEL_ORDER` 当成筛选用 —— 每种类型只取第一条，而且只认
 * WhatsApp / Email / Phone 三种。于是：
 *   - 后台加三个邮箱，前台只显示一个；
 *   - 后台加微信，**永远不显示**（它连类型都不在名单里）；
 *   - 更糟的是「取不到就用兜底顶上」，于是页面上出现的是内置的过时联系方式，
 *     看起来像缓存，其实是这段逻辑。
 *
 * 现在它是**排序**不是筛选：后台有几条就显示几条。
 */

const t = getDictionary('zh');

function contact(overrides: Partial<ContactView> & { id: string }): ContactView {
  return {
    type: 'EMAIL',
    label: '邮箱',
    value: 'someone@example.com',
    href: 'mailto:someone@example.com',
    ...overrides,
  } as ContactView;
}

describe('联系方式：后台填了就该显示', () => {
  test('同一种类型的多条全部显示 —— 三个邮箱就是三条', () => {
    const channels = resolveChannels('zh', t, [
      contact({ id: 'e1', value: 'a@x.com', href: 'mailto:a@x.com' }),
      contact({ id: 'e2', value: 'b@x.com', href: 'mailto:b@x.com' }),
      contact({ id: 'e3', value: 'c@x.com', href: 'mailto:c@x.com' }),
    ]);

    // 只断言 EMAIL 那几条：缺失的类型会被兜底补上（见下面单独那条用例）
    const emails = channels.filter((channel) => channel.type === 'EMAIL');
    assert.deepEqual(
      emails.map((channel) => channel.value),
      ['a@x.com', 'b@x.com', 'c@x.com'],
      '三个邮箱要全部显示，且同类型内保持后台传来的顺序',
    );
    assert.equal(new Set(channels.map((channel) => channel.key)).size, channels.length, 'key 必须唯一');
  });

  test('微信会显示 —— 它以前连类型都不在名单里', () => {
    const channels = resolveChannels('zh', t, [
      contact({ id: 'w1', type: 'WECHAT', label: '微信', value: 'Sofa_Materials_Mia', href: '' }),
      contact({ id: 'w2', type: 'WECHAT', label: '微信', value: 'other', href: 'https://example.com' }),
    ]);

    const wechat = channels.filter((channel) => channel.type === 'WECHAT');
    assert.equal(wechat.length, 2, '微信以前连类型都不在名单里，一条都不会显示');
    assert.deepEqual(wechat.map((channel) => channel.value), ['Sofa_Materials_Mia', 'other']);
  });

  test('地址也会显示（同样点不了，但要看得到）', () => {
    const channels = resolveChannels('zh', t, [
      contact({ id: 'a1', type: 'ADDRESS', label: '地址', value: '某某路 1 号', href: null }),
    ]);

    const address = channels.filter((channel) => channel.type === 'ADDRESS');
    assert.equal(address.length, 1);
    assert.equal(address[0].value, '某某路 1 号');
    assert.equal(address[0].href, null);
  });

  test('类型之间按触达优先级排序：WhatsApp → Email → Phone → 微信', () => {
    const channels = resolveChannels('zh', t, [
      contact({ id: 'p1', type: 'PHONE', label: '电话', value: '+1', href: 'tel:+1' }),
      contact({ id: 'w1', type: 'WECHAT', label: '微信', value: 'wx', href: 'https://x' }),
      contact({ id: 'e1', type: 'EMAIL', value: 'a@x.com', href: 'mailto:a@x.com' }),
      contact({ id: 'wa1', type: 'WHATSAPP', label: 'WhatsApp', value: '+2', href: 'https://wa.me/2' }),
    ]);

    assert.deepEqual(
      channels.map((channel) => channel.type),
      ['WHATSAPP', 'EMAIL', 'PHONE', 'WECHAT'],
    );
  });

  test('后台某类型一条都没有时，用已确认的公开联系方式顶上', () => {
    const channels = resolveChannels('zh', t, [
      contact({ id: 'e1', value: 'a@x.com', href: 'mailto:a@x.com' }),
    ]);

    const types = channels.map((channel) => channel.type);
    assert.ok(types.includes('EMAIL'));
    assert.ok(types.includes('WHATSAPP'), '没有 WhatsApp 内容时用兜底，询盘区不该空着');
    assert.ok(types.includes('PHONE'));
    assert.equal(types.filter((type) => type === 'EMAIL').length, 1, '有内容时不再叠加兜底');
    assert.equal(channels[0].type, 'WHATSAPP', '兜底项也按类型优先级排在前面');
  });

  test('没有任何内容时只返回兜底，不会崩也不会空', () => {
    const channels = resolveChannels('zh', t, []);
    assert.ok(channels.length > 0);
    assert.ok(
      channels.every((channel) => channel.href !== null),
      '兜底项都带链接',
    );
  });

  test('没有链接但有值的也显示 —— 微信号只能复制，不能因为它没链接就丢掉', () => {
    const channels = resolveChannels('zh', t, [
      contact({ id: 'w1', type: 'WECHAT', label: '微信', value: 'Sofa_Materials_Mia', href: null }),
    ]);

    const wechat = channels.filter((channel) => channel.type === 'WECHAT');
    assert.equal(wechat.length, 1);
    assert.equal(wechat[0].href, null, '它确实没有可点的地址');
    assert.equal(wechat[0].value, 'Sofa_Materials_Mia', '但内容要显示出来');
  });

  test('值为空的联系方式不进列表（一条点不动的空白比没有更糟）', () => {
    const channels = resolveChannels('zh', t, [
      contact({ id: 'bad1', value: '   ', href: 'mailto:x@x.com' }),
      contact({ id: 'bad2', value: '', href: 'mailto:y@y.com' }),
    ]);

    assert.equal(
      channels.filter((channel) => channel.key.startsWith('EMAIL-')).length,
      0,
      '两条都不该进列表',
    );
  });
});
