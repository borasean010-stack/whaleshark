// 웹사이트 js/agency-portal.js와 반드시 같은 값으로 유지해야 합니다 —
// 같은 백엔드(Firestore)에 같은 모양의 예약 문서를 쓰는 두 번째 클라이언트일
// 뿐이라, 가격표가 어긋나면 채널마다 금액이 달라지는 사고로 이어집니다.
export const PUBLISHED_PRICES = {
  VF: { PH: 5820, FOREIGN: 5820 },
  F: { PH: 3300, FOREIGN: 3600 },
  R: { PH: 2520, FOREIGN: 2820 },
  T: { PH: 1620, FOREIGN: 1920 },
};
export const BUNDLE_TICKET_PRICE = { PH: 1500, FOREIGN: 1800 };
export const ADDON_PRICE = { H: 1500, L: 500 };
// VIP는 국적 구분 없이 5,000 균일가, 티켓만(단독)은 published rate 그대로 —
// 2026-08-24 확정.
export const NET_PRICES = {
  VF: { PH: 5000, FOREIGN: 5000 },
  F: { PH: 3000, FOREIGN: 3150 },
  R: { PH: 2300, FOREIGN: 2600 },
  T: { PH: 1620, FOREIGN: 1920 },
};
// "단독 호핑투어(HG)"는 인당 단가가 아니라 그룹 인원 구간별 고정 총액.
export const GROUP_PRICES = { 10: 25000, 20: 30000, 30: 40000, 40: 45000 };

export const TOUR_NAMES = { VF: "VIP 패스트트랙", F: "패스트트랙", R: "레귤러 고래상어투어", T: "고래상어 티켓만", H: "호핑투어", L: "랜드투어", HG: "단독 호핑투어" };
export const TOUR_SHORT = { VF: "VIP FT", F: "FAST", R: "REGULAR", T: "TICKET", H: "HOPPING", L: "LAND", HG: "HOPPING(단독)" };
export const TOUR_TYPES = ["VF", "F", "R", "T"];
export const ADDON_LABEL = { H: "조인 호핑투어", HG: "단독 호핑투어", L: "랜드투어" };
export const ADDON_SHORT = { H: "조인호핑", L: "랜드" };
export const GROUP_SIZES = [10, 20, 30, 40];
export const NATIONALITIES = [
  { code: "PH", label: "현지인" },
  { code: "CN", label: "중국인" },
  { code: "KR", label: "한국인" },
  { code: "FOREIGN", label: "외국인" },
];
export const STATUS_LABEL = { confirmed: "CONFIRMED", pending: "PENDING" };

// 고객 유형은 4개로 보여주지만 가격은 PH/FOREIGN 두 단계뿐 — 중국인/한국인
// 전용 요금이 정해지면 이 매핑과 NET_PRICES를 함께 확장하면 됩니다.
export function priceTierFor(nationality) {
  return nationality === "PH" ? "PH" : "FOREIGN";
}

// 추가상품(호핑/랜드)이 하나라도 있는 상태로 "고래상어 티켓만"을 고르면
// 번들 할인가로, 그 외 투어는 정가 위에 추가상품 금액만 더해집니다.
export function pricePerPersonFor(tour, addons, nationality) {
  const tier = priceTierFor(nationality);
  const hasAddon = addons.size > 0;
  const base = (tour === "T" && hasAddon) ? BUNDLE_TICKET_PRICE[tier] : (NET_PRICES[tour]?.[tier] || 0);
  let addonSum = 0;
  addons.forEach((a) => { addonSum += ADDON_PRICE[a] || 0; });
  return base + addonSum;
}

export function bookingCode(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `BW-${String(hash % 100000).padStart(5, "0")}`;
}

export function fmtPeso(n) {
  return `₱${(Number(n) || 0).toLocaleString("en-US")}`;
}

export function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ko-KR");
}
