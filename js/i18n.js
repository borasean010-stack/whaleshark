document.addEventListener('DOMContentLoaded', () => {
  const langToggleBtn = document.getElementById('lang-toggle');
  if (!langToggleBtn) return;

  const STORAGE_KEY = 'ws_lang';
  let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';

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

  // Apply the saved language immediately (persists across pages/reloads)
  applyTranslation(currentLang);

  // Toggle button event listener
  langToggleBtn.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'ko' : 'en';
    localStorage.setItem(STORAGE_KEY, currentLang);
    applyTranslation(currentLang);
  });
});
