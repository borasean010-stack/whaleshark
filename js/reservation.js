import { db } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("reservation-form");
const submitBtn = document.getElementById("submit-btn");
const statusEl = document.getElementById("form-status");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl.textContent = "";
  statusEl.className = "form-status";

  const formData = new FormData(form);
  const reservation = {
    tourType: formData.get("tourType").trim(),
    date: formData.get("date"),
    people: Number(formData.get("people")),
    name: formData.get("name").trim(),
    email: formData.get("email").trim(),
    status: "pending",
    createdAt: serverTimestamp()
  };

  if (!reservation.tourType || !reservation.date || !reservation.name || !reservation.email) {
    statusEl.textContent = "필수 항목을 모두 입력해주세요.";
    statusEl.classList.add("error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "PayMongo 연결 중...";

  try {
    // 1. Simulate API call to create PayMongo checkout session
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // 2. Mock payment confirmation modal
    const confirmPayment = confirm("[테스트 모드] PayMongo 결제창이 호출되었습니다.\\n\\n'확인'을 누르시면 결제가 성공적으로 완료되었다고 가정하고 데이터베이스에 예약을 확정합니다.");
    
    if (!confirmPayment) {
      statusEl.textContent = "결제가 취소되었습니다.";
      statusEl.classList.add("error");
      return;
    }

    submitBtn.textContent = "결제 승인 중...";
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 3. Add payment info
    reservation.paymentStatus = 'paid';
    reservation.paymentMethod = 'PayMongo';

    // 4. Save to Firebase (Temporarily bypassed for UI testing due to dummy config)
    // await addDoc(collection(db, "reservations"), reservation);
    console.log("Mock reservation saved:", reservation);
    form.reset();
    
    // 5. Redirect to success page
    window.location.href = "success.html";
  } catch (err) {
    console.error(err);
    statusEl.textContent = "예약 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    statusEl.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "결제하기 (PayMongo)";
  }
});
