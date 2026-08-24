// 웹사이트 js/agency-portal.js의 randomToken()과 같은 패턴 — QR에 담을
// 예측 불가능한 티켓 토큰을 만듭니다.
export function randomToken(prefix) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${raw}`;
}
