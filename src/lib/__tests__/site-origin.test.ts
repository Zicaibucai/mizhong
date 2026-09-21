import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import { parseForwardedProto, resolveSiteOrigin, PRODUCTION_ORIGIN } from '@/lib/site-origin';

const ENV_KEY = 'NEXT_PUBLIC_SITE_URL';
let envSnapshot: string | undefined;

beforeEach(() => {
  envSnapshot = process.env[ENV_KEY];
  delete process.env[ENV_KEY];
});

afterEach(() => {
  if (envSnapshot === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = envSnapshot;
});

/** 直接调用 middleware，返回响应（不启服务） */
function redirectFor(path: string, headers: Record<string, string>) {
  const request = new NextRequest(`http://htd123.com${path}`, { headers });
  return middleware(request);
}

describe('站点 origin 解析', () => {
  test('生产域名的 http 写法收敛到正式 HTTPS origin', () => {
    assert.equal(
      resolveSiteOrigin({ configured: 'http://htd123.com', fallback: 'http://localhost:3000' }),
      PRODUCTION_ORIGIN,
    );
  });

  test('www 与公网 IP 同样收敛，端口不参与判断', () => {
    for (const configured of [
      'http://www.htd123.com',
      'https://www.htd123.com',
      'http://47.238.7.93',
      'https://47.238.7.93:443',
      'http://HTD123.com:80',
      'http://htd123.com.',
    ]) {
      assert.equal(
        resolveSiteOrigin({ configured, fallback: 'http://localhost:3000' }),
        PRODUCTION_ORIGIN,
        `${configured} 应收敛到正式 origin`,
      );
    }
  });

  test('非生产地址原样保留，本机开发不受影响', () => {
    assert.equal(
      resolveSiteOrigin({ configured: 'http://localhost:3000', fallback: PRODUCTION_ORIGIN }),
      'http://localhost:3000',
    );
    assert.equal(
      resolveSiteOrigin({ configured: 'https://staging.example.com', fallback: PRODUCTION_ORIGIN }),
      'https://staging.example.com',
    );
  });

  test('漏写协议或协议非法时按未配置处理，用兜底值', () => {
    for (const configured of ['', '   ', 'htd123.com', 'ftp://htd123.com', '//htd123.com']) {
      assert.equal(
        resolveSiteOrigin({ configured, fallback: 'http://localhost:3000' }),
        'http://localhost:3000',
        `${JSON.stringify(configured)} 应回落到兜底值`,
      );
    }
  });

  test('配置缺失时按请求头解析：生产域名 + 无 X-Forwarded-Proto 仍是 HTTPS', () => {
    assert.equal(
      resolveSiteOrigin({ host: 'htd123.com', fallback: 'http://127.0.0.1:3000' }),
      PRODUCTION_ORIGIN,
    );
  });

  test('X-Forwarded-Proto 是代理链列表时取第一段', () => {
    assert.equal(
      resolveSiteOrigin({
        host: 'htd123.com',
        proto: 'https, http',
        fallback: 'http://127.0.0.1:3000',
      }),
      PRODUCTION_ORIGIN,
    );
    assert.equal(
      resolveSiteOrigin({
        host: 'preview.example.com',
        proto: 'HTTPS, http',
        fallback: 'http://127.0.0.1:3000',
      }),
      'https://preview.example.com',
    );
  });

  test('非生产主机名按请求头协议保留 http', () => {
    assert.equal(
      resolveSiteOrigin({ host: 'localhost:3000', fallback: PRODUCTION_ORIGIN }),
      'http://localhost:3000',
    );
    assert.equal(
      resolveSiteOrigin({ host: '127.0.0.1:3100', proto: 'http', fallback: PRODUCTION_ORIGIN }),
      'http://127.0.0.1:3100',
    );
  });

  test('Host 不可信时不拼进 Location，回落到兜底值', () => {
    for (const host of ['evil.com/zh', 'htd123.com\r\nX-Injected: 1', 'a b', '', '.']) {
      assert.equal(
        resolveSiteOrigin({ host, fallback: PRODUCTION_ORIGIN }),
        PRODUCTION_ORIGIN,
        `Host ${JSON.stringify(host)} 不应被拼进 origin`,
      );
    }
  });
});

describe('X-Forwarded-Proto 解析', () => {
  test('识别单值与列表首段，其余返回 undefined', () => {
    assert.equal(parseForwardedProto('https'), 'https');
    assert.equal(parseForwardedProto(' http '), 'http');
    assert.equal(parseForwardedProto('https, http'), 'https');
    assert.equal(parseForwardedProto('HTTPS'), 'https');
    assert.equal(parseForwardedProto('https2'), undefined);
    assert.equal(parseForwardedProto(''), undefined);
    assert.equal(parseForwardedProto(null), undefined);
    assert.equal(parseForwardedProto(undefined), undefined);
  });
});

describe('语言前缀重定向的协议', () => {
  test('构建时没带上 SITE_URL 时，首页仍跳到 HTTPS（回归：曾经跳去 http）', () => {
    const response = redirectFor('/', { host: 'htd123.com' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), 'https://htd123.com/zh');
  });

  test('代理链写法不会把首页降级成 http（回归）', () => {
    const response = redirectFor('/', {
      host: 'htd123.com',
      'x-forwarded-proto': 'https, http',
    });
    assert.equal(response.headers.get('location'), 'https://htd123.com/zh');
  });

  test('深链接与查询串原样保留', () => {
    const response = redirectFor('/products?page=2&q=sofa', { host: 'htd123.com' });
    assert.equal(response.headers.get('location'), 'https://htd123.com/zh/products?page=2&q=sofa');
  });

  test('www 访问收敛到正式域名', () => {
    const response = redirectFor('/', { host: 'www.htd123.com', 'x-forwarded-host': 'www.htd123.com' });
    assert.equal(response.headers.get('location'), 'https://htd123.com/zh');
  });

  test('配置了站点地址时按其解析，http 写法同样收敛', () => {
    process.env[ENV_KEY] = 'http://htd123.com';
    assert.equal(redirectFor('/', { host: 'htd123.com' }).headers.get('location'), 'https://htd123.com/zh');
  });

  test('本机开发仍跳本机地址，不会被抬成正式域名', () => {
    process.env[ENV_KEY] = 'http://localhost:3000';
    assert.equal(
      redirectFor('/', { host: 'localhost:3000' }).headers.get('location'),
      'http://localhost:3000/zh',
    );
  });

  test('带语言前缀的请求与后台/接口路径放行', () => {
    for (const path of ['/zh', '/en/products', '/admin/login', '/api/health']) {
      const response = redirectFor(path, { host: 'htd123.com' });
      assert.equal(response.headers.get('location'), null, `${path} 不应被重定向`);
      assert.equal(response.headers.get('x-middleware-next'), '1', `${path} 应直接放行`);
    }
  });
});
