import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADMIN_RATE_LIMIT,
  MAX_CONCURRENT_TRANSLATIONS,
  acquireTranslationSlot,
  currentInFlight,
  resetRateLimiter,
} from '@/lib/translation/rate-limit';

beforeEach(() => resetRateLimiter());

describe('翻译接口的并发限制', () => {
  test('并发上限之内可以获取额度', () => {
    const slots = Array.from({ length: MAX_CONCURRENT_TRANSLATIONS }, (_, i) =>
      acquireTranslationSlot(`admin-${i}`),
    );
    assert.ok(slots.every((slot) => slot.ok), '并发上限之内不该被拒');
  });

  test('超过并发上限时被拒', () => {
    for (let i = 0; i < MAX_CONCURRENT_TRANSLATIONS; i += 1) {
      acquireTranslationSlot('admin-a');
    }
    const extra = acquireTranslationSlot('admin-b');
    assert.equal(extra.ok, false);
    if (!extra.ok) assert.equal(extra.reason, 'concurrency');
  });

  test('释放之后又能获取', () => {
    const first = acquireTranslationSlot('admin-a');
    acquireTranslationSlot('admin-b');
    assert.equal(currentInFlight(), MAX_CONCURRENT_TRANSLATIONS);
    if (first.ok) first.release();
    assert.equal(acquireTranslationSlot('admin-c').ok, true);
  });

  test('重复 release 不会把计数减成负数', () => {
    const slot = acquireTranslationSlot('admin-a');
    if (slot.ok) {
      slot.release();
      slot.release();
      slot.release();
    }
    assert.equal(currentInFlight(), 0);
    assert.equal(acquireTranslationSlot('admin-b').ok, true);
  });
});

describe('按管理员限流', () => {
  test('窗口内超过次数上限后被拒，理由是 rate 而不是 concurrency', () => {
    for (let i = 0; i < ADMIN_RATE_LIMIT; i += 1) {
      const slot = acquireTranslationSlot('same-admin');
      if (slot.ok) slot.release();   // 立刻释放，只考察「次数」限制
    }
    const blocked = acquireTranslationSlot('same-admin');
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.equal(blocked.reason, 'rate');
      assert.ok(blocked.retryAfterMs > 0, '应当告诉调用方要等多久');
    }
  });

  test('限流按管理员各自计算，互不影响', () => {
    for (let i = 0; i < ADMIN_RATE_LIMIT; i += 1) {
      const slot = acquireTranslationSlot('noisy-admin');
      if (slot.ok) slot.release();
    }
    assert.equal(acquireTranslationSlot('noisy-admin').ok, false);
    // 另一个管理员不受影响
    const other = acquireTranslationSlot('quiet-admin');
    assert.equal(other.ok, true);
    if (other.ok) other.release();
  });

  test('被限流时不会占用并发额度（否则会把翻译彻底锁死）', () => {
    for (let i = 0; i < ADMIN_RATE_LIMIT; i += 1) {
      const slot = acquireTranslationSlot('same-admin');
      if (slot.ok) slot.release();
    }
    acquireTranslationSlot('same-admin');
    assert.equal(currentInFlight(), 0, '被限流的请求不该增加在飞计数');
  });
});
