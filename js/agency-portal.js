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

// B2B 파트너 가격은 손님용 published/selling rate(reservation.html의
// PRICES)가 아니라 별도의 net rate(도매가)입니다 — 2026-08-24 전달받은 값:
//   Regular: 현지인 2,300 / 외국인 2,600
//   Fast Track: 현지인 3,000 / 외국인 3,150
// 호핑투어/랜드투어는 "티켓 + 추가상품" 번들입니다 — 이 두 상품을 사면 티켓
// 가격 자체가 할인돼서 현지인 1,500 / 외국인 1,800으로 내려가고, 거기에
// 추가상품 금액(호핑 1,500 / 랜드 500, 국적 구분 없음)이 더해집니다.
// 그래서 최종 금액은:
//   호핑투어 = 할인티켓(1,500/1,800) + 호핑 추가금(1,500) = 3,000 / 3,300
//   랜드투어 = 할인티켓(1,500/1,800) + 랜드 추가금(500)   = 2,000 / 2,300
// VIP 패스트트랙과 (번들이 아닌) 고래상어 티켓만 단독 판매는 아직 net
// rate를 안 주셔서 임시로 published rate(reservation.html과 동일)를 그대로
// 쓰고 있습니다 — 확정되면 꼭 알려주세요.
const BUNDLE_TICKET_PRICE = { PH: 1500, FOREIGN: 1800 };
const ADDON_PRICE = { H: 1500, L: 500 };
const NET_PRICES = {
  VF: { PH: 5820, FOREIGN: 5820 }, // TODO: 확정 net rate 필요 (임시로 published rate)
  F: { PH: 3000, FOREIGN: 3150 },
  R: { PH: 2300, FOREIGN: 2600 },
  T: { PH: 1620, FOREIGN: 1920 }, // TODO: 확정 net rate 필요 (임시로 published rate, 번들 아닐 때)
  H: { PH: BUNDLE_TICKET_PRICE.PH + ADDON_PRICE.H, FOREIGN: BUNDLE_TICKET_PRICE.FOREIGN + ADDON_PRICE.H },
  L: { PH: BUNDLE_TICKET_PRICE.PH + ADDON_PRICE.L, FOREIGN: BUNDLE_TICKET_PRICE.FOREIGN + ADDON_PRICE.L },
};
const TOUR_NAMES = { VF: "VIP 패스트트랙", F: "패스트트랙", R: "레귤러 고래상어투어", T: "고래상어 티켓만", H: "호핑투어", L: "랜드투어" };
const TOUR_SHORT = { VF: "VIP FT", F: "FAST", R: "REGULAR", T: "TICKET", H: "HOPPING", L: "LAND" };
const STATUS_LABEL = { confirmed: "CONFIRMED", pending: "PENDING" };

let currentUid = null;
let currentAgency = null;
let selectedTour = "R";
let selectedNationality = "PH";
let selectedPay = "deposit";
let reservationsCache = new Map();
let txCache = new Map();

function fmtPeso(n) {
  return `₱${(Number(n) || 0).toLocaleString("en-US")}`;
}

function randomToken(prefix) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const raw = btoa(String.fromCharCode(...bytes)).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return `${prefix}-${raw}`;
}

// 진짜 순번 카운터(Firestore 트랜잭션/추가 규칙)를 새로 두지 않고, 문서 ID
// 자체에서 5자리 표시용 코드를 뽑아냅니다 — 화면에 보여주는 참고번호일 뿐,
// 회계상 연속 번호가 필요하면 나중에 별도 카운터로 바꿔야 합니다.
function bookingCode(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return `BW-${String(hash % 100000).padStart(5, "0")}`;
}

function fmtDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("ko-KR");
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
  portalView.style.display = "flex";
  const name = snap.data().name;
  document.getElementById("agency-name-title").textContent = name;
  document.getElementById("greeting-name").textContent = name;
  listenAgency();
  listenReservations();
  listenTransactions();
  listenDepositRequests();
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

// ── Sidebar nav ──────────────────────────────────────────────────
document.getElementById("pt-nav").addEventListener("click", (e) => {
  const btn = e.target.closest(".pt-nav-item");
  if (!btn) return;
  switchView(btn.dataset.view);
});
document.getElementById("btn-goto-reservation").addEventListener("click", () => switchView("reservation"));
document.getElementById("btn-goto-deposit").addEventListener("click", () => switchView("deposit"));

function switchView(view) {
  document.querySelectorAll(".pt-nav-item").forEach(el => el.classList.toggle("active", el.dataset.view === view));
  document.querySelectorAll(".pt-view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
}

// ── Balance ──────────────────────────────────────────────────────
function listenAgency() {
  onSnapshot(doc(db, "agencies", currentUid), (snap) => {
    if (!snap.exists()) return;
    currentAgency = snap.data();
    const balanceText = fmtPeso(currentAgency.depositBalance);
    document.getElementById("stat-balance").textContent = balanceText;
    document.getElementById("stat-balance-2").textContent = balanceText;
    updateEstimate();
  });
}

// ── New reservation form ────────────────────────────────────────
function updateEstimate() {
  const people = Number(document.getElementById("b-people").value) || 0;
  const total = (NET_PRICES[selectedTour]?.[selectedNationality] || 0) * people;
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

document.getElementById("nationality-pills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pt-pill");
  if (!btn) return;
  selectedNationality = btn.dataset.nationality;
  document.getElementById("b-nationality").value = selectedNationality;
  document.querySelectorAll("#nationality-pills .pt-pill").forEach(p => p.classList.toggle("active", p === btn));
  updateEstimate();
});

document.getElementById("pay-pills").addEventListener("click", (e) => {
  const btn = e.target.closest(".pt-pill");
  if (!btn) return;
  selectedPay = btn.dataset.pay;
  document.getElementById("b-pay").value = selectedPay;
  document.querySelectorAll("#pay-pills .pt-pill").forEach(p => p.classList.toggle("active", p === btn));
});

document.getElementById("b-people").addEventListener("input", updateEstimate);

document.getElementById("booking-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById("booking-message");
  msgEl.innerHTML = "";

  const tourType = selectedTour;
  const paymentMethod = selectedPay;
  const date = document.getElementById("b-date").value;
  const people = Number(document.getElementById("b-people").value);
  // 그룹명을 직접 입력받지 않고, 에이전시명 + 날짜로 자동으로 채웁니다
  // (개별 고객 정보 없이 "이 에이전시가 이 날짜에 몇 명" 만 있으면 충분).
  const label = `${currentAgency?.name || "Agency"} ${date}`;
  const totalPrice = updateEstimate();

  if (!date || !people || people < 1) {
    msgEl.innerHTML = `<p class="pt-msg error">모든 항목을 입력해주세요.</p>`;
    return;
  }
  if (paymentMethod === "deposit" && (!currentAgency || currentAgency.depositBalance < totalPrice)) {
    msgEl.innerHTML = `<p class="pt-msg error">예치금 잔액이 부족합니다 (필요: ${fmtPeso(totalPrice)}). Cash @ Office를 선택하거나 입금을 요청하세요.</p>`;
    return;
  }

  try {
    const reservationRef = await addDoc(collection(db, "reservations"), {
      tourType,
      date,
      people,
      name: label,
      email: auth.currentUser.email,
      nationality: selectedNationality,
      pricePerPerson: NET_PRICES[tourType]?.[selectedNationality],
      totalPrice,
      currency: "PHP",
      status: paymentMethod === "deposit" ? "confirmed" : "pending",
      bookedBy: "agency",
      agencyId: currentUid,
      qrToken: randomToken("WHALE"),
      checkedIn: false,
      depositApplied: paymentMethod === "deposit" ? false : true,
      paymentMethod,
      createdAt: serverTimestamp()
    });

    if (paymentMethod === "deposit") {
      // 잔액 차감 + depositApplied 확정을 하나의 트랜잭션으로.
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
    }

    msgEl.innerHTML = `<p class="pt-msg success">예약이 ${paymentMethod === "deposit" ? "확정" : "등록(현장결제 예정)"}되었습니다.</p>`;
    e.target.reset();
    document.getElementById("b-people").value = 1;
    updateEstimate();
    setTimeout(() => switchView("dashboard"), 900);
  } catch (err) {
    console.error("Booking failed:", err);
    msgEl.innerHTML = `<p class="pt-msg error">예약에 실패했습니다. 잔액을 다시 확인해주세요.</p>`;
  }
});

// ── Reservations (dashboard recent + full list) ─────────────────
function listenReservations() {
  onSnapshot(
    query(collection(db, "reservations"), where("agencyId", "==", currentUid)),
    (snapshot) => {
      reservationsCache = new Map();
      snapshot.forEach(d => reservationsCache.set(d.id, d.data()));
      renderDashboardStats();
      renderRecentList();
      renderAllList();
    }
  );
}

function badgeFor(b) {
  if (b.checkedIn) return `<span class="pt-badge pt-badge-used">체크인완료</span>`;
  if (b.status === "pending") return `<span class="pt-badge pt-badge-pending">PENDING</span>`;
  return `<span class="pt-badge pt-badge-confirmed">${STATUS_LABEL[b.status] || b.status}</span>`;
}

function bookingRowHtml(id, b) {
  return `
    <div class="pt-booking-row">
      <div>
        <div class="pt-booking-code">${bookingCode(id)}</div>
        <div class="pt-booking-main">${b.date} · ${TOUR_SHORT[b.tourType] || b.tourType}</div>
        <div class="pt-booking-sub">${b.name} · ${b.people}명 · ${fmtPeso(b.totalPrice)} · ${b.paymentMethod === "cash_office" ? "Cash @ Office" : "Deposit"}</div>
        ${badgeFor(b)}
      </div>
      <button class="pt-btn pt-btn-ghost" data-action="qr" data-id="${id}">QR 보기</button>
    </div>
  `;
}

function sortedReservations() {
  return [...reservationsCache.entries()].sort((a, b) => (a[1].date < b[1].date ? 1 : -1));
}

function renderDashboardStats() {
  const todayKey = new Date().toISOString().slice(0, 10);
  let today = 0, upcoming = 0;
  reservationsCache.forEach(b => {
    if (b.date === todayKey) today++;
    else if (b.date > todayKey) upcoming++;
  });
  document.getElementById("stat-today").textContent = today;
  document.getElementById("stat-upcoming").textContent = upcoming;
}

function renderRecentList() {
  const el = document.getElementById("recent-list");
  const rows = sortedReservations().slice(0, 5);
  el.innerHTML = rows.length ? rows.map(([id, b]) => bookingRowHtml(id, b)).join("") : `<p class="pt-empty">예약 내역이 없습니다.</p>`;
}

function renderAllList() {
  const el = document.getElementById("all-list");
  const rows = sortedReservations();
  el.innerHTML = rows.length ? rows.map(([id, b]) => bookingRowHtml(id, b)).join("") : `<p class="pt-empty">예약 내역이 없습니다.</p>`;
}

document.querySelectorAll("#recent-list, #all-list").forEach(el => {
  el.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action='qr']");
    if (!btn) return;
    const b = reservationsCache.get(btn.dataset.id);
    if (b) openQrModal(btn.dataset.id, b);
  });
});

function openQrModal(id, booking) {
  const root = document.getElementById("modal-root");
  root.innerHTML = `
    <div class="pt-modal-overlay" id="modal-overlay">
      <div class="pt-modal-box">
        <h3>${bookingCode(id)} · ${booking.date} · ${booking.people}명</h3>
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

// ── Deposit / transactions ledger ───────────────────────────────
function listenTransactions() {
  onSnapshot(
    query(collection(db, "agencyTransactions"), where("agencyId", "==", currentUid)),
    (snapshot) => {
      txCache = new Map();
      snapshot.forEach(d => txCache.set(d.id, d.data()));
      renderTxList();
    }
  );
}

function renderTxList() {
  const el = document.getElementById("tx-list");
  const rows = [...txCache.values()].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  if (!rows.length) {
    el.innerHTML = `<p class="pt-empty">거래 내역이 없습니다.</p>`;
    return;
  }
  el.innerHTML = rows.map(tx => `
    <div class="pt-tx-row">
      <div>
        <div class="pt-tx-note">${tx.type === "topup" ? "입금 반영" : (tx.note || "예약 결제")}</div>
        <div class="pt-tx-date">${fmtDate(tx.createdAt)}</div>
      </div>
      <div class="pt-tx-amount ${tx.amount >= 0 ? "positive" : "negative"}">${tx.amount >= 0 ? "+" : ""}${fmtPeso(tx.amount)}</div>
    </div>
  `).join("");
}

// ── Deposit top-up requests ─────────────────────────────────────
// 실제 송금(계좌이체 등)은 이 시스템 밖에서 이루어지고, 여기서는 "이만큼
// 넣었으니 확인해달라"는 신청만 남깁니다. 관리자가 admin.html에서 승인하면
// 그때 잔액이 실제로 올라갑니다.
let depositRequestsCache = new Map();
const DR_STATUS_LABEL = { pending: "확인중", approved: "승인됨", rejected: "거절됨" };
const DR_STATUS_CLASS = { pending: "pt-badge-pending", approved: "pt-badge-used", rejected: "pt-badge-confirmed" };

function listenDepositRequests() {
  onSnapshot(
    query(collection(db, "depositRequests"), where("agencyId", "==", currentUid)),
    (snapshot) => {
      depositRequestsCache = new Map();
      snapshot.forEach(d => depositRequestsCache.set(d.id, d.data()));
      renderDepositRequestList();
    }
  );
}

function renderDepositRequestList() {
  const el = document.getElementById("deposit-request-list");
  const rows = [...depositRequestsCache.values()].sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0));
  if (!rows.length) {
    el.innerHTML = `<p class="pt-empty">신청 내역이 없습니다.</p>`;
    return;
  }
  el.innerHTML = rows.map(r => `
    <div class="pt-tx-row">
      <div>
        <div class="pt-tx-note">${r.note || "입금 신청"}</div>
        <div class="pt-tx-date">${fmtDate(r.requestedAt)}</div>
      </div>
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="pt-tx-amount positive">+${fmtPeso(r.amount)}</span>
        <span class="pt-badge ${DR_STATUS_CLASS[r.status] || ""}">${DR_STATUS_LABEL[r.status] || r.status}</span>
      </div>
    </div>
  `).join("");
}

document.getElementById("deposit-request-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msgEl = document.getElementById("deposit-request-message");
  msgEl.innerHTML = "";
  const amount = Number(document.getElementById("dr-amount").value);
  const depositDate = document.getElementById("dr-date").value;
  const depositorName = document.getElementById("dr-name").value.trim();

  if (!amount || amount <= 0) {
    msgEl.innerHTML = `<p class="pt-msg error">올바른 금액을 입력해주세요.</p>`;
    return;
  }
  if (!depositDate || !depositorName) {
    msgEl.innerHTML = `<p class="pt-msg error">입금 날짜와 입금자 이름을 입력해주세요.</p>`;
    return;
  }

  try {
    await addDoc(collection(db, "depositRequests"), {
      agencyId: currentUid,
      agencyName: currentAgency?.name || "",
      amount,
      method: "gcash",
      depositDate,
      depositorName,
      note: `GCash · ${depositDate} · ${depositorName}`,
      status: "pending",
      requestedAt: serverTimestamp(),
      resolvedAt: null,
      resolvedBy: null
    });
    msgEl.innerHTML = `<p class="pt-msg success">입금 신청이 접수되었습니다. 관리자 확인 후 잔액에 반영됩니다.</p>`;
    e.target.reset();
  } catch (err) {
    console.error("Deposit request failed:", err);
    msgEl.innerHTML = `<p class="pt-msg error">신청에 실패했습니다. 다시 시도해주세요.</p>`;
  }
});
