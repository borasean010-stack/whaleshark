document.addEventListener('DOMContentLoaded', () => {
  const langSelect = document.getElementById('lang-select');
  if (!langSelect) return;

  const trigger = langSelect.querySelector('.lang-select-trigger');
  const menu = langSelect.querySelector('.lang-select-menu');
  const currentLabel = langSelect.querySelector('.lang-select-current');

  const STORAGE_KEY = 'ws_lang';
  const LANG_NAMES = { ko: '한국어', en: 'English', zh: '中文', ja: '日本語' };
  const LANG_PREFIX = { ko: '', en: '/en', zh: '/zh', ja: '/ja' };

  const path = window.location.pathname;
  let currentLang = 'ko';
  if (path.startsWith('/en/') || path === '/en') currentLang = 'en';
  else if (path.startsWith('/zh/') || path === '/zh') currentLang = 'zh';
  else if (path.startsWith('/ja/') || path === '/ja') currentLang = 'ja';

  currentLabel.textContent = LANG_NAMES[currentLang];

  // Highlight the active language and wire up navigation to each language's
  // equivalent URL for the current page.
  menu.querySelectorAll('a').forEach(a => {
    const lang = a.getAttribute('data-lang');
    if (lang === currentLang) a.classList.add('active');
    a.addEventListener('click', (e) => {
      e.preventDefault();
      menu.classList.remove('open');
      if (lang === currentLang) return;

      // reservation.html/success.html only understand ko/en, so zh/ja map to en.
      localStorage.setItem(STORAGE_KEY, lang === 'ko' ? 'ko' : 'en');

      let bare = path;
      if (currentLang !== 'ko') {
        bare = path.replace(new RegExp('^/' + currentLang + '/?'), '/');
      }
      const target = (lang === 'ko') ? bare : (LANG_PREFIX[lang] + bare);
      window.location.href = target + window.location.search;
    });
  });

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.toggle('open');
  });
  document.addEventListener('click', () => menu.classList.remove('open'));

  // The ko/en pages carry both languages as data-en/data-ko attributes and
  // swap between them here. zh/ja pages ship their translated text as the
  // actual static content, so no attribute lookup/swap runs for them.
  if (currentLang === 'ko' || currentLang === 'en') {
    const elements = document.querySelectorAll('[data-en][data-ko]');
    elements.forEach(el => {
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = el.getAttribute(`data-${currentLang}`);
      } else {
        el.innerHTML = el.getAttribute(`data-${currentLang}`);
      }
    });
    document.documentElement.lang = currentLang;
    document.body.classList.toggle('lang-ko', currentLang === 'ko');
  }
});
