const resultCard = document.querySelector('[data-result-card]');
const badge = document.querySelector('[data-result-badge]');
const title = document.querySelector('[data-result-title]');
const englishTitle = document.querySelector('[data-result-en]');
const lead = document.querySelector('[data-result-lead]');
const successContent = document.querySelector('[data-success-content]');
const recoveryContent = document.querySelector('[data-recovery-content]');
const action = document.querySelector('[data-result-action]');
const currentLanguage = document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';

const statesByLanguage = {
  zh: {
    expired: {
      badge: '确认链接已过期 · LINK EXPIRED',
      title: '这封确认信，\n已经错过了有效时间。',
      secondary: 'This confirmation link has expired.',
      lead: '为了保护你的邮箱，确认链接只在 24 小时内有效。重新订阅即可收到一封新的邮件。',
    },
    invalid: {
      badge: '无法确认 · INVALID LINK',
      title: '这个确认链接，\n似乎并不完整。',
      secondary: 'This confirmation link is not valid.',
      lead: '链接可能已经损坏或被截断。请回到订阅区重新填写邮箱。',
    },
    error: {
      badge: '暂时没有完成 · SOMETHING WENT WRONG',
      title: '确认时遇到了一点问题。',
      secondary: 'We could not confirm your subscription just yet.',
      lead: '你的操作没有丢失，但订阅暂时没有完成。请稍后重新尝试。',
    },
  },
  en: {
    expired: {
      badge: 'LINK EXPIRED',
      title: 'This confirmation link\nhas expired.',
      secondary: 'Please request a new confirmation email.',
      lead: 'To protect your email address, confirmation links are valid for only 24 hours. Subscribe again to receive a new one.',
    },
    invalid: {
      badge: 'INVALID LINK',
      title: 'This confirmation link\nseems incomplete.',
      secondary: 'We could not validate this link.',
      lead: 'The link may be damaged or truncated. Return to the subscription form and enter your email again.',
    },
    error: {
      badge: 'SOMETHING WENT WRONG',
      title: 'We could not confirm\nyour subscription just yet.',
      secondary: 'Please try again shortly.',
      lead: 'Your action was not lost, but the subscription is not complete. Please try again later.',
    },
  },
};

const status = new URLSearchParams(window.location.search).get('status');
const state = statesByLanguage[currentLanguage][status];

if (state) {
  resultCard?.classList.add('is-error');
  if (badge) badge.textContent = state.badge;
  if (title) title.innerHTML = state.title.replace('\n', '<br />');
  if (englishTitle) englishTitle.textContent = state.secondary;
  if (lead) lead.textContent = state.lead;
  if (successContent) successContent.hidden = true;
  if (recoveryContent) recoveryContent.hidden = false;
  if (action) {
    action.href = currentLanguage === 'zh' ? '/#join' : '/en#join';
    action.innerHTML = currentLanguage === 'zh'
      ? '重新订阅 · Try again <span aria-hidden="true">→</span>'
      : 'Try again <span aria-hidden="true">→</span>';
  }
  document.title = currentLanguage === 'zh'
    ? `${state.badge.split(' · ')[0]}｜我在`
    : `${state.badge} | Wozai`;
}
