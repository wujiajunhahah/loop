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
