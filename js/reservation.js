import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  doc,
  query,
  where,
  getDocs,
  updateDoc,
  increment,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("reservation-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("form-status");

const referralCode = new URLSearchParams(window.location.search).get('ref') || '';

const VOUCHER_ENDPOINT = "https://script.google.com/macros/s/AKfycbzbTakld5b6sv21tq8pJytUyP-104cvirKudx_ZhX1n4LFEI-B7DPlUynaiyihxrAjH/exec";
const VOUCHER_SECRET = "lA6grkC0pujbOn5B5ooSip3z9N-Wvwre";

const MSG = {
  en: {
    fillFields: "Please fill in all required fields.",
    payNow: "Confirm Reservation",
    mayaRedirecting: "Redirecting to Maya payment...",
    mayaError: "Could not start Maya payment. Please try again."
  },
  ko: {
    fillFields: "필수 항목을 모두 입력해주세요.",
    payNow: "예약 확정하기",
    mayaRedirecting: "Maya 결제 페이지로 이동 중...",
    mayaError: "Maya 결제를 시작하지 못했습니다. 다시 시도해주세요."
  },
  zh: {
    fillFields: "请填写所有必填项。",
    payNow: "确认预约",
    mayaRedirecting: "正在跳转到Maya支付页面...",
    mayaError: "无法启动Maya支付，请重试。"
  },
  ja: {
    fillFields: "必須項目をすべて入力してください。",
    payNow: "予約を確定する",
    mayaRedirecting: "Maya決済ページに移動中...",
    mayaError: "Maya決済を開始できませんでした。再度お試しください。"
  }
};

async function callVoucherEndpoint(payload) {
  const body = JSON.stringify({ secret: VOUCHER_SECRET, ...payload });
  const opts = { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body };
  const res = await fetch(VOUCHER_ENDPOINT, opts);
  const text = await res.text();
  // Apps Script sometimes redirects POST→GET and returns HTML — retry POST to final URL
  if (text.trim().startsWith('<') && res.url && res.url !== VOUCHER_ENDPOINT) {
    const res2 = await fetch(res.url, opts);
    return res2.json();
  }
  return JSON.parse(text);
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lang = localStorage.getItem('ws_lang') || 'ko';
  const t = MSG[lang] || MSG.en;
  statusEl.textContent = "";
  statusEl.className = "form-status";

  const formData = new FormData(form);
  const tourType = formData.get("tourType").trim();
  const people = Number(formData.get("people"));
  const nationality = formData.get("nationality");
  const basePricePerPerson = window.PRICES && window.PRICES[nationality] ? window.PRICES[nationality][tourType] : null;
  const refCodeVal = (formData.get("referralCode") || "").trim() || referralCode;
  const discountPP = window.getDiscountPerPerson ? window.getDiscountPerPerson(refCodeVal, tourType) : 0;
  const pricePerPerson = basePricePerPerson ? basePricePerPerson - discountPP : null;
  const totalPrice = pricePerPerson ? pricePerPerson * people : null;

  const reservation = {
    tourType,
    date: formData.get("date"),
    people,
    pickup: formData.get("pickup"),
    resort: (formData.get("pickupResort") || "").trim(),
    meetingTime: (tourType === "R" || tourType === "F" || tourType === "VF") ? formData.get("meetingTime") : "",
    nationality,
    pricePerPerson,
    totalPrice,
    currency: "PHP",
    name: formData.get("name").trim(),
    email: formData.get("email").trim(),
    emergencyContact: (formData.get("emergencyContact") || "").trim(),
    referralCode: (formData.get("referralCode") || "").trim() || referralCode,
    status: "pending",
    createdAt: serverTimestamp()
  };

  if (!reservation.tourType || !reservation.date || !reservation.pickup || !reservation.nationality || !reservation.name || !reservation.email) {
    statusEl.textContent = t.fillFields;
    statusEl.classList.add("error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = t.mayaRedirecting;

  try {
    reservation.paymentStatus = 'pending';
    reservation.paymentMethod = 'Maya';
    const docRef = await addDoc(collection(db, "reservations"), reservation);

    if (reservation.referralCode) {
      try {
        const refSnap = await getDocs(query(collection(db, "referralCodes"), where("code", "==", reservation.referralCode)));
        if (!refSnap.empty) await updateDoc(refSnap.docs[0].ref, { usageCount: increment(1) });
      } catch (_) {}
    }

    const maya = await callVoucherEndpoint({
      action: "createMayaCheckout",
      amount: reservation.totalPrice,
      description: `${reservation.tourType} tour - ${reservation.date}`,
      name: reservation.name,
      email: reservation.email,
      phone: reservation.emergencyContact || '',
      reservationId: docRef.id
    });

    if (!maya.ok) throw new Error("Maya: " + (maya.error || "maya_checkout_failed"));

    await updateDoc(doc(db, "reservations", docRef.id), { checkoutId: maya.checkoutId });

    localStorage.setItem('maya_pending', JSON.stringify({
      checkoutId: maya.checkoutId,
      reservationId: docRef.id,
      nationality,
      reservation: { ...reservation, createdAt: null }
    }));

    window.location.href = maya.redirectUrl;
  } catch (err) {
    console.error(err);
    statusEl.textContent = err.message || t.mayaError;
    statusEl.classList.add("error");
    submitBtn.disabled = false;
    submitBtn.textContent = t.payNow;
  }
});
