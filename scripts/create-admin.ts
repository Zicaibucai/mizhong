/**
 * 创建 / 更新管理员账号（密码不会写入源码、README、Git 或 .env.example）。
 *
 * 交互式运行：
 *   npm run admin:create
 *   npm run admin:create -- admin@example.com
 *
 * 非交互运行（部署用，密码从文件读取，不出现在命令行参数或日志中）：
 *   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD_FILE=/path/to/pw npm run admin:create
 *
 * 交互模式下密码在终端输入时不回显。若邮箱已存在，则重置其密码并确保为 ADMIN 角色。
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as readline from 'node:readline';
import { loadLocalEnv } from './load-env';

loadLocalEnv();

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 12;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const CHAR_EOT = '\u0004'; // Ctrl-D
const CHAR_ETX = '\u0003'; // Ctrl-C
const CHAR_DEL = '\u007f'; // Backspace / Delete
const CHAR_BS = '\b';

function askText(query: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/** 读取密码（TTY 下隐藏回显） */
function askHidden(query: string): Promise<string> {
  return new Promise((resolve) => {
    const input = process.stdin;
    const output = process.stdout;
    output.write(query);

    if (!input.isTTY) {
      input.setEncoding('utf8');
      input.once('data', (chunk: string) => resolve(chunk.replace(/\r?\n$/, '')));
      return;
    }

    const wasRaw = input.isRaw ?? false;
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');

    let value = '';
    const onData = (char: string) => {
      if (char === '\n' || char === '\r' || char === CHAR_EOT) {
        input.setRawMode(wasRaw);
        input.pause();
        input.removeListener('data', onData);
        output.write('\n');
        resolve(value);
        return;
      }
      if (char === CHAR_ETX) {
        output.write('\n');
        process.exit(1);
      }
      if (char === CHAR_DEL || char === CHAR_BS) {
        value = value.slice(0, -1);
        return;
      }
      if (char >= ' ') value += char;
    };

    input.on('data', onData);
  });
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('✗ 未配置 DATABASE_URL。请先完成数据库配置（参见 README）。');
    process.exit(1);
  }

  console.log('创建 / 更新管理员账号\n');

  const passwordFile = process.env.ADMIN_PASSWORD_FILE;
  const nonInteractive = Boolean(passwordFile);

  let email = (process.argv[2] ?? process.env.ADMIN_EMAIL ?? '').trim();
  if (!EMAIL_PATTERN.test(email)) {
    if (nonInteractive) {
      console.error('✗ 非交互模式需要提供合法的 ADMIN_EMAIL 或命令行邮箱参数。');
      process.exit(1);
    }
    let attempts = 0;
    while (!EMAIL_PATTERN.test(email) && attempts < 5) {
      email = (await askText('管理员邮箱: ')).trim();
      attempts += 1;
    }
    if (!EMAIL_PATTERN.test(email)) {
      console.error('✗ 邮箱格式不正确。');
      process.exit(1);
    }
  }
  email = email.toLowerCase();

  let password: string;
  if (passwordFile) {
    try {
      password = readFileSync(passwordFile, 'utf8').replace(/\r?\n$/, '');
    } catch {
      console.error('✗ 无法读取 ADMIN_PASSWORD_FILE 指定的文件。');
      process.exit(1);
    }
  } else {
    password = await askHidden(`密码（至少 ${MIN_PASSWORD_LENGTH} 位，输入时不显示）: `);
    const confirm = await askHidden('再次输入密码确认: ');
    if (password !== confirm) {
      console.error('\n✗ 两次输入的密码不一致。');
      process.exit(1);
    }
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    console.error(`\n✗ 密码至少需要 ${MIN_PASSWORD_LENGTH} 位。`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role: 'ADMIN', enabled: true },
    });
    console.log(`\n✓ 已更新管理员密码：${email}（角色 ADMIN）`);
  } else {
    await prisma.user.create({
      data: { email, passwordHash, role: 'ADMIN', enabled: true },
    });
    console.log(`\n✓ 已创建管理员：${email}（角色 ADMIN）`);
  }

  console.log('请使用该邮箱与密码登录 /admin/login。密码仅在本次输入中使用，未被保存到任何文件。');
}

main()
  .catch((error) => {
    console.error('执行失败：', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
