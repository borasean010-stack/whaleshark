// 홈 화면 "투어 사진 및 영상 받기"의 PC용 인라인 달력.
// 모바일은 OS 기본 날짜 선택기가 더 쓰기 좋아 CSS에서 이 달력을 숨기고
// 기존 <input type="date">를 보여준다.
(function () {
  const root = document.getElementById('tour-calendar');
  if (!root) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // i18n.js가 html lang을 정한 뒤 실행되도록 defer 순서에 의존한다
  const lang = document.documentElement.lang || 'en';
  const locale = { ko: 'ko-KR', en: 'en-US', zh: 'zh-CN', ja: 'ja-JP' }[lang] || lang;

  const monthFmt = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' });
  const dowFmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });

  const PREV_LABEL = { ko: '이전 달', en: 'Previous month', zh: '上个月', ja: '前の月' }[lang] || 'Previous month';
  const NEXT_LABEL = { ko: '다음 달', en: 'Next month', zh: '下个月', ja: '次の月' }[lang] || 'Next month';

  let view = new Date(today.getFullYear(), today.getMonth(), 1);

  function ymd(d) {
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function weekdayNames() {
    // 2024-01-07은 일요일 — 로케일과 무관하게 일요일 시작으로 7칸을 만든다
    const base = new Date(2024, 0, 7);
    return Array.from({ length: 7 }, (_, i) =>
      dowFmt.format(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)));
  }

  function render() {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    const atCurrentMonth =
      view.getFullYear() === today.getFullYear() && view.getMonth() === today.getMonth();

    let html = '<div class="cal-head">' +
      `<button type="button" class="cal-nav" data-step="-1" aria-label="${PREV_LABEL}">‹</button>` +
      `<span class="cal-title">${monthFmt.format(first)}</span>` +
      `<button type="button" class="cal-nav" data-step="1" aria-label="${NEXT_LABEL}"` +
      (atCurrentMonth ? ' disabled' : '') + '>›</button>' +
      '</div><div class="cal-grid">';

    for (const n of weekdayNames()) html += `<span class="cal-dow">${n}</span>`;
    for (let i = 0; i < first.getDay(); i++) html += '<span></span>';

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const future = date > today;
      const isToday = date.getTime() === today.getTime();
      html += `<button type="button" class="cal-day${isToday ? ' is-today' : ''}"` +
        ` data-date="${ymd(date)}"${future ? ' disabled' : ''}>${d}</button>`;
    }

    root.innerHTML = html + '</div>';
  }

  root.addEventListener('click', (e) => {
    const nav = e.target.closest('.cal-nav');
    if (nav) {
      view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.step), 1);
      render();
      return;
    }
    const day = e.target.closest('.cal-day');
    if (day && !day.disabled) {
      const prefix = location.pathname.replace(/\/[^/]*$/, '/').match(/\/(en|zh|ja)\/$/) ? '../' : '';
      location.href = `${prefix}photos.html?date=${encodeURIComponent(day.dataset.date)}`;
    }
  });

  render();
})();
