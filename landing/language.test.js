const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLanguage, resolveLanguage, localizedPath } = require('./language.js');

test('normalizes Chinese and English language tags', () => {
  assert.equal(normalizeLanguage('zh-CN'), 'zh');
  assert.equal(normalizeLanguage('zh-Hant-HK'), 'zh');
  assert.equal(normalizeLanguage('en-US'), 'en');
  assert.equal(normalizeLanguage('fr-FR'), null);
});

test('uses explicit and saved preferences before device languages', () => {
  assert.equal(resolveLanguage({ explicit: 'en', stored: 'zh', browserLanguages: ['zh-CN'] }), 'en');
  assert.equal(resolveLanguage({ stored: 'zh', browserLanguages: ['en-US'] }), 'zh');
});

test('uses the first supported device language and otherwise falls back to English', () => {
  assert.equal(resolveLanguage({ browserLanguages: ['fr-FR', 'zh-CN', 'en-US'] }), 'zh');
  assert.equal(resolveLanguage({ browserLanguages: ['de-DE', 'ja-JP'] }), 'en');
});

test('maps the home and subscription result pages without touching other paths', () => {
  assert.equal(localizedPath('en', '/'), '/en');
  assert.equal(localizedPath('en', '/subscribed.html'), '/en/subscribed');
  assert.equal(localizedPath('en', '/subscribed/'), '/en/subscribed');
  assert.equal(localizedPath('zh', '/en/'), '/');
  assert.equal(localizedPath('zh', '/en/subscribed'), '/subscribed');
  assert.equal(localizedPath('zh', '/en/subscribed/'), '/subscribed');
  assert.equal(localizedPath('en', '/assets/favicon-32.png'), null);
});
