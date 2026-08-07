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
    phone: formData.get("phone").trim(),
    email: formData.get("email").trim(),
    message: formData.get("message").trim(),
    status: "pending",
    createdAt: serverTimestamp()
  };

  if (!reservation.tourType || !reservation.date || !reservation.name || !reservation.phone) {
    statusEl.textContent = "필수 항목을 모두 입력해주세요.";
    statusEl.classList.add("error");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "신청 중...";

  try {
    await addDoc(collection(db, "reservations"), reservation);
    form.reset();
    statusEl.textContent = "예약 신청이 완료되었습니다. 담당자가 곧 연락드릴게요!";
    statusEl.classList.add("success");
  } catch (err) {
    console.error(err);
    statusEl.textContent = "예약 신청 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    statusEl.classList.add("error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "예약 신청하기";
  }
});
