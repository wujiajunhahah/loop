const RESEND_API = 'https://api.resend.com';

function fromBase64Url(value) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
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

function redirect(siteUrl, state) {
  return Response.redirect(`${siteUrl}/?subscription=${state}#subscribe`, 302);
}

export default {
  async fetch(request) {
    const apiKey = process.env.RESEND_API_KEY;
    const secret = process.env.SUBSCRIBE_TOKEN_SECRET || apiKey;
    const siteUrl = (process.env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');
    if (!apiKey || !secret) return redirect(siteUrl, 'error');

    const token = new URL(request.url).searchParams.get('token');
    if (!token) return redirect(siteUrl, 'invalid');

    let parsed;
    try {
      parsed = JSON.parse(fromBase64Url(token));
    } catch {
      return redirect(siteUrl, 'invalid');
    }

    const email = String(parsed.email || '').trim().toLowerCase();
    const expires = Number(parsed.expires);
    const signature = String(parsed.signature || '');
    const unsigned = JSON.stringify({ email, expires });
    const expected = await sign(unsigned, secret);

    if (!email || !Number.isFinite(expires) || expires < Date.now() || !safeEqual(signature, expected)) {
      return redirect(siteUrl, expires < Date.now() ? 'expired' : 'invalid');
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
      return redirect(siteUrl, 'error');
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

    return redirect(siteUrl, 'confirmed');
  },
};
