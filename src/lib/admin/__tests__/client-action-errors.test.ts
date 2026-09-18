import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * 「调用 Server Action 时忘了 try/catch」的守卫。
 *
 * 这类 bug 的表现很难和「功能没做」区分开：网络正常时一切正常，
 * 网络一抖（断网、服务器重启、代理超时）Server Action 的 fetch 就会**抛异常**；
 * 抛在 `startTransition(async () => …)` 里是未处理的 Promise 拒绝，
 * React 会把它升级成渲染错误 —— 整个编辑器变成 Next 的「Application error」白屏，
 * 用户没保存的输入一起丢掉。
 *
 * 表单的 `<form action={fn}>` 由 React 自己兜住，不需要处理；
 * 需要检查的是**手动调用**的那些：`startTransition` / `useTransition` 里
 * 直接 await 一个 `xxxAction(...)`。
 *
 * 判定方式：每个 `startTransition(async` 起头的块里，必须出现 `try`。
 */

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !full.includes('__tests__')) out.push(full);
  }
  return out;
}

/** 取出每个 startTransition(async …) 之后的一段代码，用于检查里面有没有 try */
function transitionBlocks(source: string): string[] {
  const blocks: string[] = [];
  const marker = 'startTransition(async';
  let index = source.indexOf(marker);
  while (index >= 0) {
    // 取到下一个 startTransition 或文件结束为止，足够覆盖该块的内容
    const next = source.indexOf(marker, index + marker.length);
    blocks.push(source.slice(index, next < 0 ? source.length : next));
    index = next;
  }
  return blocks;
}

describe('手动调用的 Server Action 都处理了网络失败', () => {
  const files = walk(SRC).filter((file) => !file.includes('/lib/admin/actions/'));

  const offenders: string[] = [];
  let inspected = 0;

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const block of transitionBlocks(source)) {
      // 只关心真正调用了 action 的块
      if (!/\w+Action\(/.test(block)) continue;
      inspected += 1;
      if (!/\btry\s*\{/.test(block)) offenders.push(relative(SRC, file));
    }
  }

  test('确实扫到了手动调用 action 的地方（防止匹配失效后静默通过）', () => {
    assert.ok(inspected >= 3, `只扫到 ${inspected} 处，扫描逻辑可能失效了`);
  });

  test('每一处都用 try/catch 包住了，网络中断不会白屏', () => {
    assert.deepEqual(
      [...new Set(offenders)],
      [],
      `以下文件在 startTransition 里裸调 Server Action，网络中断会导致整个页面崩溃：\n  ${[...new Set(offenders)].join('\n  ')}`,
    );
  });

  test('catch 里给出的是「请求没送到」的提示，而不是笼统的保存失败', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const block of transitionBlocks(source)) {
        if (!/\w+Action\(/.test(block) || !/\btry\s*\{/.test(block)) continue;
        assert.match(
          block,
          /networkFailed/,
          `${relative(SRC, file)} 捕获了异常但没有使用 networkFailed 文案`,
        );
      }
    }
  });

  test('全仓没有把 action 调用写在 transition 之外的 await（同一类风险）', () => {
    // 直接 await 一个 Action（不在 transition / form action 里）同样会抛到 React 外面。
    // 目前所有手动调用都在 transition 内，这里锁住这个约定。
    const bare: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const lines = source.split('\n');
      lines.forEach((line, i) => {
        if (!/await\s+\w+Action\(/.test(line)) return;
        const context = lines.slice(Math.max(0, i - 30), i).join('\n');
        if (!/startTransition|useTransition|try\s*\{/.test(context)) {
          bare.push(`${relative(SRC, file)}:${i + 1}`);
        }
      });
    }
    assert.deepEqual(bare, [], `以下位置裸 await 了 Server Action：\n  ${bare.join('\n  ')}`);
  });
});
