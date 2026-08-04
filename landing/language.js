(function initWozaiLanguage(globalScope) {
  const STORAGE_KEY = 'wozai-language';
  const COOKIE_KEY = 'wozai_language';
  const SUPPORTED_LANGUAGES = new Set(['zh', 'en']);

  const normalizeLanguage = (value) => {
    const language = String(value || '').trim().toLowerCase();
    if (language.startsWith('zh')) return 'zh';
    if (language.startsWith('en')) return 'en';
    return null;
  };

  const resolveLanguage = ({ explicit, stored, browserLanguages = [] } = {}) => {
    const explicitLanguage = normalizeLanguage(explicit);
    if (explicitLanguage) return explicitLanguage;

    const storedLanguage = normalizeLanguage(stored);
    if (storedLanguage) return storedLanguage;

    for (const language of browserLanguages) {
      const matchedLanguage = normalizeLanguage(language);
      if (matchedLanguage) return matchedLanguage;
    }

    return 'en';
  };

  const localizedPath = (language, pathname) => {
    const withoutFileExtension = pathname.replace(/\/index\.html$/, '/').replace(/\.html$/, '');
    const normalizedPath = withoutFileExtension.length > 1
      ? withoutFileExtension.replace(/\/$/, '')
      : withoutFileExtension;

    if (language === 'en') {
      if (normalizedPath === '/') return '/en';
      if (normalizedPath === '/subscribed') return '/en/subscribed';
      return null;
    }

    if (normalizedPath === '/en') return '/';
    if (normalizedPath === '/en/subscribed') return '/subscribed';
    return null;
  };

  const api = { normalizeLanguage, resolveLanguage, localizedPath };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

  const windowObject = globalScope?.window;
  const documentObject = globalScope?.document;
  if (!windowObject || !documentObject) return;

  const readCookie = () => {
    const prefix = `${COOKIE_KEY}=`;
    const entry = documentObject.cookie.split('; ').find((item) => item.startsWith(prefix));
    if (!entry) return null;
    try {
      return decodeURIComponent(entry.slice(prefix.length));
    } catch {
      return null;
    }
  };

  const readStoredLanguage = () => {
    try {
      return windowObject.localStorage.getItem(STORAGE_KEY) || readCookie();
    } catch {
      return readCookie();
    }
  };

  const persistLanguage = (language) => {
    if (!SUPPORTED_LANGUAGES.has(language)) return;
    try {
      windowObject.localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Cookie persistence still covers browsers that block localStorage.
    }
    const secure = windowObject.location.protocol === 'https:' ? '; Secure' : '';
    documentObject.cookie = `${COOKIE_KEY}=${language}; Max-Age=31536000; Path=/; SameSite=Lax${secure}`;
  };

  const url = new URL(windowObject.location.href);
  const explicitLanguage = url.searchParams.get('lang');
  const language = resolveLanguage({
    explicit: explicitLanguage,
    stored: readStoredLanguage(),
    browserLanguages: windowObject.navigator.languages || [windowObject.navigator.language],
  });

  if (normalizeLanguage(explicitLanguage)) persistLanguage(language);
  documentObject.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  documentObject.documentElement.dataset.language = language;

  const targetPath = localizedPath(language, url.pathname);
  if (targetPath) {
    url.pathname = targetPath;
    url.searchParams.delete('lang');
    windowObject.location.replace(`${url.pathname}${url.search}${url.hash}`);
    return;
  }

  if (url.searchParams.has('lang')) {
    url.searchParams.delete('lang');
    windowObject.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }

  const bindLanguageSwitches = () => {
    documentObject.querySelectorAll('[data-language-switch]').forEach((link) => {
      link.addEventListener('click', () => {
        const nextLanguage = normalizeLanguage(link.dataset.languageSwitch);
        if (nextLanguage) persistLanguage(nextLanguage);
      });
    });
  };

  if (documentObject.readyState === 'loading') {
    documentObject.addEventListener('DOMContentLoaded', bindLanguageSwitches, { once: true });
  } else {
    bindLanguageSwitches();
  }

  windowObject.WozaiLanguage = { ...api, current: language, persistLanguage };
})(typeof globalThis === 'undefined' ? this : globalThis);
