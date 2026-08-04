const { createHmac } = require('node:crypto');

const RESEND_API = 'https://api.resend.com';
const LOGO_URL = 'https://www.wozai.space/assets/brand-symbol-email.png';

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

async function resend(path, apiKey, method, body) {
  return fetch(`${RESEND_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function redirect(response, siteUrl, state) {
  response.statusCode = 302;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Location', state === 'confirmed' ? `${siteUrl}/subscribed` : `${siteUrl}/subscribed?status=${state}`);
  response.end();
}

function buildWelcomeEmail(siteUrl) {
  const homepageUrl = `${siteUrl}/`;
  const text = [
    '你已经在这里了。',
    'You’re in — your Wozai subscription is confirmed.',
    '',
    '谢谢你支持这个仍在早期阶段的项目。',
    'Thank you for supporting this early-stage project.',
    '',
    '先说明一下：「我在」目前处于 Preview / 封闭共创阶段。现在还没有可下载的正式产品；网站上展示的是我们正在构建的方向、原则与概念预览。',
    'Quick expectation check: Wozai is currently in Preview / closed co-creation. There is nothing to download yet; the website is a concept preview of what we are building.',
    '',
    '现在，你可以 / What you can do right now',
    '01 了解网站上的产品愿景 / Explore the preview and understand the vision.',
    '02 继续订阅，等待未来的体验与共创邀请 / Stay subscribed for future preview and co-creation invitations.',
    '03 把想法、顾虑与建议告诉我们 / Share feedback that directly shapes what we build next.',
    '',
    `回到「我在」：${homepageUrl}`,
    `联系我们 / Contact us: mailto:hello@wozai.space`,
    '',
    '我们仍在早期共创与验证阶段，许多部分正在开始和完善。你的支持与建议对我们很重要。',
    'We are still in an early co-creation and validation phase. Your support and thoughtful feedback mean a great deal.',
    '',
    '—「我在」团队 / Wozai Team',
    '真实记录，安心托付，未来相见。',
    'Real memories, entrusted with care, meeting again in the future.',
  ].join('\n');

  const html = `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light only" />
    <title>欢迎来到「我在」 · Welcome to Wozai</title>
    <style>
      @media only screen and (max-width: 640px) {
        .email-shell { width: 100% !important; }
        .email-pad { padding-left: 26px !important; padding-right: 26px !important; }
        .welcome-title { font-size: 39px !important; }
        .email-button { display: block !important; text-align: center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#e8e3d9;color:#162b3c;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">订阅已经确认。You’re in — your Wozai subscription is confirmed.</div>
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
              <td class="email-pad" style="padding:26px 48px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;background:#162b3c;border-radius:18px;">
                  <tr>
                    <td style="padding:42px 38px 40px;">
                      <p style="margin:0 0 15px;font-family:Arial,'PingFang SC',sans-serif;font-size:10px;font-weight:700;letter-spacing:.2em;color:#8eaff6;">订阅成功 · WELCOME</p>
                      <h1 class="welcome-title" style="margin:0 0 17px;font-family:'Songti SC','STSong',Georgia,serif;font-size:48px;font-weight:600;line-height:1.25;letter-spacing:-.02em;color:#fffdf8;">你已经<br />在这里了。</h1>
                      <p style="margin:0 0 8px;font-family:Arial,'PingFang SC',sans-serif;font-size:14px;line-height:1.9;color:#d7dce0;">谢谢你愿意与「我在」保持一点联系，也谢谢你支持这个仍在早期阶段的项目。</p>
                      <p style="margin:0;font-family:Georgia,serif;font-size:15px;font-style:italic;line-height:1.7;color:#9eb7ec;">You’re in — your Wozai subscription is confirmed. Thank you for supporting this early-stage project.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:40px 48px 46px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;margin:0 0 34px;background:#f2eee5;border-radius:14px;">
                  <tr>
                    <td style="padding:22px 24px;">
                      <p style="margin:0 0 9px;font-family:Arial,'PingFang SC',sans-serif;font-size:10px;font-weight:700;letter-spacing:.16em;color:#2c61d6;">当前阶段 · QUICK EXPECTATION CHECK</p>
                      <p style="margin:0 0 7px;font-family:'Songti SC','STSong',Georgia,serif;font-size:17px;line-height:1.65;color:#263d4d;">「我在」目前处于 Preview / 封闭共创阶段。</p>
                      <p style="margin:0 0 6px;font-family:Arial,'PingFang SC',sans-serif;font-size:12px;line-height:1.8;color:#6f7775;">现在还没有可下载的正式产品；你在网站上看到的是我们正在构建的方向、原则与概念预览。</p>
                      <p style="margin:0;font-family:Arial,'PingFang SC',sans-serif;font-size:11px;line-height:1.75;color:#8b908d;">There is nothing to download yet. The website is a concept preview of the direction, principles, and experience we are building.</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 23px;font-family:'Songti SC','STSong',Georgia,serif;font-size:22px;line-height:1.6;color:#162b3c;">现在，你可以 <span style="font-family:Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:.1em;color:#2c61d6;">· WHAT YOU CAN DO RIGHT NOW</span></p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;">
                  <tr>
                    <td width="45" valign="top" style="padding:0 0 20px;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#2c61d6;">01</td>
                    <td valign="top" style="padding:0 0 20px;border-bottom:1px solid #e8e2d8;">
                      <p style="margin:0 0 4px;font-family:Arial,'PingFang SC',sans-serif;font-size:14px;font-weight:700;color:#263d4d;">了解我们的方向</p>
                      <p style="margin:0;font-family:Arial,'PingFang SC',sans-serif;font-size:12px;line-height:1.75;color:#737b7b;">Explore the preview and understand the vision.</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="45" valign="top" style="padding:20px 0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#668b78;">02</td>
                    <td valign="top" style="padding:20px 0;border-bottom:1px solid #e8e2d8;">
                      <p style="margin:0 0 4px;font-family:Arial,'PingFang SC',sans-serif;font-size:14px;font-weight:700;color:#263d4d;">等待共创邀请</p>
                      <p style="margin:0;font-family:Arial,'PingFang SC',sans-serif;font-size:12px;line-height:1.75;color:#737b7b;">Stay subscribed for future preview and co-creation invitations.</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="45" valign="top" style="padding:20px 0 0;font-family:Arial,sans-serif;font-size:11px;font-weight:700;color:#d57863;">03</td>
                    <td valign="top" style="padding:20px 0 0;">
                      <p style="margin:0 0 4px;font-family:Arial,'PingFang SC',sans-serif;font-size:14px;font-weight:700;color:#263d4d;">把想法告诉我们</p>
                      <p style="margin:0;font-family:Arial,'PingFang SC',sans-serif;font-size:12px;line-height:1.75;color:#737b7b;">Share feedback that directly shapes what we build next.</p>
                    </td>
                  </tr>
                </table>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:34px 0 0;">
                  <tr>
                    <td bgcolor="#2c61d6" style="border-radius:999px;">
                      <a class="email-button" href="${homepageUrl}" style="display:inline-block;padding:14px 27px;font-family:Arial,'PingFang SC',sans-serif;font-size:14px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:999px;">回到「我在」 / Visit Wozai&nbsp;&nbsp;→</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="email-pad" style="padding:25px 48px 30px;background:#f4f1e9;border-top:1px solid #e5dfd4;">
                <p style="margin:0 0 6px;font-family:Arial,'PingFang SC',sans-serif;font-size:11px;line-height:1.8;color:#6f7775;">我们仍在早期共创与验证阶段，许多部分正在开始和完善。你的支持与建议对我们很重要。</p>
                <p style="margin:0 0 16px;font-family:Arial,'PingFang SC',sans-serif;font-size:10px;line-height:1.75;color:#929691;">We are still in an early co-creation and validation phase. Your support and thoughtful feedback mean a great deal. <a href="mailto:hello@wozai.space" style="color:#667a94;">联系我们 / Contact us</a></p>
                <p style="margin:0 0 6px;font-family:'Songti SC','STSong',Georgia,serif;font-size:14px;color:#40515c;">—「我在」团队 · Wozai Team</p>
                <p style="margin:0 0 4px;font-family:'Songti SC','STSong',Georgia,serif;font-size:13px;color:#40515c;">真实记录，安心托付，未来相见。</p>
                <p style="margin:0 0 8px;font-family:Arial,'PingFang SC',sans-serif;font-size:10px;line-height:1.7;color:#7d8581;">Real memories, entrusted with care, meeting again in the future.</p>
                <p style="margin:0;font-family:Arial,'PingFang SC',sans-serif;font-size:9px;line-height:1.7;color:#9a9e9a;">我在 · wozai.space&nbsp;&nbsp;｜&nbsp;&nbsp;你收到这封信，是因为刚刚确认了订阅。未来近况邮件会提供退订方式。 You received this after confirming your subscription; future updates will include an unsubscribe option.</p>
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

module.exports = async function handler(request, response) {
  const apiKey = process.env.RESEND_API_KEY;
  const secret = process.env.SUBSCRIBE_TOKEN_SECRET || apiKey;
  const requestOrigin = `${request.headers['x-forwarded-proto'] || 'https'}://${request.headers.host}`;
  const siteUrl = (process.env.SITE_URL || requestOrigin).replace(/\/$/, '');
  if (!apiKey || !secret) return redirect(response, siteUrl, 'error');

  const token = new URL(request.url, requestOrigin).searchParams.get('token');
  if (!token) return redirect(response, siteUrl, 'invalid');

  let parsed;
  try {
    parsed = JSON.parse(fromBase64Url(token));
  } catch {
    return redirect(response, siteUrl, 'invalid');
  }

  const email = String(parsed.email || '').trim().toLowerCase();
  const expires = Number(parsed.expires);
  const signature = String(parsed.signature || '');
  const unsigned = JSON.stringify({ email, expires });
  const expected = sign(unsigned, secret);

  if (!email || !Number.isFinite(expires) || expires < Date.now() || !safeEqual(signature, expected)) {
    return redirect(response, siteUrl, expires < Date.now() ? 'expired' : 'invalid');
  }

  const contactPath = `/contacts/${encodeURIComponent(email)}`;
  const existingResponse = await resend(contactPath, apiKey, 'GET');
  let shouldSendWelcome = false;
  let contactResponse;

  if (existingResponse.status === 404) {
    shouldSendWelcome = true;
    const createBody = { email, unsubscribed: false };
    if (process.env.RESEND_SEGMENT_ID) createBody.segments = [{ id: process.env.RESEND_SEGMENT_ID }];
    if (process.env.RESEND_TOPIC_ID) {
      createBody.topics = [{ id: process.env.RESEND_TOPIC_ID, subscription: 'opt_in' }];
    }
    contactResponse = await resend('/contacts', apiKey, 'POST', createBody);
    if (contactResponse.status === 409) {
      contactResponse = await resend(contactPath, apiKey, 'PATCH', { unsubscribed: false });
    }
  } else if (existingResponse.ok) {
    const existingContact = await existingResponse.json();
    shouldSendWelcome = existingContact.unsubscribed !== false;
    contactResponse = shouldSendWelcome
      ? await resend(contactPath, apiKey, 'PATCH', { unsubscribed: false })
      : existingResponse;
  } else {
    contactResponse = existingResponse;
  }

  if (!contactResponse.ok) {
    console.error('Resend contact update failed', contactResponse.status);
    return redirect(response, siteUrl, 'error');
  }

  const followups = [];
  if (process.env.RESEND_SEGMENT_ID) {
    followups.push(resend(`${contactPath}/segments/${process.env.RESEND_SEGMENT_ID}`, apiKey, 'POST'));
  }
  if (process.env.RESEND_TOPIC_ID) {
    followups.push(resend(`${contactPath}/topics`, apiKey, 'PATCH', {
      topics: [{ id: process.env.RESEND_TOPIC_ID, subscription: 'opt_in' }],
    }));
  }
  await Promise.allSettled(followups);

  if (shouldSendWelcome) {
    const sender = process.env.RESEND_FROM_EMAIL || '我在 <hello@wozai.space>';
    const welcome = buildWelcomeEmail(siteUrl);
    const welcomeResponse = await resend('/emails', apiKey, 'POST', {
      from: sender,
      to: [email],
      subject: '你已经在这里了｜Welcome to Wozai',
      text: welcome.text,
      html: welcome.html,
    });
    if (!welcomeResponse.ok) {
      console.error('Welcome email failed', welcomeResponse.status);
    }
  }

  return redirect(response, siteUrl, 'confirmed');
};
