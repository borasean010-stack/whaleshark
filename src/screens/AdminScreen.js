import { useState, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator } from "react-native";
import {
  collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import { TOUR_NAMES, STATUS_LABEL, fmtPeso } from "../agencyPricing";
import { colors, fonts } from "../theme";

// admin.html과 완전히 같은 Firestore 흐름을 그대로 씁니다 — 로그인한
// 계정이 luca@boracaywhaleshark.com이 아니면 Firestore 보안 규칙이 애초에
// 읽기를 거부하니, 여기서도 admin.html처럼 별도 이메일 체크 없이 로그인만
// 시도하고 실패(permission-denied)하면 관리자가 아니라고 안내합니다.
const VIEWS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reservations", label: "예약" },
  { key: "settlement", label: "정산" },
  { key: "broadcast", label: "방송 알림" },
];

const STATUS_OPTIONS = [
  { key: "pending", label: "대기중" },
  { key: "confirmed", label: "확정" },
  { key: "cancelled", label: "취소" },
];

async function sendExpoPush(messages) {
  const list = messages.filter((m) => m && m.to);
  if (!list.length) return;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    try {
      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
    } catch (err) {
      console.error("Push send failed:", err);
    }
  }
}

function notifyReservationConfirmed({ pushToken, date, tourType }) {
  if (!pushToken) return;
  const tourName = TOUR_NAMES[tourType] || tourType || "";
  sendExpoPush([{
    to: pushToken,
    title: "🐋 예약이 확정되었습니다",
    body: `${date || ""} ${tourName} 예약이 확정됐어요!`.trim(),
  }]);
}

export default function AdminScreen() {
  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState(null);
  const [notAdmin, setNotAdmin] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [view, setView] = useState("dashboard");
  const [reservations, setReservations] = useState([]);
  const [agencies, setAgencies] = useState([]);

  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastMsg, setBroadcastMsg] = useState(null);
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setAuthChecked(true);
      setNotAdmin(false);
      setUid(user ? user.uid : null);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "reservations"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setReservations(list);
      },
      (err) => {
        console.error("Reservations read failed:", err);
        setNotAdmin(true);
        signOut(auth);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      collection(db, "agencies"),
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        setAgencies(list);
      },
      () => {}
    );
  }, [uid]);

  async function handleLogin() {
    setLoginError("");
    setNotAdmin(false);
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setLoginError("로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function handleStatusChange(id, newStatus) {
    try {
      await updateDoc(doc(db, "reservations", id), { status: newStatus });
      if (newStatus === "confirmed") {
        const r = reservations.find((x) => x.id === id);
        if (r) notifyReservationConfirmed(r);
      }
    } catch (err) {
      console.error("Status update failed:", err);
    }
  }

  async function handleCashCollected(r) {
    try {
      await updateDoc(doc(db, "reservations", r.id), { status: "confirmed" });
      notifyReservationConfirmed(r);
    } catch (err) {
      console.error("Cash collection confirm failed:", err);
    }
  }

  async function handleBroadcast() {
    setBroadcastMsg(null);
    const message = broadcastMessage.trim();
    if (!message) return;
    setBroadcastSubmitting(true);
    try {
      const snap = await getDocs(collection(db, "pushTokens"));
      const tokens = [];
      snap.forEach((d) => { if (d.data().token) tokens.push(d.data().token); });
      if (!tokens.length) {
        setBroadcastMsg({ type: "error", text: "등록된 기기가 없습니다." });
        return;
      }
      await sendExpoPush(tokens.map((to) => ({ to, title: "🐋 Boracay Whale Shark", body: message })));
      setBroadcastMsg({ type: "success", text: `${tokens.length}개 기기로 발송했습니다.` });
      setBroadcastMessage("");
    } catch (err) {
      console.error("Broadcast failed:", err);
      setBroadcastMsg({ type: "error", text: "발송에 실패했습니다." });
    } finally {
      setBroadcastSubmitting(false);
    }
  }

  const stats = useMemo(() => {
    const total = reservations.length;
    const pending = reservations.filter((r) => r.status === "pending").length;
    const confirmed = reservations.filter((r) => r.status === "confirmed").length;
    const totalBalance = agencies.reduce((s, a) => s + (a.depositBalance || 0), 0);
    const settlementNeeded = reservations.filter((r) => r.bookedBy === "agency" && r.depositApplied === false).length;
    return { total, pending, confirmed, agencyCount: agencies.length, totalBalance, settlementNeeded };
  }, [reservations, agencies]);

  const cashPending = useMemo(
    () => reservations.filter((r) => r.paymentMethod === "cash_office" && r.status === "pending"),
    [reservations]
  );

  if (!authChecked) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brandBlue} />
      </View>
    );
  }

  if (!uid) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 24, paddingTop: 80 }}>
        <Text style={styles.loginTitle}>Admin Login</Text>
        <Text style={styles.loginSubtitle}>관리자 계정으로 로그인하세요.</Text>
        {notAdmin && <Text style={styles.errorText}>이 계정은 관리자 권한이 없습니다.</Text>}
        <TextInput style={styles.input} placeholder="이메일" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="#94a3b8" secureTextEntry value={password} onChangeText={setPassword} />
        {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
        <Pressable style={styles.loginBtn} onPress={handleLogin} disabled={loggingIn}>
          {loggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>로그인</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  function reservationRow(r) {
    return (
      <View key={r.id} style={styles.card}>
        <Text style={styles.rowMain}>{r.date} · {TOUR_NAMES[r.tourType] || r.tourType}</Text>
        <Text style={styles.rowSub}>{r.name} · {r.people}명 · {fmtPeso(r.totalPrice)}</Text>
        <Text style={styles.rowSub}>{r.email}{r.bookedBy === "agency" ? " · B2B" : ""}</Text>
        <View style={styles.statusRow}>
          {STATUS_OPTIONS.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.statusPill, r.status === s.key && styles.statusPillActive]}
              onPress={() => handleStatusChange(r.id, s.key)}
            >
              <Text style={[styles.statusPillText, r.status === s.key && styles.statusPillTextActive]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  function renderDashboard() {
    const recent = reservations.slice(0, 10);
    return (
      <>
        <Text style={styles.title}>관리자 대시보드</Text>
        <View style={styles.statsGrid}>
          <StatCard label="전체 예약" value={stats.total} />
          <StatCard label="대기중" value={stats.pending} color="#f59e0b" />
          <StatCard label="B2B 파트너" value={stats.agencyCount} />
          <StatCard label="B2B 예치금" value={fmtPeso(stats.totalBalance)} color="#16a34a" />
          <StatCard label="정산 필요" value={stats.settlementNeeded} color="#dc2626" />
        </View>
        <Text style={styles.sectionLabel}>최신 예약</Text>
        {recent.length === 0 ? <Text style={styles.emptyText}>예약 내역이 없습니다.</Text> : recent.map(reservationRow)}
      </>
    );
  }

  function renderReservations() {
    return (
      <>
        <Text style={styles.title}>전체 예약</Text>
        {reservations.length === 0 ? <Text style={styles.emptyText}>예약 내역이 없습니다.</Text> : reservations.map(reservationRow)}
      </>
    );
  }

  function renderSettlement() {
    return (
      <>
        <Text style={styles.title}>정산 — 현금 수령 대기</Text>
        {cashPending.length === 0 ? (
          <Text style={styles.emptyText}>수금 대기 건이 없습니다.</Text>
        ) : (
          cashPending.map((r) => (
            <View key={r.id} style={styles.card}>
              <Text style={styles.rowMain}>{r.date} · {TOUR_NAMES[r.tourType] || r.tourType}</Text>
              <Text style={styles.rowSub}>{r.name} · {fmtPeso(r.totalPrice)}</Text>
              <Pressable style={styles.confirmBtn} onPress={() => handleCashCollected(r)}>
                <Text style={styles.confirmBtnText}>현금 수령 확인</Text>
              </Pressable>
            </View>
          ))
        )}
      </>
    );
  }

  function renderBroadcast() {
    return (
      <>
        <Text style={styles.title}>🐋 고래상어 출몰 알림 방송</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>알림 내용</Text>
          <TextInput
            style={styles.textInput}
            placeholder="예: 오늘 고래상어 나타났어요! 🦈"
            placeholderTextColor="#94a3b8"
            value={broadcastMessage}
            onChangeText={setBroadcastMessage}
          />
          {broadcastMsg && (
            <Text style={broadcastMsg.type === "error" ? styles.errorText : styles.successText}>{broadcastMsg.text}</Text>
          )}
          <Pressable style={[styles.confirmBtn, { marginTop: 12 }, broadcastSubmitting && { opacity: 0.5 }]} onPress={handleBroadcast} disabled={broadcastSubmitting}>
            {broadcastSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmBtnText}>앱 열어본 사람 전체에게 보내기</Text>}
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.headerRow}>
        <Text style={styles.headerBrand}>🐋 Admin</Text>
        <Pressable onPress={() => signOut(auth)}><Text style={styles.signOut}>로그아웃</Text></Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {VIEWS.map((v) => (
          <Pressable key={v.key} style={[styles.tabPill, view === v.key && styles.tabPillActive]} onPress={() => setView(v.key)}>
            <Text style={[styles.tabPillText, view === v.key && styles.tabPillTextActive]}>{v.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {view === "dashboard" && renderDashboard()}
        {view === "reservations" && renderReservations()}
        {view === "settlement" && renderSettlement()}
        {view === "broadcast" && renderBroadcast()}
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, color }) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, color && { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  loginTitle: { fontFamily: fonts.headingBlack, fontSize: 24, color: colors.heading, marginBottom: 8 },
  loginSubtitle: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginBottom: 20 },
  input: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, fontFamily: fonts.body, fontSize: 15, color: colors.heading, marginBottom: 12,
  },
  loginBtn: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  loginBtnText: { color: colors.white, fontFamily: fonts.heading, fontSize: 14 },
  errorText: { color: "#ef4444", fontFamily: fonts.body, fontSize: 12, marginTop: 6, marginBottom: 10 },
  successText: { color: "#16a34a", fontFamily: fonts.body, fontSize: 12, marginTop: 6, marginBottom: 10 },

  headerRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingTop: 56, paddingBottom: 14, backgroundColor: colors.white,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerBrand: { fontFamily: fonts.headingBlack, fontSize: 16, color: colors.heading },
  signOut: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },

  tabBar: { flexGrow: 0, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  tabPill: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "#F1F5F9" },
  tabPillActive: { backgroundColor: colors.brandBlue },
  tabPillText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.heading },
  tabPillTextActive: { color: colors.white },

  title: { fontFamily: fonts.headingBlack, fontSize: 20, color: colors.heading, marginBottom: 16 },
  sectionLabel: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1, color: colors.heading, marginBottom: 12, marginTop: 8 },
  emptyText: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  statCard: { flexBasis: "31%", flexGrow: 1, backgroundColor: colors.white, borderRadius: 14, padding: 14, alignItems: "center" },
  statValue: { fontFamily: fonts.headingBlack, fontSize: 18, color: colors.heading },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, marginTop: 2, textAlign: "center" },

  card: { backgroundColor: colors.white, borderRadius: 14, padding: 14, marginBottom: 10 },
  rowMain: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.heading, marginBottom: 2 },
  rowSub: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginBottom: 2 },
  statusRow: { flexDirection: "row", gap: 6, marginTop: 8 },
  statusPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  statusPillActive: { backgroundColor: colors.brandBlue, borderColor: colors.brandBlue },
  statusPillText: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.heading },
  statusPillTextActive: { color: colors.white },

  fieldLabel: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.5, color: colors.brandBlue, marginBottom: 6 },
  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 14, color: colors.heading,
  },
  confirmBtn: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 12, alignItems: "center", marginTop: 10 },
  confirmBtnText: { color: colors.white, fontFamily: fonts.heading, fontSize: 12 },
});
