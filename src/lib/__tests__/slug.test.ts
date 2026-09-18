import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SLUG_PATTERN, slugify, uniqueSlug } from '@/lib/slug';

describe('slug 格式转换', () => {
  test('需求里给的例子：Industrial Water Pump 2026 → industrial_water_pump_2026', () => {
    assert.equal(slugify('Industrial Water Pump 2026'), 'industrial_water_pump_2026');
  });

  test('全部转小写', () => {
    assert.equal(slugify('ABC'), 'abc');
  });

  test('连续空格与混合分隔符合并成一个下划线', () => {
    assert.equal(slugify('a   b---c___d'), 'a_b_c_d');
  });

  test('去掉标点与特殊字符', () => {
    assert.equal(slugify('Hook (20 mm) — Type #3!'), 'hook_20_mm_type_3');
  });

  test('去掉首尾下划线', () => {
    assert.equal(slugify('  ###Hello World###  '), 'hello_world');
  });

  test('撇号直接删除，而不是变成分隔符', () => {
    assert.equal(slugify("Men's Jacket"), 'mens_jacket');
  });

  test('去掉变音符号：café → cafe', () => {
    assert.equal(slugify('Café Crème'), 'cafe_creme');
  });

  test('纯中文转换不出来，返回空串（由调用方决定回退）', () => {
    assert.equal(slugify('S型沙发特殊钩子'), 's');
    assert.equal(slugify('米众贸易有限公司'), '');
  });

  test('生成结果永远只含 a-z、0-9 与下划线', () => {
    for (const input of ['A B', 'x/y\\z', 'emoji 🎉 here', '３ 全角', '--', '中文', 'a.b.c']) {
      assert.match(slugify(input), /^[a-z0-9_]*$/, `输入 ${input} 得到 ${slugify(input)}`);
    }
  });

  test('生成结果通过后端的 slug 校验（空串除外）', () => {
    for (const input of ['Industrial Water Pump 2026', 'a   b', 'Hook (20 mm)']) {
      assert.match(slugify(input), SLUG_PATTERN);
    }
  });

  test('超长输入会被截断且不留尾部下划线', () => {
    const result = slugify('a'.repeat(200));
    assert.equal(result.length, 120);
    assert.doesNotMatch(result, /_$/);
  });

  test('截断落在分隔符上时，尾部下划线被清掉', () => {
    const result = slugify(`${'a'.repeat(119)} tail`);
    assert.doesNotMatch(result, /_$/);
    assert.match(result, SLUG_PATTERN);
  });
});

describe('slug 重复处理', () => {
  const taken = (...slugs: string[]) => async (candidate: string) => slugs.includes(candidate);

  test('不冲突时原样返回', async () => {
    assert.equal(await uniqueSlug('water_pump', taken('other')), 'water_pump');
  });

  test('冲突时追加 _2', async () => {
    assert.equal(await uniqueSlug('water_pump', taken('water_pump')), 'water_pump_2');
  });

  test('_2 也被占用时继续递增', async () => {
    assert.equal(
      await uniqueSlug('water_pump', taken('water_pump', 'water_pump_2', 'water_pump_3')),
      'water_pump_4',
    );
  });

  test('空串兜底成 product 而不是产出非法 slug', async () => {
    assert.equal(await uniqueSlug('', taken()), 'product');
  });

  test('生成结果始终是合法 slug', async () => {
    const result = await uniqueSlug('water_pump', taken('water_pump', 'water_pump_2'));
    assert.match(result, SLUG_PATTERN);
  });
});
