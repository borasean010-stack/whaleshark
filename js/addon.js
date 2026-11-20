// 예약 페이지 "옵션 추가" — 고래상어 + 말룸파티 원데이.
// 패스트트랙(F)·VIP 패스트트랙(VF)에서만 보인다. VIP는 말룸파티 구간이 조인 진행.
// 가격 계산은 각 페이지의 updateSummary와 js/reservation.js가 window.wsAddonPP()를 더해서 한다.
(function () {
  const PRICE = 3600; // 1인 추가 금액 (PHP)
  const form = document.getElementById('reservation-form');
  const anchor = document.getElementById('price-preview');
  if (!form || !anchor) return;

  const L = (o) => Object.entries(o).map(([k, v]) => `data-${k}="${v.replace(/"/g, '&quot;')}"`).join(' ');
  const TXT = {
    head: { en: 'Add-on Option', ko: '옵션 추가', zh: '附加选项', ja: 'オプション追加', ru: 'Дополнительная опция' },
    title: { en: 'Whale Shark + Malumpati One-Day', ko: '고래상어 + 말룸파티 원데이', zh: '鲸鲨 + Malumpati 一日游', ja: 'ジンベエザメ + マルンパティ1日ツアー', ru: 'Китовые акулы + Малумпати за один день' },
    price: { en: '+3,600 PHP / person', ko: '1인 +3,600 PHP', zh: '每人 +3,600 PHP', ja: '1名 +3,600 PHP', ru: '+3 600 PHP / чел.' },
    desc: {
      en: 'Right after the whale shark tour, go straight to Malumpati Blue Lagoon & Secret Garden — air swing, air walk, kayak, diving, spider web and kawa spa, herbal chicken lunch with unlimited drinks. Transfers, boat & terminal fees and entrance included. Back to Boracay after the program.',
      ko: '고래상어 투어가 끝나면 바로 말룸파티 블루라군 · 시크릿가든으로 이동해요. 에어스윙, 에어워킹, 카약, 다이빙, 스파이더웹, 카와스파, 한방백숙 한상 + 술·음료 무제한. 차량·배값·터미널비·입장료 포함, 일정 후 보라카이 복귀.',
      zh: '鲸鲨行程结束后直接前往 Malumpati 蓝色泻湖与秘密花园：空中秋千、空中漫步、皮划艇、跳水、蜘蛛网、Kawa 温泉，药膳炖鸡午餐及饮品无限畅饮。含交通、船费、码头费及门票，行程结束后返回长滩岛。',
      ja: 'ジンベエザメツアーの後、そのままマルンパティのブルーラグーン＆シークレットガーデンへ。エアスイング、エアウォーク、カヤック、ダイビング、スパイダーウェブ、カワスパ、薬膳参鶏湯ランチ＋ドリンク飲み放題。送迎・船代・ターミナル費・入場料込み、終了後ボラカイへ戻ります。',
      ru: 'Сразу после тура с китовыми акулами — Голубая лагуна Малумпати и Secret Garden: тарзанка, воздушная тропа, каяк, прыжки в воду, паутина, кава-спа, обед из курицы с травами и безлимитные напитки. Трансфер, лодка, сборы терминала и вход включены. Возвращение на Боракай после программы.'
    },
    extra: {
      en: 'Paid on site: tubing 350 PHP (optional, 125 cm+), tip 100 PHP per person.',
      ko: '현지 별도: 튜빙 1인 350페소(선택, 키 125cm 이상), 매너팁 1인 100페소.',
      zh: '现场另付：漂流 350 PHP（自选，身高 125cm 以上），小费每人 100 PHP。',
      ja: '現地払い：チュービング 350ペソ（任意・身長125cm以上）、チップ 1名100ペソ。',
      ru: 'Оплачивается на месте: тюбинг 350 PHP (по желанию, рост от 125 см), чаевые 100 PHP с человека.'
    },
    vip: {
      en: 'VIP Fast Track: the Malumpati part is a joined (shared) group tour.',
      ko: 'VIP 패스트트랙: 말룸파티 일정은 조인(합류)으로 진행됩니다.',
      zh: 'VIP 快速通道：Malumpati 部分为拼团行程。',
      ja: 'VIPファストトラック：マルンパティ部分は混載（ジョイン）ツアーです。',
      ru: 'VIP Fast Track: часть в Малумпати проходит в сборной группе.'
    },
    sum: { en: 'Malumpati Add-on', ko: '말룸파티 옵션', zh: 'Malumpati 附加', ja: 'マルンパティ追加', ru: 'Малумпати (опция)' }
  };
  const lang = (document.documentElement.lang || 'en').slice(0, 2);
  const t = (k) => TXT[k][lang] || TXT[k].en;

  const box = document.createElement('div');
  box.className = 'form-group';
  box.id = 'addon-group';
  box.style.display = 'none';
  box.innerHTML = `
    <label ${L(TXT.head)}>${t('head')}</label>
    <div class="addon-photos" style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:10px;">
      ${[1, 2, 3, 4].map((n) => `<img src="/assets/malumpati/${n}.webp" alt="Malumpati" loading="lazy" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block;" onerror="this.remove()">`).join('')}
    </div>
    <label for="addonMalumpati" style="display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border:1.5px solid rgba(37,99,235,.25);border-radius:12px;background:rgba(37,99,235,.04);cursor:pointer;font-weight:400;text-transform:none;letter-spacing:0;">
      <input type="checkbox" id="addonMalumpati" name="addonMalumpati" value="1" style="width:20px;height:20px;margin-top:2px;flex:none;accent-color:#2563eb;">
      <span style="display:block;line-height:1.55;">
        <strong style="display:block;font-size:1rem;"><span ${L(TXT.title)}>${t('title')}</span> <span style="color:#2563eb;white-space:nowrap;" ${L(TXT.price)}>${t('price')}</span></strong>
        <span style="display:block;font-size:.86rem;opacity:.85;margin-top:4px;" ${L(TXT.desc)}>${t('desc')}</span>
        <span style="display:block;font-size:.8rem;opacity:.7;margin-top:6px;" ${L(TXT.extra)}>${t('extra')}</span>
        <span id="addon-vip-note" style="display:none;font-size:.84rem;font-weight:600;color:#b45309;margin-top:6px;" ${L(TXT.vip)}>${t('vip')}</span>
      </span>
    </label>`;
  anchor.insertAdjacentElement('afterend', box);
  const cb = box.querySelector('#addonMalumpati');
  const vipNote = box.querySelector('#addon-vip-note');

  // 사이드 요약에 옵션 줄
  let sumRow = null;
  const totalRow = document.querySelector('.summary-card .summary-row--total');
  if (totalRow) {
    sumRow = document.createElement('div');
    sumRow.className = 'summary-row';
    sumRow.style.display = 'none';
    sumRow.innerHTML = `<span ${L(TXT.sum)}>${t('sum')}</span><strong id="sum-addon">-</strong>`;
    totalRow.parentNode.insertBefore(sumRow, totalRow);
  }

  const tour = () => ((document.querySelector('input[name="tourType"]:checked') || {}).value || '').trim();
  const eligible = () => tour() === 'F' || tour() === 'VF';
  window.wsAddonPP = () => (eligible() && cb.checked ? PRICE : 0);
  window.wsAddonMalumpati = () => window.wsAddonPP() > 0;

  function refresh() {
    box.style.display = eligible() ? '' : 'none';
    vipNote.style.display = tour() === 'VF' ? 'block' : 'none';
    const people = Number((document.getElementById('people') || {}).value) || 0;
    if (sumRow) {
      sumRow.style.display = window.wsAddonPP() ? '' : 'none';
      sumRow.querySelector('#sum-addon').textContent = '+' + (PRICE * people).toLocaleString('en-US') + ' PHP';
    }
  }
  // 금액 다시 계산 — 페이지의 updateSummary는 인원 칸 change에 걸려 있다
  function recalc() {
    refresh();
    const p = document.getElementById('people');
    if (p) p.dispatchEvent(new Event('change', { bubbles: true }));
  }
  cb.addEventListener('change', recalc);
  document.querySelectorAll('input[name="tourType"]').forEach((r) => r.addEventListener('change', recalc));
  document.getElementById('people')?.addEventListener('input', refresh);
  // 결제 실패 후 되돌아오면 저장된 값이 복원된다 — 복원 뒤 한 번 더 맞춘다
  window.addEventListener('load', () => setTimeout(recalc, 0));
  recalc();
})();
