const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('./subscribe.js');

const invoke = ({ body, headers = {}, method = 'POST' }) => new Promise((resolve) => {
  const responseHeaders = {};
  const response = {
    statusCode: 200,
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
    end(payload) {
      resolve({ status: this.statusCode, headers: responseHeaders, body: JSON.parse(payload) });
    },
  };

  handler({ method, headers, body }, response);
});

test('returns validation messages in the requested interface language', async () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = 'test-key';

  try {
    const english = await invoke({
      headers: { 'accept-language': 'zh-CN' },
      body: { email: 'not-an-email', consent: false, locale: 'en' },
    });
    const chinese = await invoke({
      headers: { 'accept-language': 'en-US' },
      body: { email: 'not-an-email', consent: false, locale: 'zh' },
    });

    assert.equal(english.status, 400);
    assert.equal(english.body.message, 'Enter a valid email address and confirm your subscription consent.');
    assert.equal(chinese.status, 400);
    assert.equal(chinese.body.message, '请输入有效邮箱并确认订阅授权。');
  } finally {
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
  }
});

test('sends a concise single-language confirmation email', async () => {
  const previousApiKey = process.env.RESEND_API_KEY;
  const previousFetch = global.fetch;
  const deliveries = [];
  process.env.RESEND_API_KEY = 'test-key';
  global.fetch = async (_url, options) => {
    deliveries.push(JSON.parse(options.body));
    return { ok: true, status: 200 };
  };

  try {
    const english = await invoke({
      headers: { host: 'www.wozai.space', 'x-forwarded-proto': 'https', 'accept-language': 'en-US' },
      body: { email: 'english@example.com', consent: true, locale: 'en' },
    });
    const chinese = await invoke({
      headers: { host: 'www.wozai.space', 'x-forwarded-proto': 'https', 'accept-language': 'zh-CN' },
      body: { email: 'chinese@example.com', consent: true, locale: 'zh' },
    });

    assert.equal(english.status, 200);
    assert.equal(chinese.status, 200);
    assert.equal(deliveries[0].subject, 'One tap. You’re in. | Wozai');
    assert.match(deliveries[0].html, /One tap\.<br \/>You’re in\./);
    assert.doesNotMatch(deliveries[0].html, /[\u3400-\u9fff]/);
    assert.equal(deliveries[1].subject, '确认一下，就好｜我在');
    assert.match(deliveries[1].html, /确认一下，<br \/>就好。/);
    assert.doesNotMatch(deliveries[1].html, /One tap/);
    assert.doesNotMatch(deliveries[0].html, />https:\/\//);
    assert.doesNotMatch(deliveries[1].html, />https:\/\//);
  } finally {
    global.fetch = previousFetch;
    if (previousApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previousApiKey;
  }
});
