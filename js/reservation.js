import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("reservation-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("form-status");

const MSG = {
  en: {
    fillFields: "Please fill in all required fields.",
    processing: "Processing Payment...",
    confirmDialog: "[Test Mode] The payment window has been triggered.\n\nClick 'OK' to simulate a successful payment and confirm your reservation in the database.",
    cancelled: "Payment cancelled.",
    approving: "Approving payment...",
    error: "An error occurred during reservation. Please try again later.",
    payNow: "Pay Now"
  },
  ko: {
    fillFields: "필수 항목을 모두 입력해주세요.",
    processing: "결제 처리 중...",
    confirmDialog: "[테스트 모드] 결제창이 호출되었습니다.\n\n'확인'을 누르시면 결제가 성공적으로 완료되었다고 가정하고 데이터베이스에 예약을 확정합니다.",
    cancelled: "결제가 취소되었습니다.",
    approving: "결제 승인 중...",
    error: "예약 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
    payNow: "결제하기"
  }
};

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const lang = localStorage.getItem('ws_lang') || 'en';
  const t = MSG[lang] || MSG.en;
  statusEl.textContent = "";
  statusEl.className = "form-status";

  const formData = new FormData(form);
  const tourType = formData.get("tourType").trim();
  const people = Number(formData.get("people"));
  const nationality = formData.get("nationality");
  const pricePerPerson = window.PRICES && window.PRICES[nationality] ? window.PRICES[nationality][tourType] : null;

  const reservation = {
    tourType,
    date: formData.get("date"),
    people,
    pickup: formData.get("pickup"),
    nationality,
    pricePerPerson,
    totalPrice: pricePerPerson ? pricePerPerson * people : null,
    currency: "PHP",
    name: formData.get("name").trim(),
    email: formData.get("email").trim(),
    status: "pending",
    createdAt: serverTimestamp()
  };

  if (!reservation.tourType || !reservation.date || !reservation.pickup || !reservation.nationality || !reservation.name || !reservation.email) {
    statusEl.textContent = t.fillFields;
    statusEl.classList.add("error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = t.processing;

  try {
    // 1. Simulate API call to create the checkout session
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 2. Mock payment confirmation modal
    const confirmPayment = confirm(t.confirmDialog);

    if (!confirmPayment) {
      statusEl.textContent = t.cancelled;
      statusEl.classList.add("error");
      return;
    }

    submitBtn.textContent = t.approving;
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Add payment info
    reservation.paymentStatus = 'paid';
    reservation.paymentMethod = 'PayMongo';

    // 4. Save to Firebase
    await addDoc(collection(db, "reservations"), reservation);

    // 5. Show the Confirm step, then redirect to the success page
    window.showConfirmStep && window.showConfirmStep();
    setTimeout(() => {
      form.reset();
      window.location.href = "success.html?nationality=" + encodeURIComponent(nationality);
    }, 1400);
  } catch (err) {
    console.error(err);
    statusEl.textContent = t.error;
    statusEl.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = t.payNow;
  }
});
