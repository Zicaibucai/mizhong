import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Server Action 的权限守卫检查。
 *
 * 这类 bug 的特点是「看起来一切正常」：漏掉守卫的 action 照样能跑、照样返回成功，
 * 只是**任何人都能调用它**。靠人工 review 很难发现，因为要逐个函数去看第一行写没写。
 *
 * 所以这里做一件很直接的事：把所有 `'use server'` 模块里的导出函数逐个拆出来，
 * 检查函数体里有没有 `requireAdminOrError`。新增一个忘了加守卫的 action，
 * 这个测试立刻会红 —— 这正是我们想要的失败方式。
 *
 * 唯一被豁免的是 `auth.ts`：`loginAction` 必须在**尚未登录**时可用，
 * 否则永远登不进去；`logoutAction` 也不涉及敏感数据。
 */

const ACTIONS_DIR = join(process.cwd(), 'src/lib/admin/actions');

/** 允许不校验管理员会话的模块，以及原因 */
const EXEMPT_MODULES: Record<string, string> = {
  'auth.ts': 'loginAction 必须在未登录时可用；logoutAction 不读取或修改任何数据',
};

interface ActionSource {
  file: string;
  name: string;
  body: string;
}

/**
 * 把文件按 `export async function` 切开，逐个取出函数名与函数体。
 *
 * 不用真正的 AST：这里只关心「函数体里有没有出现某个标识符」，
 * 按导出边界切分已经足够准确，而且不引入新依赖。
 */
function readActions(): ActionSource[] {
  const files = readdirSync(ACTIONS_DIR).filter((name) => name.endsWith('.ts'));
  const actions: ActionSource[] = [];

  for (const file of files) {
    const source = readFileSync(join(ACTIONS_DIR, file), 'utf8');
    assert.ok(source.startsWith("'use server'"), `${file} 应当以 'use server' 开头`);

    const chunks = source.split(/\nexport async function\s+/).slice(1);
    for (const chunk of chunks) {
      const name = chunk.slice(0, chunk.indexOf('(')).trim();
      actions.push({ file, name, body: chunk });
    }
  }

  return actions;
}

describe('每个 Server Action 都校验管理员会话', () => {
  const actions = readActions();

  test('确实扫到了全部 action（防止正则失效后测试静默通过）', () => {
    assert.ok(actions.length >= 40, `只扫到 ${actions.length} 个 action，扫描逻辑可能失效了`);
    assert.ok(actions.some((action) => action.file === 'translation.ts'));
    assert.ok(actions.some((action) => action.file === 'products.ts'));
    // 语言同步是花真钱的入口，必须确认它真的被扫到了 ——
    // 只靠上面那条「全部 action 都有守卫」是不够的：万一扫描本身漏了这个文件，
    // 它会以「没有 action」的形式静默通过。
    assert.ok(actions.some((action) => action.file === 'sync.ts'), 'sync.ts 没有被扫到');
    assert.ok(actions.some((action) => action.file === 'pages.ts'));
  });

  test('翻译相关 action 都调用 requireAdminOrError', () => {
    const translation = actions.filter((action) => action.file === 'translation.ts');
    assert.ok(translation.length >= 3, `translation.ts 只找到 ${translation.length} 个 action`);
    for (const action of translation) {
      assert.match(
        action.body,
        /requireAdminOrError/,
        `translation.ts 的 ${action.name} 没有校验管理员会话`,
      );
    }
  });

  test('除 auth.ts 外，所有 action 都调用 requireAdminOrError', () => {
    const unguarded = actions
      .filter((action) => !(action.file in EXEMPT_MODULES))
      .filter((action) => !/requireAdminOrError/.test(action.body))
      .map((action) => `${action.file} → ${action.name}`);

    assert.deepEqual(
      unguarded,
      [],
      `以下 Server Action 没有校验管理员会话，任何人都能调用：\n  ${unguarded.join('\n  ')}`,
    );
  });

  test('守卫出现在读取配置与调用外部接口之前', () => {
    for (const action of actions.filter((a) => a.file === 'translation.ts')) {
      const guardAt = action.body.indexOf('requireAdminOrError');
      const riskyAt = Math.min(
        ...[action.body.indexOf('loadTranslationSettings'), action.body.indexOf('translateWithDeepSeek')]
          .filter((index) => index >= 0),
      );
      assert.ok(guardAt >= 0, `${action.name} 没有守卫`);
      assert.ok(
        Number.isNaN(riskyAt) || guardAt < riskyAt,
        `${action.name} 先碰了敏感操作才校验会话`,
      );
    }
  });

  test('auth.ts 是唯一被豁免的模块，且豁免理由写在测试里', () => {
    assert.deepEqual(Object.keys(EXEMPT_MODULES), ['auth.ts']);
    const exempt = actions.filter((action) => action.file in EXEMPT_MODULES);
    assert.ok(exempt.length > 0);
    assert.deepEqual(
      exempt.map((action) => action.name).sort(),
      ['loginAction', 'logoutAction'],
      'auth.ts 里出现了预期之外的 action，需要重新评估它是否也该校验会话',
    );
  });
});
