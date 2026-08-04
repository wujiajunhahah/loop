const header = document.querySelector('[data-header]');
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('#mobile-nav');

const setHeaderState = () => {
  header?.classList.toggle('is-scrolled', window.scrollY > 12);
};

setHeaderState();
window.addEventListener('scroll', setHeaderState, { passive: true });

if (menuToggle && mobileNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    menuToggle.setAttribute('aria-label', isOpen ? '打开菜单' : '关闭菜单');
    mobileNav.hidden = isOpen;
  });

  mobileNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.setAttribute('aria-label', '打开菜单');
      mobileNav.hidden = true;
    });
  });
}

const revealItems = document.querySelectorAll('[data-reveal]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries, observer) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -5% 0px' },
  );
  revealItems.forEach((item) => revealObserver.observe(item));
}

const playDemo = document.querySelector('.play-demo');
const audioDemo = document.querySelector('.memory-audio');
let demoTimer;

playDemo?.addEventListener('click', () => {
  const playing = playDemo.getAttribute('aria-pressed') === 'true';
  window.clearTimeout(demoTimer);
  playDemo.setAttribute('aria-pressed', String(!playing));
  playDemo.setAttribute('aria-label', playing ? '播放页面演示' : '暂停页面演示');
  audioDemo?.classList.toggle('is-playing', !playing);

  if (!playing) {
    demoTimer = window.setTimeout(() => {
      playDemo.setAttribute('aria-pressed', 'false');
      playDemo.setAttribute('aria-label', '播放页面演示');
      audioDemo?.classList.remove('is-playing');
    }, 5200);
  }
});

const journeyData = {
  look: {
    overline: '我在，你看',
    title: '拾起一段真实的记忆',
    description: '每张票根、每个物件，背后都是一段本人确认的内容。先看静态故事，再由你决定要不要听见声音。',
    points: ['声音默认关闭', '每段内容都有来源', '随时结束，今天到这里'],
    visual: '<div class="gallery-wall"><span class="gallery-sticker gs-one">1998<br>车票</span><span class="gallery-sticker gs-two">桂花</span><span class="gallery-sticker gs-three">一段<br>原声</span></div>',
  },
  speak: {
    overline: '我在，你说',
    title: '让今天，遇见一段过去',
    description: '你可以放进今天的一张照片、一句话或一段声音。系统在授权记录中寻找关联。',
    points: ['关联清楚可见', '不使用聊天气泡制造在线错觉', '没有依据时保持沉默'],
    visual: '<div class="mode-visual echo-visual"><div class="echo-card"><small>今天 · 你留下的</small><p>第一次一个人出差，到了海边。</p></div><span class="echo-link">≈</span><div class="echo-card blue"><small>1998 · 本人原声</small><p>系统找到一段“相似的第一次”。</p></div></div>',
  },
  seek: {
    overline: '我在，你寻',
    title: '问答之间，找回记忆的轮廓',
    description: '从一张局部照片、一件物品或一句原话出发，慢慢探索一段珍贵经历。',
    points: ['答案只来自真实记录', '随时可以查看完整故事', '重要回忆永不褪色'],
    visual: '<div class="mode-visual seek-visual"><small>记忆线索 · 01</small><h4>为什么一张普通的公交票，<br>会被保存二十多年？</h4><div class="seek-choices"><span>问时间</span><span>问地点</span><span>直接看故事</span></div></div>',
  },
  do: {
    overline: '我在，你做',
    title: '把愿望，变成前进动力',
    description: '只有创作者明确留下的愿望，才会被整理成小行动，可选择也可以拒绝，愿望从来不是义务。',
    points: ['不做也完全可以', '默认不提醒、不打卡', '行动原动力属于你'],
    visual: '<div class="mode-visual do-visual"><small>一份本人留下的愿望</small><blockquote>“心里乱的时候，就出去走一小段。”</blockquote><div class="do-options"><span>走 5 分钟</span><span>出门溜达</span><span>以后再说</span><span>我不想做</span></div></div>',
  },
  live: {
    overline: '你在',
    title: '重新成为今天的主角',
    description: '你在看、说、寻找和行动中留下新记忆，会逐渐成为自己的生活记录。过去被收藏，而你继续创造新的今天。',
    points: ['新内容归接收者自己所有', '系统主动降低频率', '可独立导出回忆'],
    visual: '<div class="mode-visual live-visual"><span class="sun-disc"></span><div class="life-card"><small>今天 · 属于你的 Context</small><p>“带着回忆，大胆向前走吧。”</p></div></div>',
  },
};

const journey = document.querySelector('[data-journey]');
const panel = journey?.querySelector('.journey-panel');
const journeyVisual = journey?.querySelector('[data-journey-visual]');
const journeyOverline = journey?.querySelector('[data-journey-overline]');
const journeyTitle = journey?.querySelector('[data-journey-title]');
const journeyDescription = journey?.querySelector('[data-journey-description]');
const journeyPoints = journey?.querySelector('[data-journey-points]');

journey?.querySelectorAll('[data-step]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const step = tab.dataset.step;
    const data = journeyData[step];
    if (!data || tab.getAttribute('aria-selected') === 'true') return;

    journey.querySelectorAll('[data-step]').forEach((item) => {
      item.setAttribute('aria-selected', 'false');
      item.setAttribute('tabindex', '-1');
    });
    tab.setAttribute('aria-selected', 'true');
    tab.setAttribute('tabindex', '0');
    panel?.classList.add('is-changing');

    window.setTimeout(() => {
      if (journeyVisual) {
        journeyVisual.dataset.mode = step;
        journeyVisual.innerHTML = data.visual;
      }
      if (journeyOverline) journeyOverline.textContent = data.overline;
      if (journeyTitle) journeyTitle.textContent = data.title;
      if (journeyDescription) journeyDescription.textContent = data.description;
      if (journeyPoints) journeyPoints.innerHTML = data.points.map((point) => `<li>${point}</li>`).join('');
      panel?.classList.remove('is-changing');
    }, 180);
  });
});

journey?.querySelector('.journey-tabs')?.addEventListener('keydown', (event) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  const tabs = [...journey.querySelectorAll('[data-step]')];
  const currentIndex = tabs.indexOf(document.activeElement);
  if (currentIndex < 0) return;

  event.preventDefault();
  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  if (event.key === 'Home') nextIndex = 0;
  if (event.key === 'End') nextIndex = tabs.length - 1;
  tabs[nextIndex].focus();
  tabs[nextIndex].click();
});

const contactForm = document.querySelector('[data-contact-form]');

const setFormStatus = (statusNode, state, message) => {
  if (!statusNode) return;
  statusNode.dataset.state = state;
  statusNode.textContent = message;
};

const submitForm = async ({ form, endpoint, statusNode, loadingLabel }) => {
  if (!form.reportValidity()) return false;

  const button = form.querySelector('button[type="submit"]');
  const originalLabel = button?.innerHTML;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.consent = formData.get('consent') === 'on';

  if (button) {
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.textContent = loadingLabel;
  }
  setFormStatus(statusNode, 'pending', '正在安全提交，请稍候……');

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.ok) {
      throw new Error(result.message || '暂时没有提交成功，请稍后再试。');
    }

    form.reset();
    setFormStatus(statusNode, 'success', result.message);
    return true;
  } catch (error) {
    setFormStatus(statusNode, 'error', error.message || '暂时没有提交成功，请稍后再试。');
    return false;
  } finally {
    if (button) {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      button.innerHTML = originalLabel;
    }
  }
};

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitForm({
    form: contactForm,
    endpoint: '/api/contact',
    statusNode: contactForm.querySelector('[data-contact-status]'),
    loadingLabel: '正在提交…',
  });
});

const subscribeForm = document.querySelector('[data-subscribe-form]');

subscribeForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  submitForm({
    form: subscribeForm,
    endpoint: '/api/subscribe',
    statusNode: subscribeForm.querySelector('[data-subscribe-status]'),
    loadingLabel: '正在发送…',
  });
});

const subscriptionState = new URLSearchParams(window.location.search).get('subscription');
const subscriptionStatus = subscribeForm?.querySelector('[data-subscribe-status]');
if (subscriptionState === 'confirmed') {
  setFormStatus(subscriptionStatus, 'success', '订阅已经确认。谢谢你愿意保持一点联系。');
} else if (subscriptionState === 'expired') {
  setFormStatus(subscriptionStatus, 'error', '确认链接已经过期，请重新填写邮箱订阅。');
} else if (subscriptionState === 'invalid') {
  setFormStatus(subscriptionStatus, 'error', '这个确认链接无效，请重新填写邮箱订阅。');
} else if (subscriptionState === 'error') {
  setFormStatus(subscriptionStatus, 'error', '确认时遇到问题，请稍后重新订阅。');
}

document.querySelectorAll('[data-year]').forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});
