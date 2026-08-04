const RESEND_API = 'https://api.resend.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function reply(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function clean(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function toBase64Url(value) {
  return btoa(value).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

async function sign(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return toBase64Url(String.fromCharCode(...new Uint8Array(signature)));
}

async function sendConfirmation(apiKey, body) {
  const response = await fetch(`${RESEND_API}/emails`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error(`Resend request failed with ${response.status}`);
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return reply({ ok: false, message: 'Method not allowed' }, 405);
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return reply({ ok: false, message: '订阅服务尚未配置，请稍后再试。' }, 503);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return reply({ ok: false, message: '提交内容格式不正确。' }, 400);
    }

    if (clean(input.website, 200)) {
      return reply({ ok: true, message: '确认邮件已经发送，请查看邮箱。' });
    }

    const email = clean(input.email, 254).toLowerCase();
    if (!EMAIL_PATTERN.test(email) || input.consent !== true) {
      return reply({ ok: false, message: '请输入有效邮箱并确认订阅授权。' }, 400);
    }

    const expires = Date.now() + 24 * 60 * 60 * 1000;
    const unsigned = JSON.stringify({ email, expires });
    const signature = await sign(unsigned, process.env.SUBSCRIBE_TOKEN_SECRET || apiKey);
    const token = toBase64Url(JSON.stringify({ email, expires, signature }));
    const siteUrl = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    const confirmUrl = `${siteUrl}/api/confirm-subscription?token=${encodeURIComponent(token)}`;
    const sender = process.env.RESEND_FROM_EMAIL || '我在 <hello@wozai.space>';

    try {
      await sendConfirmation(apiKey, {
        from: sender,
        to: [email],
        subject: '确认订阅「我在」的近况',
        text: `请在 24 小时内打开下面的链接，确认订阅「我在」的产品近况与共创消息：\n\n${confirmUrl}\n\n如果这不是你的操作，可以直接忽略。`,
        html: `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.8;color:#162b3c"><p>你好，</p><p>请确认你希望收到「我在」的产品近况与共创消息。</p><p><a href="${confirmUrl}" style="display:inline-block;padding:12px 20px;border-radius:999px;background:#2c61d6;color:#fff;text-decoration:none">确认订阅</a></p><p style="color:#66727a;font-size:13px">链接在 24 小时内有效。如果这不是你的操作，可以直接忽略。</p></div>`,
      });
    } catch (error) {
      console.error('Subscription confirmation failed');
      return reply({ ok: false, message: '确认邮件暂时没有发出，请稍后再试。' }, 502);
    }

    return reply({ ok: true, message: '确认邮件已经发送，请在 24 小时内完成确认。' });
  },
};
