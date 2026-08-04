const resultCard = document.querySelector('[data-result-card]');
const badge = document.querySelector('[data-result-badge]');
const title = document.querySelector('[data-result-title]');
const englishTitle = document.querySelector('[data-result-en]');
const lead = document.querySelector('[data-result-lead]');
const successContent = document.querySelector('[data-success-content]');
const recoveryContent = document.querySelector('[data-recovery-content]');
const action = document.querySelector('[data-result-action]');

const states = {
  expired: {
    badge: '确认链接已过期 · LINK EXPIRED',
    title: '这封确认信，\n已经错过了有效时间。',
    english: 'This confirmation link has expired.',
    lead: '为了保护你的邮箱，确认链接只在 24 小时内有效。重新订阅即可收到一封新的邮件。',
  },
  invalid: {
    badge: '无法确认 · INVALID LINK',
    title: '这个确认链接，\n似乎并不完整。',
    english: 'This confirmation link is not valid.',
    lead: '链接可能已经损坏或被截断。请回到订阅区重新填写邮箱。',
  },
  error: {
    badge: '暂时没有完成 · SOMETHING WENT WRONG',
    title: '确认时遇到了一点问题。',
    english: 'We could not confirm your subscription just yet.',
    lead: '你的操作没有丢失，但订阅暂时没有完成。请稍后重新尝试。',
  },
};

const status = new URLSearchParams(window.location.search).get('status');
const state = states[status];

if (state) {
  resultCard?.classList.add('is-error');
  if (badge) badge.textContent = state.badge;
  if (title) title.innerHTML = state.title.replace('\n', '<br />');
  if (englishTitle) englishTitle.textContent = state.english;
  if (lead) lead.textContent = state.lead;
  if (successContent) successContent.hidden = true;
  if (recoveryContent) recoveryContent.hidden = false;
  if (action) {
    action.href = '/#join';
    action.innerHTML = '重新订阅 · Try again <span aria-hidden="true">→</span>';
  }
  document.title = `${state.badge.split(' · ')[0]}｜我在`;
}

