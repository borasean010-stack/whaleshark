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
const allPayBtns = document.querySelectorAll('.pay-now-btn');
const statusEl = document.getElementById("form-status");

const referralCode = new URLSearchParams(window.location.search).get('ref') || '';

const VOUCHER_ENDPOINT = "https://script.google.com/macros/s/AKfycbzTPR3kwrarZUs7_H8Eta094STF_xmIN7BVyF-6JLhg7KMTQgG4DUbbRBwFVqxa3F0k/exec";
const VOUCHER_SECRET = "lA6grkC0pujbOn5B5ooSip3z9N-Wvwre";
const MAYA_PUBLIC_KEY = "pk-Mg5rAp2ihXYPPBDNXxrqhdGwTCGUV3hjEcOC3hNHRis";
const MAYA_CHECKOUT_URL = "https://pg.paymaya.com/checkout/v1/checkouts";

const MSG = {
  en: {
    fillFields: "Please fill in all required fields.",
    vfMin: "VIP Fast Track can be booked for 2 or more people.",
    mayaError: "Could not start Maya payment. Please try again."
  },
  ko: {
    fillFields: "필수 항목을 모두 입력해주세요.",
    vfMin: "VIP 패스트트랙은 2인 이상부터 예약 가능합니다.",
    mayaError: "Maya 결제를 시작하지 못했습니다. 다시 시도해주세요."
  },
  zh: {
    fillFields: "请填写所有必填项。",
    vfMin: "VIP快速通道需2人及以上方可预订。",
    mayaError: "无法启动Maya支付，请重试。"
  },
  ja: {
    fillFields: "必須項目をすべて入力してください。",
    vfMin: "VIPファストトラックは2名様からご予約いただけます。",
    mayaError: "Maya決済を開始できませんでした。再度お試しください。"
  },
  ru: {
    fillFields: "Пожалуйста, заполните все обязательные поля.",
    vfMin: "VIP Fast Track можно забронировать от 2 человек.",
    mayaError: "Не удалось начать оплату через Maya. Попробуйте ещё раз."
  }
};

// VIP 패스트트랙은 전용 차량·전담 촬영이라 1인 예약은 받지 않는다.
// 투어를 VIP로 고르면 인원 칸의 최소값을 2로 올리고, 1로 되어 있으면 2로 맞춘다.
const VF_MIN_PEOPLE = 2;
function syncVfMinPeople() {
  const peopleEl = document.getElementById("people");
  const checked = document.querySelector('input[name="tourType"]:checked') ||
    document.querySelector('[name="tourType"]');
  if (!peopleEl || !checked) return;
  const isVF = (checked.value || "").trim() === "VF";
  peopleEl.min = isVF ? VF_MIN_PEOPLE : 1;
  if (isVF && Number(peopleEl.value) < VF_MIN_PEOPLE) {
    peopleEl.value = VF_MIN_PEOPLE;
    peopleEl.dispatchEvent(new Event("input", { bubbles: true }));
    peopleEl.dispatchEvent(new Event("change", { bubbles: true }));
  }
}
document.querySelectorAll('[name="tourType"]').forEach(el => el.addEventListener("change", syncVfMinPeople));
document.getElementById("people")?.addEventListener("change", syncVfMinPeople);
syncVfMinPeople();
// ?tour=VF 로 들어오면 페이지 스크립트가 DOMContentLoaded에서 라디오를 고르므로 그 뒤에 한 번 더 맞춘다
document.addEventListener("DOMContentLoaded", syncVfMinPeople);

async function callVoucherEndpoint(payload) {
  const body = JSON.stringify({ secret: VOUCHER_SECRET, ...payload });
  const opts = { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body };
  const res = await fetch(VOUCHER_ENDPOINT, opts);
  const text = await res.text();
  if (text.trim().startsWith('<') && res.url && res.url !== VOUCHER_ENDPOINT) {
    const res2 = await fetch(res.url, opts);
    return res2.json();
  }
  return JSON.parse(text);
}

function getReservationData() {
  const lang = localStorage.getItem('ws_lang') || 'ko';
  const t = MSG[lang] || MSG.en;
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

  const valid = !!(reservation.tourType && reservation.date && reservation.pickup && reservation.nationality && reservation.name && reservation.email);
  return { reservation, lang, t, valid };
}

// 카드(Maya) 결제
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const { reservation, lang, t, valid } = getReservationData();
  statusEl.textContent = "";
  statusEl.className = "form-status";

  if (!valid) {
    statusEl.textContent = t.fillFields;
    statusEl.classList.add("error");
    return;
  }
  if (reservation.tourType === "VF" && reservation.people < VF_MIN_PEOPLE) {
    statusEl.textContent = t.vfMin;
    statusEl.classList.add("error");
    return;
  }

  // 예보 폼은 결제 버튼 클래스가 달라 allPayBtns에 잡히지 않는다. 누른 버튼을
  // 따로 잠가야 두 번 눌러 예약이 중복 생성되는 일을 막을 수 있다.
  const clickedBtn = e.submitter;
  allPayBtns.forEach(b => { b.disabled = true; });
  if (clickedBtn) {
    clickedBtn.disabled = true;
    clickedBtn.classList.add('loading');
  }

  try {
    reservation.paymentStatus = 'pending';
    reservation.paymentMethod = 'Maya';
    reservation.selectedPaymentMethod = 'card';
    const docRef = await addDoc(collection(db, "reservations"), reservation);

    if (reservation.referralCode) {
      try {
        const refSnap = await getDocs(query(collection(db, "referralCodes"), where("code", "==", reservation.referralCode)));
        if (!refSnap.empty) await updateDoc(refSnap.docs[0].ref, { usageCount: increment(1) });
      } catch (_) {}
    }

    const parts = reservation.name.trim().split(' ');
    const mayaRes = await fetch(MAYA_CHECKOUT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + btoa(MAYA_PUBLIC_KEY + ":")
      },
      body: JSON.stringify({
        totalAmount: { value: reservation.totalPrice, currency: "PHP" },
        buyer: {
          firstName: parts[0],
          lastName: parts.slice(1).join(' ') || '-',
          contact: { email: reservation.email, phone: reservation.emergencyContact || '' }
        },
        items: [{
          name: `${reservation.tourType} tour - ${reservation.date}`,
          quantity: 1,
          totalAmount: { value: reservation.totalPrice, currency: "PHP" }
        }],
        redirectUrl: {
          success: "https://boracaywhaleshark.com/success?maya=1",
          failure: "https://boracaywhaleshark.com/reservation?payment=failed",
          cancel:  "https://boracaywhaleshark.com/reservation?payment=cancelled"
        },
        requestReferenceNumber: docRef.id
      })
    });
    const maya = await mayaRes.json();
    if (!maya.checkoutId) throw new Error("Maya: " + (maya.message || JSON.stringify(maya)));

    try { await updateDoc(doc(db, "reservations", docRef.id), { checkoutId: maya.checkoutId }); } catch (_) {}

    localStorage.setItem('maya_pending', JSON.stringify({
      checkoutId: maya.checkoutId,
      reservationId: docRef.id,
      nationality: reservation.nationality,
      reservation: { ...reservation, createdAt: null }
    }));

    window.location.href = maya.redirectUrl;
  } catch (err) {
    console.error(err);
    statusEl.textContent = String(err.message || err || t.mayaError);
    statusEl.classList.add("error");
    allPayBtns.forEach(b => { b.disabled = false; });
    if (clickedBtn) {
      clickedBtn.disabled = false;
      clickedBtn.classList.remove('loading');
    }
  }
});
