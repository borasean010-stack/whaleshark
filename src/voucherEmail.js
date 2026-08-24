// 웹사이트 js/reservation.js와 같은 Google Apps Script 웹 앱을 그대로
// 씁니다 — 예약 확정 바우처 이메일 발송용. 실패해도 예약 자체를 막지
// 않도록 호출하는 쪽에서 await 없이(또는 try/catch로 감싸) 씁니다.
const VOUCHER_ENDPOINT = "https://script.google.com/macros/s/AKfycbwkaT0m8W5Q0HEAH6aNGZqibNgfXkJzUGzp28Txo2RyOPEenGtmujWaS2EEgJu7dhz3/exec";
const VOUCHER_SECRET = "lA6grkC0pujbOn5B5ooSip3z9N-Wvwre";

export async function sendVoucherEmail(reservation, lang = "en") {
  try {
    await fetch(VOUCHER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        secret: VOUCHER_SECRET,
        tourType: reservation.tourType,
        date: reservation.date,
        people: reservation.people,
        pickup: reservation.pickup,
        meetingTime: reservation.meetingTime,
        nationality: reservation.nationality,
        totalPrice: reservation.totalPrice,
        paymentStatus: reservation.paymentStatus,
        paymentMethod: reservation.paymentMethod,
        currency: reservation.currency,
        name: reservation.name,
        email: reservation.email,
        lang,
      }),
    });
  } catch (err) {
    console.error("Voucher email failed:", err);
  }
}
