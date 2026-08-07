import { db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const listEl = document.getElementById("reservation-list");

const statusLabel = {
  pending: "대기",
  confirmed: "확정",
  cancelled: "취소"
};

function formatTimestamp(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("ko-KR");
}

function td(text) {
  const cell = document.createElement("td");
  cell.textContent = text ?? "";
  return cell;
}

function renderRow(id, data) {
  const row = document.createElement("tr");

  row.appendChild(td(formatTimestamp(data.createdAt)));

  const statusCell = document.createElement("td");
  const select = document.createElement("select");
  Object.entries(statusLabel).forEach(([value, label]) => {
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = label;
    if (data.status === value) opt.selected = true;
    select.appendChild(opt);
  });
  select.addEventListener("change", async () => {
    await updateDoc(doc(db, "reservations", id), { status: select.value });
  });
  statusCell.appendChild(select);
  row.appendChild(statusCell);

  row.appendChild(td(data.tourType));
  row.appendChild(td(data.date));
  row.appendChild(td(String(data.people ?? "")));
  row.appendChild(td(data.name));
  row.appendChild(td(data.phone));
  row.appendChild(td(data.email));
  row.appendChild(td(data.message));

  const actionCell = document.createElement("td");
  const delBtn = document.createElement("button");
  delBtn.textContent = "삭제";
  delBtn.addEventListener("click", async () => {
    if (confirm("이 예약을 삭제할까요?")) {
      await deleteDoc(doc(db, "reservations", id));
    }
  });
  actionCell.appendChild(delBtn);
  row.appendChild(actionCell);

  return row;
}

const q = query(collection(db, "reservations"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  listEl.innerHTML = "";
  if (snapshot.empty) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.className = "loading";
    cell.textContent = "접수된 예약이 없습니다.";
    row.appendChild(cell);
    listEl.appendChild(row);
    return;
  }
  snapshot.forEach((docSnap) => {
    listEl.appendChild(renderRow(docSnap.id, docSnap.data()));
  });
}, (err) => {
  console.error(err);
  listEl.innerHTML = "";
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 10;
  cell.className = "loading";
  cell.textContent = "예약 목록을 불러오지 못했습니다. Firestore 설정을 확인해주세요.";
  row.appendChild(cell);
  listEl.appendChild(row);
});
