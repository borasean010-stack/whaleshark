document.addEventListener('DOMContentLoaded', () => {
  const langToggleBtn = document.getElementById('lang-toggle');
  if (!langToggleBtn) return;

  const STORAGE_KEY = 'ws_lang';
  const onEnPath = window.location.pathname.startsWith('/en/') || window.location.pathname === '/en';

  // The URL itself is the source of truth for these pages (root = ko, /en/ = en).
  // A saved preference only matters for the pages that don't have a language-specific
  // URL (reservation.html/success.html), so we still keep it updated on toggle.
  let currentLang = onEnPath ? 'en' : 'ko';

  // Elements that have dual languages
  const elements = document.querySelectorAll('[data-en][data-ko]');

  // Function to apply translation
  const applyTranslation = (lang) => {
    elements.forEach(el => {
      // Check if it's an input/textarea placeholder or innerHTML
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = el.getAttribute(`data-${lang}`);
      } else {
        el.innerHTML = el.getAttribute(`data-${lang}`);
      }
    });

    document.documentElement.lang = lang;
    document.body.classList.toggle('lang-ko', lang === 'ko');

    // Update button text
    if (lang === 'ko') {
      langToggleBtn.innerHTML = '🇺🇸 View in English';
    } else {
      langToggleBtn.innerHTML = '🇰🇷 한국어로 보기';
    }
  };

  // Render this page's own language (matches its URL/meta) immediately
  applyTranslation(currentLang);

  // Toggle button navigates to the language-specific URL instead of swapping in place,
  // so Google always sees one language per URL.
  langToggleBtn.addEventListener('click', () => {
    const newLang = onEnPath ? 'ko' : 'en';
    localStorage.setItem(STORAGE_KEY, newLang);
    const path = window.location.pathname;
    const target = onEnPath ? path.replace(/^\/en\/?/, '/') : '/en' + path;
    window.location.href = target + window.location.search;
  });
});
