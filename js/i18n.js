document.addEventListener('DOMContentLoaded', () => {
  const langToggleBtn = document.getElementById('lang-toggle');
  let currentLang = 'en'; // default language

  // Detect user's browser language
  const userLang = navigator.language || navigator.userLanguage;
  
  // If the user's language is Korean, show the translation button
  if (userLang.toLowerCase().includes('ko')) {
    langToggleBtn.style.display = 'inline-block';
  }

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

    // Update button text
    if (lang === 'ko') {
      langToggleBtn.innerHTML = '🇺🇸 View in English';
    } else {
      langToggleBtn.innerHTML = '🇰🇷 한국어로 보기';
    }
  };

  // Toggle button event listener
  langToggleBtn.addEventListener('click', () => {
    currentLang = currentLang === 'en' ? 'ko' : 'en';
    applyTranslation(currentLang);
  });
});
