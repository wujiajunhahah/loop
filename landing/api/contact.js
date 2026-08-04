const RESEND_API = 'https://api.resend.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = new Set([
  '想为重要的人留下内容',
  '家属 / 陪伴者',
  '医疗 / 社工专业者',
  '机构合作伙伴',
  '其他',
]);

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

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function resend(path, apiKey, body) {
  const response = await fetch(`${RESEND_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = new Error(`Resend request failed with ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return reply({ ok: false, message: 'Method not allowed' }, 405);
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return reply({ ok: false, message: '联系服务尚未配置，请直接邮件联系 hello@wozai.space。' }, 503);
    }

    let input;
    try {
      input = await request.json();
    } catch {
      return reply({ ok: false, message: '提交内容格式不正确。' }, 400);
    }

    // Honeypot: bots often fill fields hidden from real visitors.
    if (clean(input.website, 200)) {
      return reply({ ok: true, message: '谢谢，我们已经收到。' });
    }

    const name = clean(input.name, 80);
    const role = clean(input.role, 80);
    const email = clean(input.email, 254).toLowerCase();
    const message = clean(input.message, 3000);
    const consent = input.consent === true;

    if (!name || !ALLOWED_ROLES.has(role) || !EMAIL_PATTERN.test(email) || !consent) {
      return reply({ ok: false, message: '请检查称呼、身份、邮箱与授权选项。' }, 400);
    }

    const safeName = escapeHtml(name);
    const safeRole = escapeHtml(role);
    const safeEmail = escapeHtml(email);
    const safeMessage = escapeHtml(message || '暂未填写').replaceAll('\n', '<br />');
    const sender = process.env.RESEND_FROM_EMAIL || '我在 <hello@wozai.space>';
    const recipient = process.env.CONTACT_TO_EMAIL || 'hello@wozai.space';
    const safeSubjectName = name.replace(/[\r\n]+/g, ' ');

    const notification = resend('/emails', apiKey, {
      from: sender,
      to: [recipient],
      reply_to: email,
      subject: `我在共创申请｜${safeSubjectName}`,
      text: `怎么称呼：${name}\n身份：${role}\n邮箱：${email}\n\n想说的话：\n${message || '暂未填写'}\n\n已同意信息仅用于本次共创联系。`,
      html: `<h2>新的「我在」共创申请</h2><p><strong>怎么称呼：</strong>${safeName}</p><p><strong>身份：</strong>${safeRole}</p><p><strong>邮箱：</strong>${safeEmail}</p><p><strong>想说的话：</strong><br />${safeMessage}</p><hr /><p style="color:#66727a">申请者已同意以上信息仅用于本次共创联系，不用于广告推送。</p>`,
    });

    const acknowledgement = resend('/emails', apiKey, {
      from: sender,
      to: [email],
      reply_to: recipient,
      subject: '我们已经收到你的来信｜我在',
      text: `${name}，你好：\n\n谢谢你愿意从一小段话开始。我们已经收到你的共创来信，会认真读完，并通过这封邮件与你联系。\n\n这次提交不会让你自动订阅任何营销邮件。\n\n我在\nhttps://www.wozai.space/`,
      html: `<p>${safeName}，你好：</p><p>谢谢你愿意从一小段话开始。我们已经收到你的共创来信，会认真读完，并通过这封邮件与你联系。</p><p>这次提交不会让你自动订阅任何营销邮件。</p><p>我在<br /><a href="https://www.wozai.space/">www.wozai.space</a></p>`,
    });

    // Retain the address for one-to-one follow-up without opting it into Broadcasts.
    // If the address already exists (including as a subscriber), Resend returns a
    // conflict and the existing subscription preference remains untouched.
    const contactRecord = resend('/contacts', apiKey, {
      email,
      unsubscribed: true,
    });

    const [notificationResult] = await Promise.allSettled([notification, acknowledgement, contactRecord]);
    if (notificationResult.status === 'rejected') {
      console.error('Contact notification failed', notificationResult.reason?.status || 'unknown');
      return reply({ ok: false, message: '暂时没有提交成功，请稍后重试或邮件联系 hello@wozai.space。' }, 502);
    }

    return reply({ ok: true, message: '已经收到。确认邮件也正在飞往你的邮箱。' });
  },
};
