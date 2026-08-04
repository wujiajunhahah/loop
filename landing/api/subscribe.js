const { createHmac } = require('node:crypto');

const RESEND_API = 'https://api.resend.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LOGO_URL = 'https://www.wozai.space/assets/brand-symbol-email.png';

function reply(response, data, status = 200) {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.end(JSON.stringify(data));
}

function clean(value, maxLength) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function buildConfirmationEmail(confirmUrl) {
  const text = [
    '再确认一下，我们就保持一点联系。',
    '',
    '请在 24 小时内打开下面的链接，确认订阅「我在」的产品近况、共创邀请与新内容：',
    '',
    confirmUrl,
    '',
    '如果这不是你的操作，可以直接忽略。你的邮箱不会进入订阅名单。',
    '',
    '我在｜真实地留下，交给对的人，在未来有分寸地出现。',
  ].join('\n');

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>确认订阅「我在」</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 26px !important; padding-right: 26px !important; }
        .email-title { font-size: 34px !important; line-height: 1.28 !important; }
        .email-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#e8e3d9;color:#162b3c;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">再确认一步，我们就偶尔把「我在」的近况送到你身边。</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#e8e3d9;">
      <tr>
        <td align="center" style="padding:34px 14px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:600px;max-width:600px;background:#fffdf8;border:1px solid #d8d2c7;border-radius:22px;overflow:hidden;">
            <tr>
              <td class="email-pad" style="padding:34px 48px 24px;border-bottom:1px solid #e5dfd4;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="54" valign="middle"><img src="${LOGO_URL}" width="50" height="40" alt="我在" style="display:block;width:50px;height:40px;object-fit:contain;border:0;" /></td>
                    <td valign="middle" style="padding-left:11px;font-family:'Songti SC','STSong',Georgia,serif;font-size:25px;font-weight:700;letter-spacing:.08em;color:#162b3c;">我在</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:52px 48px 46px;">
                <p style="margin:0 0 18px;font-family:Arial,'PingFang SC',sans-serif;font-size:11px;font-weight:700;letter-spacing:.18em;color:#2c61d6;">确认订阅 · 只差一步</p>
                <h1 class="email-title" style="margin:0 0 24px;font-family:'Songti SC','STSong',Georgia,serif;font-size:43px;font-weight:600;line-height:1.3;letter-spacing:-.02em;color:#162b3c;">再确认一下，<br />我们就保持一点联系。</h1>
                <p style="margin:0 0 30px;font-family:Arial,'PingFang SC',sans-serif;font-size:15px;line-height:1.9;color:#52606a;">偶尔收到「我在」的产品进展、共创邀请与认真写下的新内容。不会频繁打扰，也不会把你的邮箱用于未说明的用途。</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 28px;">
                  <tr>
                    <td bgcolor="#2c61d6" style="border-radius:999px;">
                      <a class="email-button" href="${confirmUrl}" style="display:inline-block;padding:14px 27px;font-family:Arial,'PingFang SC',sans-serif;font-size:14px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">确认订阅&nbsp;&nbsp;→</a>
                    </td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#f2eee5;border-radius:12px;">
                  <tr>
                    <td style="padding:15px 17px;font-family:Arial,'PingFang SC',sans-serif;font-size:12px;line-height:1.7;color:#6b726f;">
                      <strong style="color:#40515c;">24 小时内有效</strong>&nbsp;&nbsp;·&nbsp;&nbsp;如果这不是你的操作，可以直接忽略，你的邮箱不会进入订阅名单。
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-family:Arial,'PingFang SC',sans-serif;font-size:11px;line-height:1.8;color:#8a8f8c;word-break:break-all;">按钮无法打开时，请复制这个地址：<br /><a href="${confirmUrl}" style="color:#667a94;text-decoration:underline;">${confirmUrl}</a></p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:25px 48px 30px;background:#f4f1e9;border-top:1px solid #e5dfd4;">
                <p style="margin:0 0 6px;font-family:'Songti SC','STSong',Georgia,serif;font-size:14px;color:#40515c;">真实地留下，交给对的人，在未来有分寸地出现。</p>
                <p style="margin:0;font-family:Arial,'PingFang SC',sans-serif;font-size:10px;line-height:1.7;color:#929691;">我在 · wozai.space&nbsp;&nbsp;｜&nbsp;&nbsp;这是一封订阅确认邮件，不是营销邮件。</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
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

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    return reply(response, { ok: false, message: 'Method not allowed' }, 405);
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return reply(response, { ok: false, message: '订阅服务尚未配置，请稍后再试。' }, 503);
  }

  let input;
  try {
    input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!input || typeof input !== 'object') throw new Error('Invalid body');
  } catch {
    return reply(response, { ok: false, message: '提交内容格式不正确。' }, 400);
  }

  if (clean(input.website, 200)) {
    return reply(response, { ok: true, message: '确认邮件已经发送，请查看邮箱。' });
  }

  const email = clean(input.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || input.consent !== true) {
    return reply(response, { ok: false, message: '请输入有效邮箱并确认订阅授权。' }, 400);
  }

  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const unsigned = JSON.stringify({ email, expires });
  const signature = sign(unsigned, process.env.SUBSCRIBE_TOKEN_SECRET || apiKey);
  const token = toBase64Url(JSON.stringify({ email, expires, signature }));
  const requestOrigin = `${request.headers['x-forwarded-proto'] || 'https'}://${request.headers.host}`;
  const siteUrl = (process.env.SITE_URL || requestOrigin).replace(/\/$/, '');
  const confirmUrl = `${siteUrl}/api/confirm-subscription?token=${encodeURIComponent(token)}`;
  const sender = process.env.RESEND_FROM_EMAIL || '我在 <hello@wozai.space>';
  const emailContent = buildConfirmationEmail(confirmUrl);

  try {
    await sendConfirmation(apiKey, {
      from: sender,
      to: [email],
      subject: '再确认一下，我们就保持一点联系｜我在',
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch {
    console.error('Subscription confirmation failed');
    return reply(response, { ok: false, message: '确认邮件暂时没有发出，请稍后再试。' }, 502);
  }

  return reply(response, { ok: true, message: '确认邮件已经发送，请在 24 小时内完成确认。' });
};
