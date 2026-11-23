// 제휴 리조트 랜딩(habagat·azalea·feliz·sample) — 투어 종류를 골라 예약폼으로 넘긴다.
// 외국인·필리핀인 인원은 예약폼에서 따로 받는다(한 예약에 섞을 수 있음).
// 가격은 reservation.html의 PRICES와 같아야 한다. 펠리즈는 data-discount로 10% 할인.
(function () {
  const me = document.currentScript;
  const FORM = me.dataset.form;                       // 예: 'habagat-form'
  const RATE = Number(me.dataset.discount || 0);      // 예: 0.10
  const PRICES = {
    PH:      { VF: 5820, F: 3300, R: 2520, T: 1620 },
    FOREIGN: { VF: 5820, F: 3600, R: 2820, T: 1920 }
  };
  const TOURS = {
    VF: {
      name: 'VIP Fast Track', h1: 'VIP Fast Track', tag: 'Private vehicle · Photographer',
      inc: ['Entrance, viewing and environmental fees', 'Private vehicle pickup from your resort',
        'Life vest, fins and snorkel mask', 'Luggage storage and drinking water',
        'Professional underwater photographer', 'Fast Track &mdash; minimal waiting time'],
      info: [['Meeting point', 'Your resort lobby (private pickup)'], ['Pickup time', '07:00 / 08:00 / 09:00 / 10:00 AM'],
        ['Duration', 'About 5&ndash;6 hours<small>*May vary with sea and weather conditions</small>'], ['Group size', 'Minimum 2 guests']]
    },
    F: {
      name: 'Fast Track', h1: 'Fast Track', tag: 'Most popular · All-inclusive',
      inc: ['Entrance, viewing and environmental fees', 'Round-trip land transfer', 'Life vest and fins',
        'Luggage storage and drinking water', 'Underwater photos and video', 'Fast Track &mdash; minimal waiting time'],
      info: [['Meeting point', 'Jollibee Main Road, Boracay'], ['Meeting time', '07:30 AM'],
        ['Duration', 'About 5&ndash;6 hours<small>*May vary with sea and weather conditions</small>']]
    },
    R: {
      name: 'Regular Tour', h1: 'Regular Tour', tag: 'The essentials',
      inc: ['Entrance, viewing and environmental fees', 'Round-trip shared vehicle', 'Local guide',
        'Life vest and fins'],
      info: [['Meeting point', 'Jollibee Main Road, Boracay'], ['Meeting time', '07:30 AM'],
        ['Not included', 'Underwater photos, Fast Track entry']]
    }
  };
  const COMMON = [['Payment', 'Online (Card &middot; GCash &middot; Maya &middot; QR Ph)'],
    ['Confirmation', 'E-voucher emailed right after payment']];
  const ORDER = ['VF', 'F', 'R'];

  const h1em = document.querySelector('.masthead h1 em');
  const priceBlock = document.querySelector('.price-block');
  const incList = document.querySelector('.inc-list');
  const infoList = document.querySelector('.info-list');
  const cta = document.querySelector('.cta-btn');
  if (!priceBlock || !cta) return;

  const css = document.createElement('style');
  css.textContent = `
    .pl-pick { padding: 26px 0 0; }
    .pl-tours { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; margin-bottom: 6px; }
    @media (max-width: 480px) { .pl-tours { grid-template-columns: 1fr; } .pl-tour { display: grid; grid-template-columns: 1fr auto; align-items: center; column-gap: 10px; } .pl-tour em { grid-row: 1 / span 2; grid-column: 2; margin-top: 0; text-align: right; } }
    .pl-tour { text-align: left; padding: 12px; border: 1.5px solid #e5e7eb; border-radius: 12px; background: #fff; cursor: pointer; font: inherit; color: #111; }
    .pl-tour b { display: block; font-size: .92rem; }
    .pl-tour { position: relative; }
    .pl-tour .pl-best { display: inline-block; margin: 0; position: absolute; top: -9px; right: 10px; background: #f59e0b; color: #fff; font-size: .62rem; font-weight: 800; letter-spacing: .8px; padding: 3px 8px; border-radius: 99px; box-shadow: 0 2px 6px rgba(245,158,11,.35); }
    .pl-tour span { display: block; font-size: .72rem; color: #999; margin-top: 2px; }
    .pl-tour em { display: block; font-style: normal; font-weight: 800; font-size: .9rem; margin-top: 6px; color: var(--pl-accent); }
    .pl-tour em small { display: block; font-weight: 600; font-size: .7rem; color: #999; }
    .price-block .ph { margin-top: 6px; font-size: .86rem; color: #666; font-weight: 600; }
    .pl-tour.on { border-color: var(--pl-accent); box-shadow: 0 0 0 1px var(--pl-accent) inset; background: color-mix(in srgb, var(--pl-accent) 6%, #fff); }
    .pl-label { font-size: .7rem; font-weight: 700; color: #bbb; text-transform: uppercase; letter-spacing: 1.2px; margin: 0 0 10px; }
    .price-block .num s { font-size: 1.2rem; font-weight: 700; color: #bbb; margin-right: 10px; letter-spacing: 0; }`;
  document.head.appendChild(css);
  const accent = getComputedStyle(priceBlock.querySelector('.num') || priceBlock).color;
  document.documentElement.style.setProperty('--pl-accent', accent);

  const fmt = (n) => n.toLocaleString('en-US');
  const sale = (base) => (RATE ? Math.round(base * (1 - RATE)) : base);

  const pick = document.createElement('div');
  pick.className = 'pl-pick';
  pick.innerHTML = `
    <p class="pl-label">Choose your tour</p>
    <div class="pl-tours">${ORDER.map((k) => `<button type="button" class="pl-tour" data-tour="${k}">${k === 'F' ? '<span class="pl-best">BEST</span>' : ''}<b>${TOURS[k].name}</b><span>${TOURS[k].tag}</span><em></em></button>`).join('')}</div>`;
  priceBlock.parentNode.insertBefore(pick, priceBlock);

  const q = new URLSearchParams(location.search);
  let tour = ORDER.includes((q.get('tour') || '').toUpperCase()) ? q.get('tour').toUpperCase() : 'F';
  const ph = document.createElement('div');
  ph.className = 'ph';
  priceBlock.querySelector('.num').insertAdjacentElement('afterend', ph);

  function render() {
    const t = TOURS[tour];
    const base = PRICES.FOREIGN[tour];
    const basePH = PRICES.PH[tour];
    if (h1em) h1em.textContent = t.h1;
    pick.querySelectorAll('.pl-tour').forEach((b) => {
      const k = b.dataset.tour;
      b.classList.toggle('on', k === tour);
      b.querySelector('em').innerHTML = '₱' + fmt(sale(PRICES.FOREIGN[k])) +
        (PRICES.PH[k] !== PRICES.FOREIGN[k] ? `<small>Filipino ₱${fmt(sale(PRICES.PH[k]))}</small>` : '');
    });
    priceBlock.querySelector('.num').innerHTML = (RATE ? `<s>&#8369;${fmt(base)}</s>` : '') + `<sup>&#8369;</sup>${fmt(sale(base))}<sub>/ person</sub>`;
    ph.innerHTML = basePH !== base ? `Filipino guests: &#8369;${fmt(sale(basePH))} / person &middot; mixed groups welcome` : 'Same price for all guests';
    if (incList) incList.innerHTML = t.inc.map((s) => `<li><span class="dot"></span>${s}</li>`).join('');
    if (infoList) infoList.innerHTML = [...t.info, ...COMMON].map(([k, v]) => `<div class="info-row"><span class="k">${k}</span><span class="v">${v}</span></div>`).join('');
    cta.href = `${FORM}?tour=${tour}`;
  }
  pick.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !b.dataset.tour) return;
    tour = b.dataset.tour;
    render();
  });
  render();
})();
