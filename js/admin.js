import { db, auth } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Elements
const loginOverlay = document.getElementById("login-overlay");
const dashboard = document.getElementById("dashboard");
const emailInput = document.getElementById("email-input");
const passwordInput = document.getElementById("password-input");
const loginBtn = document.getElementById("login-btn");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const refreshBtn = document.getElementById("refresh-btn");

const tbody = document.getElementById("reservation-tbody");
const statTotal = document.getElementById("stat-total");
const statPending = document.getElementById("stat-pending");
const statConfirmed = document.getElementById("stat-confirmed");

// Real Firebase Authentication — replaces the old client-side-only PIN check,
// which never satisfied Firestore's `request.auth != null` rule anyway.
onAuthStateChanged(auth, (user) => {
  if (user) {
    loginOverlay.style.display = "none";
    dashboard.style.display = "block";
    loadReservations();
  } else {
    loginOverlay.style.display = "flex";
    dashboard.style.display = "none";
  }
});

loginBtn.addEventListener("click", async () => {
  loginError.style.display = "none";
  try {
    await signInWithEmailAndPassword(auth, emailInput.value.trim(), passwordInput.value);
  } catch (err) {
    console.error("Login failed:", err);
    loginError.style.display = "block";
    passwordInput.value = "";
  }
});

[emailInput, passwordInput].forEach(el => {
  el.addEventListener("keyup", (e) => {
    if (e.key === "Enter") loginBtn.click();
  });
});

logoutBtn.addEventListener("click", () => {
  signOut(auth);
  emailInput.value = "";
  passwordInput.value = "";
});

refreshBtn.addEventListener("click", () => {
  loadReservations();
});

// Load Data from Firestore
async function loadReservations() {
  tbody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>로딩 중...</td></tr>";
  try {
    const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    
    let total = 0;
    let pending = 0;
    let confirmed = 0;
    
    tbody.innerHTML = "";
    
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const id = docSnap.id;
      
      total++;
      if (data.status === "pending") pending++;
      if (data.status === "confirmed") confirmed++;
      
      const tr = document.createElement("tr");
      
      // Format Date
      let createdDate = "N/A";
      if (data.createdAt) {
        const d = data.createdAt.toDate();
        createdDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      }
      
      // Tour Type Mapping
      let tourName = data.tourType;
      if (tourName === "VF") tourName = "VIP패스트트랙";
      if (tourName === "F") tourName = "패스트트랙";
      if (tourName === "R") tourName = "레귤러 고래상어투어";
      if (tourName === "T") tourName = "고래상어 티켓만";

      // Status Select
      const selectHtml = `
        <div class="badge ${data.status}">
          <select class="status-select" data-id="${id}">
            <option value="pending" ${data.status === "pending" ? "selected" : ""}>대기중</option>
            <option value="confirmed" ${data.status === "confirmed" ? "selected" : ""}>예약확정</option>
            <option value="cancelled" ${data.status === "cancelled" ? "selected" : ""}>취소됨</option>
          </select>
        </div>
      `;

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600;">${data.date}</div>
          <div style="font-size: 0.8rem; color: var(--admin-text-muted);">신청: ${createdDate}</div>
        </td>
        <td style="font-weight: bold;">${data.name}</td>
        <td>${tourName}</td>
        <td>
          <div class="badge ${data.paymentStatus === 'paid' ? 'confirmed' : 'pending'}">
            ${data.paymentStatus === 'paid' ? '결제완료' : '미결제'}
          </div>
          ${data.paymentMethod ? `<div style="font-size:0.75rem; color:#10b981; margin-top:4px;">${data.paymentMethod}</div>` : ''}
        </td>
        <td>${data.people}명</td>
        <td>${data.nationality === "PH" ? "필리핀" : data.nationality === "FOREIGN" ? "외국인" : "-"}</td>
        <td>
          <div>${data.email}</div>
        </td>
        <td>${selectHtml}</td>
        <td>
          <button class="action-btn delete-btn" data-id="${id}">삭제</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (total === 0) {
      tbody.innerHTML = "<tr><td colspan='9' style='text-align:center;'>예약 내역이 없습니다.</td></tr>";
    }

    statTotal.textContent = total;
    statPending.textContent = pending;
    statConfirmed.textContent = confirmed;

    attachEventListeners();

  } catch (error) {
    console.error("Error loading reservations: ", error);
    tbody.innerHTML = "<tr><td colspan='9' style='text-align:center; color: red;'>데이터를 불러오는 중 오류가 발생했습니다.</td></tr>";
  }
}

// Action Event Listeners
function attachEventListeners() {
  // Status Change
  const selects = document.querySelectorAll(".status-select");
  selects.forEach(select => {
    select.addEventListener("change", async (e) => {
      const id = e.target.getAttribute("data-id");
      const newStatus = e.target.value;
      const badgeDiv = e.target.parentElement;
      
      // Update badge class visually immediately
      badgeDiv.className = `badge ${newStatus}`;

      try {
        await updateDoc(doc(db, "reservations", id), {
          status: newStatus
        });
        // Update stats
        loadReservations();
      } catch (err) {
        console.error("Error updating status: ", err);
        alert("상태 업데이트에 실패했습니다.");
      }
    });
  });

  // Delete
  const deleteBtns = document.querySelectorAll(".delete-btn");
  deleteBtns.forEach(btn => {
    btn.addEventListener("click", async (e) => {
      if (confirm("정말로 이 예약을 삭제하시겠습니까? 복구할 수 없습니다.")) {
        const id = e.target.getAttribute("data-id");
        try {
          await deleteDoc(doc(db, "reservations", id));
          loadReservations();
        } catch (err) {
          console.error("Error deleting reservation: ", err);
          alert("삭제에 실패했습니다.");
        }
      }
    });
  });
}
