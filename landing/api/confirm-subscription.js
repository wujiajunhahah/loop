const { createHmac } = require('node:crypto');

const RESEND_API = 'https://api.resend.com';

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
  const response = await fetch(`${RESEND_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return response;
}

function redirect(response, siteUrl, state) {
  response.statusCode = 302;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Location', `${siteUrl}/?subscription=${state}#subscribe`);
  response.end();
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

    const createBody = { email, unsubscribed: false };
    if (process.env.RESEND_SEGMENT_ID) createBody.segments = [{ id: process.env.RESEND_SEGMENT_ID }];
    if (process.env.RESEND_TOPIC_ID) {
      createBody.topics = [{ id: process.env.RESEND_TOPIC_ID, subscription: 'opt_in' }];
    }

    let contactResponse = await resend('/contacts', apiKey, 'POST', createBody);
    if (contactResponse.status === 409) {
      contactResponse = await resend(`/contacts/${encodeURIComponent(email)}`, apiKey, 'PATCH', { unsubscribed: false });
    }

    if (!contactResponse.ok) {
      console.error('Resend contact update failed', contactResponse.status);
      return redirect(response, siteUrl, 'error');
    }

    const followups = [];
    if (process.env.RESEND_SEGMENT_ID) {
      followups.push(resend(`/contacts/${encodeURIComponent(email)}/segments/${process.env.RESEND_SEGMENT_ID}`, apiKey, 'POST'));
    }
    if (process.env.RESEND_TOPIC_ID) {
      followups.push(resend(`/contacts/${encodeURIComponent(email)}/topics`, apiKey, 'PATCH', {
        topics: [{ id: process.env.RESEND_TOPIC_ID, subscription: 'opt_in' }],
      }));
    }
    await Promise.allSettled(followups);

    return redirect(response, siteUrl, 'confirmed');
};
