import { db, auth } from "./firebase-config.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// reservation.html의 PRICES.PH와 반드시 같은 값으로 유지해야 합니다 — 두
// 파일이 공유 모듈을 쓰지 않아 수동 동기화가 필요합니다 (가격 변경 시 함께 수정).
const PRICES_PH = { VF: 5820, F: 3300, R: 2520, T: 1620 };
const TOUR_NAMES = { VF: "VIP 패스트트랙", F: "패스트트랙", R: "레귤러 고래상어투어", T: "고래상어 티켓만" };
const STATUS_LABEL = { confirmed: "예약확정" };

let currentUid = null;
let currentAgency = null;
let selectedTour = "R";

function fmtPeso(n) {
  return `₱${(Number(n) || 0).toLocaleString("en-US")}`;
}

function randomToken(prefix) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${raw}`;
}

const loginView = document.getElementById("login-view");
const portalView = document.getElementById("portal-view");

// ── TEMPORARY: 테스트용 자동 로그인 ──────────────────────────────
// 실제 파트너 계정 없이 로그인 화면 없이 바로 대시보드부터 테스트할 수
// 있도록, 로그인 폼을 건너뛰고 테스트 에이전시 계정으로 자동 로그인합니다.
// 실제 파트너에게 링크를 공유하기 전에 이 블록은 반드시 지워야 합니다.
const TEST_AUTO_LOGIN = { email: "test-agency@boracaywhaleshark.com", password: "TestAgency2026!" };

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    loginView.style.display = "none";
    portalView.style.display = "none";
    currentUid = null;
    try {
      await signInWithEmailAndPassword(auth, TEST_AUTO_LOGIN.email, TEST_AUTO_LOGIN.password);
    } catch (err) {
      console.error("Test auto-login failed:", err);
      loginView.style.display = "block";
    }
    return;
  }
  currentUid = user.uid;
  const snap = await getDoc(doc(db, "agencies", currentUid));
  if (!snap.exists()) {
    document.getElementById("login-message").innerHTML =
      `<p class="pt-msg error">이 계정은 에이전시로 등록되어 있지 않습니다.</p>`;
    await signOut(auth);
    return;
  }
  loginView.style.display = "none";
  portalView.style.display = "block";
  document.getElementById("agency-name-title").textContent = `${snap.data().name} 포털`;
  listenAgency();
  listenBookings();
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
    msgEl.innerHTML = `<p class="pt-msg error">로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.</p>`;
  }
});

document.getElementById("btn-signout").addEventListener("click", () => signOut(auth));

function listenAgency() {
  onSnapshot(doc(db, "agencies", currentUid), (snap) => {
    if (!snap.exists()) return;
    currentAgency = snap.data();
    document.getElementById("stat-balance").textContent = fmtPeso(currentAgency.depositBalance);
    updateEstimate();
  });
}

function updateEstimate() {
  const people = Number(document.getElementById("b-people").value) || 0;
  const total = (PRICES_PH[selectedTour] || 0) * people;
  document.getElementById("b-total").textContent = fmtPeso(total);
  return total;
}

document.getElementById("tour-pills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pt-pill");
  if (!btn) return;
  selectedTour = btn.dataset.tour;
  document.getElementById("b-tour").value = selectedTour;
  document.querySelectorAll("#tour-pills .pt-pill").forEach(p => p.classList.toggle("active", p === btn));
  updateEstimate();
});

document.getElementById("b-people").addEventListener("input", updateEstimate);

let bookingsCache = new Map();

function renderBookings() {
  const listEl = document.getElementById("booking-list");
  if (bookingsCache.size === 0) {
    listEl.innerHTML = `<p class="pt-empty">예약 내역이 없습니다.</p>`;
    return;
  }
  const rows = [...bookingsCache.entries()]
    .sort((a, b) => (a[1].date < b[1].date ? 1 : -1))
    .map(([id, b]) => {
      const badge = b.checkedIn
        ? `<span class="pt-badge pt-badge-used">체크인완료</span>`
        : `<span class="pt-badge pt-badge-issued">${STATUS_LABEL[b.status] || b.status}</span>`;
      return `
        <div class="pt-booking-row">
          <div>
            <div class="pt-booking-main">${b.date} · ${TOUR_NAMES[b.tourType] || b.tourType}</div>
            <div class="pt-booking-sub">${b.name} · ${b.people}명 · ${fmtPeso(b.totalPrice)}</div>
            ${badge}
          </div>
          <button class="pt-btn pt-btn-ghost" data-action="qr" data-id="${id}">QR 보기</button>
        </div>
      `;
    });
  listEl.innerHTML = rows.join("");
}

document.getElementById("booking-list").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-action='qr']");
  if (!btn) return;
  const b = bookingsCache.get(btn.dataset.id);
  if (b) openQrModal(b);
});

function openQrModal(booking) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="pt-modal-overlay" id="modal-overlay">
      <div class="pt-modal-box">
        <h3>QR 티켓 (${booking.date} · ${booking.people}명)</h3>
        <div class="pt-qr-frame"><canvas id="qr-canvas"></canvas></div>
        <button class="pt-btn pt-btn-secondary" id="btn-close">닫기</button>
      </div>
    </div>
  `;
  QRCode.toCanvas(document.getElementById("qr-canvas"), booking.qrToken, { width: 200 });
  document.getElementById("btn-close").addEventListener("click", () => { root.innerHTML = ""; });
  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") root.innerHTML = "";
  });
}

function listenBookings() {
  onSnapshot(
    query(collection(db, "reservations"), where("agencyId", "==", currentUid)),
    (snapshot) => {
      bookingsCache = new Map();
      snapshot.forEach(docSnap => bookingsCache.set(docSnap.id, docSnap.data()));
      renderBookings();
    }
  );
}

document.getElementById("booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById("booking-message");
  msgEl.innerHTML = "";

  const tourType = selectedTour;
  const date = document.getElementById("b-date").value;
  const people = Number(document.getElementById("b-people").value);
  const label = document.getElementById("b-label").value.trim();
  const totalPrice = updateEstimate();

  if (!date || !people || people < 1 || !label) {
    msgEl.innerHTML = `<p class="pt-msg error">모든 항목을 입력해주세요.</p>`;
    return;
  }
  if (!currentAgency || currentAgency.depositBalance < totalPrice) {
    msgEl.innerHTML = `<p class="pt-msg error">예치금 잔액이 부족합니다 (필요: ${fmtPeso(totalPrice)}).</p>`;
    return;
  }

  try {
    // 1단계: 예약 생성 — 이 시점의 잔액이 충분한지는 보안 규칙이 다시 검증합니다.
    const reservationRef = await addDoc(collection(db, "reservations"), {
      tourType,
      date,
      people,
      name: label,
      email: auth.currentUser.email,
      nationality: "PH",
      pricePerPerson: PRICES_PH[tourType],
      totalPrice,
      currency: "PHP",
      status: "confirmed",
      bookedBy: "agency",
      agencyId: currentUid,
      qrToken: randomToken("WHALE"),
      checkedIn: false,
      depositApplied: false,
      createdAt: serverTimestamp()
    });

    // 2단계: 잔액 차감 + depositApplied 확정을 하나의 트랜잭션으로.
    const agencyDocRef = doc(db, "agencies", currentUid);
    await runTransaction(db, async (tx) => {
      const agencySnap = await tx.get(agencyDocRef);
      const newBalance = agencySnap.data().depositBalance - totalPrice;
      tx.update(agencyDocRef, { depositBalance: newBalance, lastPurchaseRef: reservationRef.id });
      tx.update(reservationRef, { depositApplied: true });
    });
    await addDoc(collection(db, "agencyTransactions"), {
      agencyId: currentUid,
      type: "purchase",
      amount: -totalPrice,
      note: `${TOUR_NAMES[tourType]} ${date} ${people}명`,
      createdAt: serverTimestamp(),
      createdBy: currentUid
    });

    msgEl.innerHTML = `<p class="pt-msg success">예약이 확정되었습니다.</p>`;
    e.target.reset();
    document.getElementById("b-people").value = 1;
    updateEstimate();
  } catch (err) {
    console.error("Booking failed:", err);
    msgEl.innerHTML = `<p class="pt-msg error">예약에 실패했습니다. 잔액을 다시 확인해주세요.</p>`;
  }
});
