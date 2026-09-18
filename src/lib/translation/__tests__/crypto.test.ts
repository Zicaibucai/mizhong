import { test, describe, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  ENCRYPTION_KEY_ENV,
  EncryptionUnavailableError,
  decryptSecret,
  encryptSecret,
  isEncrypted,
} from '@/lib/translation/crypto';

const PLAINTEXT = 'sk-3c1f9a2b7d4e6f8a1c3e5b7d9f0a2c4e';
const KEY = 'test-encryption-passphrase-not-a-real-secret';

const original = process.env[ENCRYPTION_KEY_ENV];
beforeEach(() => {
  process.env[ENCRYPTION_KEY_ENV] = KEY;
});
afterEach(() => {
  if (original === undefined) delete process.env[ENCRYPTION_KEY_ENV];
  else process.env[ENCRYPTION_KEY_ENV] = original;
});

describe('API Key 静态加密', () => {
  test('加密后的密文与原文完全不同', () => {
    const cipher = encryptSecret(PLAINTEXT);
    assert.notEqual(cipher, PLAINTEXT);
    assert.ok(!cipher.includes(PLAINTEXT));
  });

  test('密文里不含任何原文片段（哪怕一小段）', () => {
    const cipher = encryptSecret(PLAINTEXT);
    // 取原文的几个片段逐个确认不出现在密文里
    for (const slice of [PLAINTEXT.slice(0, 6), PLAINTEXT.slice(10, 20), PLAINTEXT.slice(-8)]) {
      assert.ok(!cipher.includes(slice), `密文里出现了原文片段 ${slice}`);
    }
  });

  test('带 v1 前缀，能区分密文与明文', () => {
    const cipher = encryptSecret(PLAINTEXT);
    assert.ok(isEncrypted(cipher));
    assert.ok(!isEncrypted(PLAINTEXT));
  });

  test('解密还原出原文', () => {
    assert.equal(decryptSecret(encryptSecret(PLAINTEXT)), PLAINTEXT);
  });

  test('每次加密结果都不同（随机 IV）', () => {
    const a = encryptSecret(PLAINTEXT);
    const b = encryptSecret(PLAINTEXT);
    assert.notEqual(a, b);
    assert.equal(decryptSecret(a), decryptSecret(b));
  });

  test('历史遗留的明文原样读出（升级过程不需要停机迁移）', () => {
    assert.equal(decryptSecret(PLAINTEXT), PLAINTEXT);
  });

  test('换一把加密密钥后解不开，返回 null 而不是乱码', () => {
    const cipher = encryptSecret(PLAINTEXT);
    process.env[ENCRYPTION_KEY_ENV] = 'a-completely-different-passphrase';
    assert.equal(decryptSecret(cipher), null);
  });

  test('密文被篡改时认证失败，返回 null', () => {
    const cipher = encryptSecret(PLAINTEXT);
    const parts = cipher.split('.');
    // 改动密文段的最后一个字符
    const tampered = parts[3].slice(0, -2) + (parts[3].endsWith('A') ? 'B' : 'A') + '=';
    assert.equal(decryptSecret([parts[0], parts[1], parts[2], tampered].join('.')), null);
  });

  test('格式不对的密文返回 null，不抛异常', () => {
    assert.equal(decryptSecret('v1.broken'), null);
    assert.equal(decryptSecret('v1.a.b.c.d'), null);
  });

  test('未配置加密密钥时拒绝加密（绝不退回明文存储）', () => {
    delete process.env[ENCRYPTION_KEY_ENV];
    assert.throws(() => encryptSecret(PLAINTEXT), EncryptionUnavailableError);
  });

  test('未配置加密密钥时，已加密的值解不开', () => {
    const cipher = encryptSecret(PLAINTEXT);
    delete process.env[ENCRYPTION_KEY_ENV];
    assert.equal(decryptSecret(cipher), null);
  });

  test('未配置加密密钥时，明文仍然可读（环境变量兜底场景）', () => {
    delete process.env[ENCRYPTION_KEY_ENV];
    assert.equal(decryptSecret(PLAINTEXT), PLAINTEXT);
  });

  test('空字符串加解密都是空字符串', () => {
    assert.equal(decryptSecret(''), '');
  });

  test('加密密钥可以是任意长度的口令', () => {
    for (const passphrase of ['x', 'a'.repeat(200)]) {
      process.env[ENCRYPTION_KEY_ENV] = passphrase;
      assert.equal(decryptSecret(encryptSecret(PLAINTEXT)), PLAINTEXT);
    }
  });
});
