import { db, auth } from "./firebase-config.js";
import {
  collection,
  query,
  where,
  limit,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const TOUR_NAMES = { VF: "VIP 패스트트랙", F: "패스트트랙", R: "레귤러 고래상어투어", T: "고래상어 티켓만" };

const loginView = document.getElementById("login-view");
const checkScreen = document.getElementById("check-screen");
const titleEl = document.querySelector("#check-card h1");
const bodyEl = document.getElementById("check-body");

let scanner = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    loginView.style.display = "block";
    checkScreen.style.display = "none";
    if (scanner) { scanner.stop().catch(() => {}); scanner = null; }
    return;
  }
  loginView.style.display = "none";
  checkScreen.style.display = "flex";
  startScanner();
});

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const msgEl = document.getElementById("login-message");
  msgEl.innerHTML = "";
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    msgEl.innerHTML = `<p class="portal-message error">로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.</p>`;
  }
});

document.getElementById("btn-signout").addEventListener("click", () => signOut(auth));

function field(label, value) {
  return `<div class="check-field"><span class="check-label">${label}</span><span class="check-value">${value}</span></div>`;
}

function startScanner() {
  titleEl.textContent = "QR 스캔 대기 중";
  bodyEl.innerHTML = "";
  scanner = new Html5Qrcode("qr-reader");
  scanner
    .start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 240 },
      (decodedText) => {
        scanner.stop().then(() => { scanner = null; handleToken(decodedText); }).catch(() => {});
      },
      () => {}
    )
    .catch((err) => {
      bodyEl.innerHTML = `<p class="check-status-line error">카메라를 열 수 없습니다. 권한을 확인해주세요.</p>`;
      console.error("Camera start failed:", err);
    });
}

async function handleToken(token) {
  titleEl.textContent = "티켓 확인 중...";
  try {
    // bookedBy로 더 이상 거르지 않습니다 — 여행사(B2B) 예약과, 결제 완료된
    // "티켓만" 직접 예약(reservation.js가 발급) 모두 qrToken만 있으면 여기서
    // 조회됩니다. qrToken이 없는 일반 예약은 규칙상 애초에 조회되지 않습니다.
    const q = query(
      collection(db, "reservations"),
      where("qrToken", "==", token),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      renderNotFound();
      return;
    }
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    if (data.checkedIn) {
      renderAlreadyUsed(docSnap.id, data);
    } else {
      renderReady(docSnap.id, data);
    }
  } catch (err) {
    console.error("Check lookup failed:", err);
    bodyEl.innerHTML = `<p class="check-status-line error">조회 중 오류가 발생했습니다.</p>`;
    renderRescanButton();
  }
}

function renderNotFound() {
  titleEl.textContent = "티켓을 찾을 수 없습니다";
  bodyEl.innerHTML = `<p class="check-status-line error">유효하지 않은 QR입니다.</p>`;
  renderRescanButton();
}

function renderAlreadyUsed(id, data) {
  titleEl.textContent = "이미 체크인됨";
  const usedAt = data.checkedInAt && data.checkedInAt.toDate ? data.checkedInAt.toDate().toLocaleString("ko-KR") : "-";
  bodyEl.innerHTML = `
    <p class="check-status-line warn">이미 사용된 티켓입니다.</p>
    ${field("투어", TOUR_NAMES[data.tourType] || data.tourType)}
    ${field("투어일", data.date)}
    ${field("인원", data.people + "명")}
    ${field("그룹명", data.name)}
    ${field("체크인 시간", usedAt)}
  `;
  renderRescanButton();
}

function renderReady(id, data) {
  titleEl.textContent = "WHALE SHARK TICKET";
  bodyEl.innerHTML = `
    ${field("투어", TOUR_NAMES[data.tourType] || data.tourType)}
    ${field("투어일", data.date)}
    ${field("인원", data.people + "명")}
    ${field("그룹명", data.name)}
    <div class="check-actions">
      <button class="check-btn check-btn-ok" id="btn-ok">체크인 완료</button>
      <button class="check-btn check-btn-cancel" id="btn-rescan">다시 스캔</button>
    </div>
    <div id="action-message"></div>
  `;
  document.getElementById("btn-ok").addEventListener("click", async () => {
    document.querySelectorAll(".check-btn").forEach(b => b.disabled = true);
    try {
      await updateDoc(doc(db, "reservations", id), { checkedIn: true, checkedInAt: serverTimestamp() });
      titleEl.textContent = "체크인 완료";
      bodyEl.innerHTML = `<p class="check-status-line ok">OK — 입장 처리되었습니다.</p>${field("인원", data.people + "명")}`;
      renderRescanButton();
    } catch (err) {
      console.error("Check-in failed:", err);
      document.getElementById("action-message").innerHTML = `<p class="portal-message error">처리 중 오류가 발생했습니다.</p>`;
      document.querySelectorAll(".check-btn").forEach(b => b.disabled = false);
    }
  });
  document.getElementById("btn-rescan").addEventListener("click", startScanner);
}

function renderRescanButton() {
  bodyEl.innerHTML += `<div class="modal-close-row" style="margin-top:16px; justify-content:center;"><button class="btn btn-small" id="btn-rescan-only">다시 스캔</button></div>`;
  document.getElementById("btn-rescan-only").addEventListener("click", startScanner);
}
