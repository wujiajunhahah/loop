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

function resolveLocale(input, request) {
  const requested = clean(input?.locale, 16).toLowerCase();
  if (requested.startsWith('zh')) return 'zh';
  if (requested.startsWith('en')) return 'en';
  const accepted = clean(request.headers['accept-language'], 200).toLowerCase();
  return accepted.startsWith('zh') ? 'zh' : 'en';
}

function localized(locale, chinese, english) {
  return locale === 'zh' ? chinese : english;
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function buildConfirmationEmail(confirmUrl, locale) {
  const copy = locale === 'zh'
    ? {
      lang: 'zh-CN',
      brand: '我在',
      subject: '确认一下，就好｜我在',
      preheader: '点一下，偶尔收到「我在」值得分享的新消息。',
      eyebrow: '我在 · 确认订阅',
      title: '确认一下，<br />就好。',
      lead: '点一下，偶尔收到产品新进展与共创邀请。<br />只在值得说的时候写信。',
      button: '确认订阅',
      validity: '链接 24 小时内有效',
      ignore: '不是你？忽略即可。',
      fallback: '按钮没有打开？使用备用确认链接',
      footer: '把重要的话，好好留下。',
      footerMeta: '我在 · WOZAI.SPACE',
      textTitle: '确认一下，就好。',
      textLead: '点一下，偶尔收到「我在」的产品新进展与共创邀请。只在值得说的时候写信。',
      textAction: '确认订阅：',
    }
    : {
      lang: 'en',
      brand: 'Wozai',
      subject: 'One tap. You’re in. | Wozai',
      preheader: 'Confirm once, then hear from Wozai only when there is something worth sharing.',
      eyebrow: 'WOZAI · CONFIRM SUBSCRIPTION',
      title: 'One tap.<br />You’re in.',
      lead: 'Get occasional product notes and co-creation invitations.<br />We only write when there is something worth sharing.',
      button: 'Confirm subscription',
      validity: 'This link is valid for 24 hours',
      ignore: 'Not you? Ignore this email.',
      fallback: 'Button not working? Use the backup confirmation link',
      footer: 'Leave what matters, with care.',
      footerMeta: 'WOZAI.SPACE',
      textTitle: 'One tap. You’re in.',
      textLead: 'Get occasional Wozai product notes and co-creation invitations. We only write when there is something worth sharing.',
      textAction: 'Confirm your subscription:',
    };

  const text = [
    copy.textTitle,
    '',
    copy.textLead,
    '',
    copy.textAction,
    confirmUrl,
    '',
    `${copy.validity}. ${copy.ignore}`,
    '',
    `${copy.brand} · ${copy.footer}`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="${copy.lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>${copy.subject}</title>
    <style>
      @media only screen and (max-width: 620px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 28px !important; padding-right: 28px !important; }
        .email-title { font-size: 42px !important; }
        .email-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#e9e5db;color:#162b3c;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${copy.preheader}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#e9e5db;">
      <tr>
        <td align="center" style="padding:42px 14px;">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:560px;max-width:560px;background:#fffdf8;border:1px solid #d8d2c7;border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(22,43,60,.10);">
            <tr>
              <td class="email-pad" style="padding:30px 44px 26px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="50" valign="middle"><img src="${LOGO_URL}" width="46" height="37" alt="${copy.brand}" style="display:block;width:46px;height:37px;object-fit:contain;border:0;" /></td>
                    <td valign="middle" style="padding-left:10px;font-family:'Songti SC','STSong',Georgia,serif;font-size:23px;font-weight:700;letter-spacing:.08em;color:#162b3c;">${copy.brand}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:36px 44px 50px;border-top:1px solid #e8e2d8;">
                <p style="margin:0 0 18px;font-family:Arial,'PingFang SC',sans-serif;font-size:10px;font-weight:700;letter-spacing:.18em;color:#2c61d6;">${copy.eyebrow}</p>
                <h1 class="email-title" style="margin:0 0 22px;font-family:'Songti SC','STSong',Georgia,serif;font-size:52px;font-weight:600;line-height:1.12;letter-spacing:-.035em;color:#162b3c;">${copy.title}</h1>
                <p style="margin:0 0 30px;font-family:Arial,'PingFang SC',sans-serif;font-size:15px;line-height:1.85;color:#5d686d;">${copy.lead}</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 22px;">
                  <tr>
                    <td bgcolor="#162b3c" style="border-radius:999px;">
                      <a class="email-button" href="${confirmUrl}" style="display:inline-block;padding:16px 28px;font-family:Arial,'PingFang SC',sans-serif;font-size:14px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">${copy.button}&nbsp;&nbsp;→</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0;font-family:Arial,'PingFang SC',sans-serif;font-size:11px;line-height:1.7;color:#858b88;">${copy.validity}&nbsp;&nbsp;·&nbsp;&nbsp;${copy.ignore}</p>
                <p style="margin:16px 0 0;font-family:Arial,'PingFang SC',sans-serif;font-size:10px;line-height:1.7;color:#9a9e9a;"><a href="${confirmUrl}" style="color:#7c858b;text-decoration:underline;text-underline-offset:3px;">${copy.fallback}</a></p>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:22px 44px 25px;background:#162b3c;">
                <p style="margin:0;font-family:'Songti SC','STSong',Georgia,serif;font-size:14px;line-height:1.7;color:#fffdf8;">${copy.footer}</p>
                <p style="margin:5px 0 0;font-family:Arial,'PingFang SC',sans-serif;font-size:9px;letter-spacing:.12em;color:#91a1ad;">${copy.footerMeta}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: copy.subject, text, html };
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

  let locale = resolveLocale(null, request);
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return reply(response, {
      ok: false,
      message: localized(locale, '订阅服务尚未配置，请稍后再试。', 'The subscription service is not configured yet. Please try again later.'),
    }, 503);
  }

  let input;
  try {
    input = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;
    if (!input || typeof input !== 'object') throw new Error('Invalid body');
  } catch {
    return reply(response, {
      ok: false,
      message: localized(locale, '提交内容格式不正确。', 'The submitted data is not valid.'),
    }, 400);
  }

  locale = resolveLocale(input, request);

  if (clean(input.website, 200)) {
    return reply(response, {
      ok: true,
      message: localized(locale, '确认邮件已经发送，请查看邮箱。', 'Confirmation email sent. Please check your inbox.'),
    });
  }

  const email = clean(input.email, 254).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || input.consent !== true) {
    return reply(response, {
      ok: false,
      message: localized(locale, '请输入有效邮箱并确认订阅授权。', 'Enter a valid email address and confirm your subscription consent.'),
    }, 400);
  }

  const expires = Date.now() + 24 * 60 * 60 * 1000;
  const unsigned = JSON.stringify({ email, expires });
  const signature = sign(unsigned, process.env.SUBSCRIBE_TOKEN_SECRET || apiKey);
  const token = toBase64Url(JSON.stringify({ email, expires, signature }));
  const requestOrigin = `${request.headers['x-forwarded-proto'] || 'https'}://${request.headers.host}`;
  const siteUrl = (process.env.SITE_URL || requestOrigin).replace(/\/$/, '');
  const confirmUrl = `${siteUrl}/api/confirm-subscription?token=${encodeURIComponent(token)}`;
  const sender = process.env.RESEND_FROM_EMAIL || '我在 <hello@wozai.space>';
  const emailContent = buildConfirmationEmail(confirmUrl, locale);

  try {
    await sendConfirmation(apiKey, {
      from: sender,
      to: [email],
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    });
  } catch {
    console.error('Subscription confirmation failed');
    return reply(response, {
      ok: false,
      message: localized(locale, '确认邮件暂时没有发出，请稍后再试。', 'We could not send the confirmation email just now. Please try again later.'),
    }, 502);
  }

  return reply(response, {
    ok: true,
    message: localized(
      locale,
      '确认邮件已经发送，请在 24 小时内完成确认。',
      'Confirmation email sent — please confirm within 24 hours.',
    ),
  });
};
