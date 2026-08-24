import { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Modal, Image, Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import QRCode from "react-native-qrcode-svg";
import {
  doc, getDoc, addDoc, collection, query, where, onSnapshot, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../firebaseConfig";
import { randomToken } from "../qrToken";
import { getExpoPushToken } from "../notifications";
import { colors, fonts } from "../theme";
import {
  PUBLISHED_PRICES, NET_PRICES, BUNDLE_TICKET_PRICE, ADDON_PRICE, GROUP_PRICES,
  TOUR_NAMES, TOUR_SHORT, TOUR_TYPES, ADDON_LABEL, ADDON_SHORT, GROUP_SIZES, NATIONALITIES,
  STATUS_LABEL, priceTierFor, pricePerPersonFor, bookingCode, fmtPeso, fmtDate,
} from "../agencyPricing";

// 웹사이트 js/agency-portal.js와 완전히 같은 Firestore 흐름을 그대로
// 씁니다 — 같은 백엔드/보안규칙을 쓰는 두 번째 클라이언트일 뿐입니다.

const VIEWS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "reservation", label: "+ 신규 예약" },
  { key: "reservations", label: "예약 목록" },
  { key: "deposit", label: "예치금" },
  { key: "transactions", label: "거래내역" },
];

const MEETING_TIMES = ["07:30", "09:00"];

// iOS 기본 display("default")는 iOS 14부터 작은 칩 하나만 보여주고, 그걸
// 또 한 번 눌러야 진짜 달력이 뜹니다 — "바로 달력이 뜨는" 느낌을 주려고
// display="inline"(풀 캘린더)을 모달 안에 넣어서 탭 한 번에 바로 보여줍니다.
// 안드로이드는 원래 네이티브 다이얼로그가 탭 즉시 뜨므로 그대로 둡니다.
function DateField({ label, value, onChange, minDate }) {
  const [show, setShow] = useState(false);

  function onPickAndroid(event, selectedDate) {
    setShow(false);
    if (event.type !== "dismissed" && selectedDate) {
      onChange(selectedDate.toISOString().slice(0, 10));
    }
  }

  function onPickIOS(event, selectedDate) {
    if (selectedDate) onChange(selectedDate.toISOString().slice(0, 10));
  }

  return (
    <View style={{ flex: 1 }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <Pressable style={styles.textInput} onPress={() => setShow(true)}>
        <Text style={value ? styles.dateText : styles.datePlaceholder}>{value || "YYYY-MM-DD"}</Text>
      </Pressable>

      {Platform.OS === "android" && show && (
        <DateTimePicker
          value={value ? new Date(value) : (minDate || new Date())}
          mode="date"
          minimumDate={minDate}
          onChange={onPickAndroid}
        />
      )}

      {Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShow(false)}>
            <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
              <DateTimePicker
                value={value ? new Date(value) : (minDate || new Date())}
                mode="date"
                display="inline"
                themeVariant="light"
                minimumDate={minDate}
                onChange={onPickIOS}
              />
              <Pressable style={styles.modalClose} onPress={() => setShow(false)}>
                <Text style={styles.modalCloseText}>확인</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

export default function PartnerScreen() {
  const [authChecked, setAuthChecked] = useState(false);
  const [uid, setUid] = useState(null);
  const [agency, setAgency] = useState(null);
  const [notAnAgency, setNotAnAgency] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [view, setView] = useState("dashboard");

  // ── New reservation form state ──────────────────────────────────
  const [selectedTour, setSelectedTour] = useState("R");
  const [selectedMeetingTime, setSelectedMeetingTime] = useState("07:30");
  const [selectedAddons, setSelectedAddons] = useState(new Set());
  const [selectedGroupSize, setSelectedGroupSize] = useState(null);
  const [selectedNationality, setSelectedNationality] = useState("PH");
  const [selectedPay, setSelectedPay] = useState("deposit");
  const [adultCount, setAdultCount] = useState(2);
  const [childCount, setChildCount] = useState(0);
  const [date, setDate] = useState("");
  const [addonDates, setAddonDates] = useState({ H: "", L: "", HG: "" });
  const [bookingMsg, setBookingMsg] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [reservations, setReservations] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [depositRequests, setDepositRequests] = useState([]);
  const [qrBooking, setQrBooking] = useState(null);

  // ── Deposit request form state ──────────────────────────────────
  const [drAmount, setDrAmount] = useState("");
  const [drDate, setDrDate] = useState("");
  const [drName, setDrName] = useState("");
  const [drMsg, setDrMsg] = useState(null);
  const [drSubmitting, setDrSubmitting] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      setAuthChecked(true);
      if (!user) {
        setUid(null);
        setAgency(null);
        return;
      }
      const snap = await getDoc(doc(db, "agencies", user.uid));
      if (!snap.exists()) {
        setNotAnAgency(true);
        await signOut(auth);
        return;
      }
      setNotAnAgency(false);
      setUid(user.uid);
    });
  }, []);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, "agencies", uid), (snap) => {
      if (snap.exists()) setAgency(snap.data());
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "reservations"), where("agencyId", "==", uid)),
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (a.date < b.date ? 1 : -1));
        setReservations(list);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "agencyTransactions"), where("agencyId", "==", uid)),
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setTransactions(list);
      }
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      query(collection(db, "depositRequests"), where("agencyId", "==", uid)),
      (snapshot) => {
        const list = [];
        snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
        list.sort((a, b) => (b.requestedAt?.toMillis?.() || 0) - (a.requestedAt?.toMillis?.() || 0));
        setDepositRequests(list);
      }
    );
  }, [uid]);

  const isGroup = selectedAddons.has("HG");
  const people = adultCount + childCount;
  const showMeeting = !isGroup && (selectedTour === "R" || selectedTour === "F" || selectedTour === "VF");
  const needsMeetingChoice = selectedTour === "R";

  const total = useMemo(() => {
    if (isGroup) return selectedGroupSize ? GROUP_PRICES[selectedGroupSize] : 0;
    return pricePerPersonFor(selectedTour, selectedAddons, selectedNationality) * people;
  }, [isGroup, selectedGroupSize, selectedTour, selectedAddons, selectedNationality, people]);

  const breakdown = useMemo(() => {
    if (isGroup) {
      if (!selectedGroupSize) return null;
      return {
        group: true,
        label: `단독 호핑투어 (${selectedGroupSize}명, 티켓 할인 포함가)`,
        value: GROUP_PRICES[selectedGroupSize],
      };
    }
    const perAddons = [...selectedAddons].filter((a) => a !== "HG");
    const tier = priceTierFor(selectedNationality);
    const hasAddon = perAddons.length > 0;
    const isBundledTicket = selectedTour === "T" && hasAddon;
    const netBase = isBundledTicket ? BUNDLE_TICKET_PRICE[tier] : (NET_PRICES[selectedTour]?.[tier] || 0);
    const publishedBase = isBundledTicket ? PUBLISHED_PRICES.T[tier] : (PUBLISHED_PRICES[selectedTour]?.[tier] || 0);
    const addonSum = perAddons.reduce((s, a) => s + (ADDON_PRICE[a] || 0), 0);
    return {
      group: false,
      tourLabel: `${TOUR_NAMES[selectedTour]} (1인)`,
      netBase, publishedBase,
      addons: perAddons,
      perPersonTotal: netBase + addonSum,
      peopleCount: people,
    };
  }, [isGroup, selectedGroupSize, selectedAddons, selectedNationality, selectedTour, people]);

  function toggleAddon(addon) {
    setSelectedAddons((prev) => {
      const turningOn = !prev.has(addon);
      const next = new Set(prev);
      if (turningOn && addon === "H" && next.has("HG")) next.delete("HG");
      if (turningOn && addon === "HG" && next.has("H")) next.delete("H");
      if (turningOn) next.add(addon); else next.delete(addon);
      return next;
    });
    setAddonDates((prev) => (selectedAddons.has(addon) ? { ...prev, [addon]: "" } : prev));
  }

  async function handleLogin() {
    setLoginError("");
    setNotAnAgency(false);
    setLoggingIn(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      setLoginError("로그인에 실패했습니다. 이메일/비밀번호를 확인해주세요.");
    } finally {
      setLoggingIn(false);
    }
  }

  function resetBookingForm() {
    setSelectedAddons(new Set());
    setAddonDates({ H: "", L: "", HG: "" });
    setSelectedGroupSize(null);
    setAdultCount(2);
    setChildCount(0);
    setDate("");
    setSelectedMeetingTime("07:30");
  }

  async function handleBook() {
    setBookingMsg(null);
    const tourType = selectedTour;
    const paymentMethod = selectedPay;
    // 단독 호핑투어(HG)도 가격은 GUESTS 인원 구간(selectedGroupSize)의 고정
    // 총액을 그대로 쓰지만, 실제 참가 인원(성인/아동)은 밴 배차·식사 인원 등
    // 현장 운영에 필요해서 별도로 기록합니다.
    const bookedPeople = people;

    if (!date || bookedPeople < 1 || (isGroup && !selectedGroupSize)) {
      setBookingMsg({ type: "error", text: "모든 항목을 입력해주세요." });
      return;
    }
    for (const a of selectedAddons) {
      if (!addonDates[a]) {
        setBookingMsg({ type: "error", text: `${ADDON_LABEL[a]} 날짜를 선택해주세요.` });
        return;
      }
    }
    if (paymentMethod === "deposit" && (!agency || agency.depositBalance < total)) {
      setBookingMsg({ type: "error", text: `예치금 잔액이 부족합니다 (필요: ${fmtPeso(total)}). 보라카이션 오피스페이를 선택하거나 입금을 요청하세요.` });
      return;
    }

    setSubmitting(true);
    try {
      const label = `${agency?.name || "Agency"} ${date}`;
      const addonDatesUsed = {};
      selectedAddons.forEach((a) => { addonDatesUsed[a] = addonDates[a]; });
      const pushToken = await getExpoPushToken();

      const reservationRef = await addDoc(collection(db, "reservations"), {
        tourType: isGroup ? "HG" : tourType,
        addons: [...selectedAddons],
        addonDates: addonDatesUsed,
        date,
        meetingTime: showMeeting ? (needsMeetingChoice ? selectedMeetingTime : "07:30") : "",
        pickup: "Jollibee Main Road",
        people: bookedPeople,
        adults: adultCount,
        children: childCount,
        name: label,
        email: auth.currentUser.email,
        nationality: isGroup ? "ALL" : selectedNationality,
        pricePerPerson: isGroup ? Math.round(total / bookedPeople) : pricePerPersonFor(tourType, selectedAddons, selectedNationality),
        totalPrice: total,
        currency: "PHP",
        status: paymentMethod === "deposit" ? "confirmed" : "pending",
        bookedBy: "agency",
        agencyId: uid,
        qrToken: randomToken("WHALE"),
        checkedIn: false,
        depositApplied: paymentMethod === "deposit" ? false : true,
        paymentMethod,
        createdAt: serverTimestamp(),
        ...(pushToken ? { pushToken } : {}),
      });

      if (paymentMethod === "deposit") {
        const agencyRef = doc(db, "agencies", uid);
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(agencyRef);
          const newBalance = snap.data().depositBalance - total;
          tx.update(agencyRef, { depositBalance: newBalance, lastPurchaseRef: reservationRef.id });
          tx.update(reservationRef, { depositApplied: true });
        });
        await addDoc(collection(db, "agencyTransactions"), {
          agencyId: uid,
          type: "purchase",
          amount: -total,
          note: `${TOUR_NAMES[tourType]} ${date} ${bookedPeople}명`,
          createdAt: serverTimestamp(),
          createdBy: uid,
        });
      }

      setBookingMsg({ type: "success", text: `예약이 ${paymentMethod === "deposit" ? "확정" : "등록(현장결제 예정)"}되었습니다.` });
      resetBookingForm();
      setTimeout(() => setView("dashboard"), 900);
    } catch (err) {
      console.error("Partner booking failed:", err);
      setBookingMsg({ type: "error", text: "예약에 실패했습니다. 잔액을 다시 확인해주세요." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDepositRequest() {
    setDrMsg(null);
    const amount = Number(drAmount);
    if (!amount || amount <= 0) {
      setDrMsg({ type: "error", text: "올바른 금액을 입력해주세요." });
      return;
    }
    if (!drDate || !drName.trim()) {
      setDrMsg({ type: "error", text: "입금 날짜와 입금자 이름을 입력해주세요." });
      return;
    }
    setDrSubmitting(true);
    try {
      await addDoc(collection(db, "depositRequests"), {
        agencyId: uid,
        agencyName: agency?.name || "",
        amount,
        method: "gcash",
        depositDate: drDate,
        depositorName: drName.trim(),
        note: `GCash · ${drDate} · ${drName.trim()}`,
        status: "pending",
        requestedAt: serverTimestamp(),
        resolvedAt: null,
        resolvedBy: null,
      });
      setDrMsg({ type: "success", text: "입금 신청이 접수되었습니다. 관리자 확인 후 잔액에 반영됩니다." });
      setDrAmount("");
      setDrDate("");
      setDrName("");
    } catch (err) {
      console.error("Deposit request failed:", err);
      setDrMsg({ type: "error", text: "신청에 실패했습니다. 다시 시도해주세요." });
    } finally {
      setDrSubmitting(false);
    }
  }

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
        <Text style={styles.loginTitle}>Partner Login</Text>
        <Text style={styles.loginSubtitle}>보라카이션 관리자가 등록해준 이메일/비밀번호로 로그인하세요.</Text>
        {notAnAgency && <Text style={styles.errorText}>이 계정은 에이전시로 등록되어 있지 않습니다.</Text>}
        <TextInput style={styles.input} placeholder="이메일" placeholderTextColor="#94a3b8" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} placeholder="비밀번호" placeholderTextColor="#94a3b8" secureTextEntry value={password} onChangeText={setPassword} />
        {loginError ? <Text style={styles.errorText}>{loginError}</Text> : null}
        <Pressable style={styles.loginBtn} onPress={handleLogin} disabled={loggingIn}>
          {loggingIn ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>로그인</Text>}
        </Pressable>
      </ScrollView>
    );
  }

  const todayKey = new Date().toISOString().slice(0, 10);
  let todayCount = 0, upcomingCount = 0;
  reservations.forEach((b) => {
    if (b.date === todayKey) todayCount++;
    else if (b.date > todayKey) upcomingCount++;
  });

  function bookingRow(b) {
    const qrReady = b.paymentMethod !== "cash_office" || b.status === "confirmed";
    const addonSuffix = (b.addons || []).filter((a) => a !== "HG").map((a) => ADDON_SHORT[a] || a);
    return (
      <View key={b.id} style={styles.bookingRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bookingCode}>{bookingCode(b.id)}</Text>
          <Text style={styles.bookingDate}>
            {b.date} · {TOUR_SHORT[b.tourType] || b.tourType}{addonSuffix.length ? ` + ${addonSuffix.join("/")}` : ""}
          </Text>
          <Text style={styles.bookingSub}>
            {b.name} · {b.tourType === "HG" ? `${b.people}명 그룹` : `성인${b.adults ?? b.people}${b.children ? ` · 아동${b.children}` : ""}`} · {fmtPeso(b.totalPrice)} · {b.paymentMethod === "cash_office" ? "보라카이션 오피스페이" : "Deposit"}
          </Text>
          <View style={{ flexDirection: "row", marginTop: 4 }}>
            {b.checkedIn ? (
              <Text style={[styles.badge, styles.badgeUsed]}>체크인완료</Text>
            ) : b.status === "pending" ? (
              <Text style={[styles.badge, styles.badgePending]}>PENDING</Text>
            ) : (
              <Text style={[styles.badge, styles.badgeConfirmed]}>{STATUS_LABEL[b.status] || b.status}</Text>
            )}
          </View>
        </View>
        {qrReady ? (
          <Pressable style={styles.qrBtn} onPress={() => setQrBooking(b)}>
            <Text style={styles.qrBtnText}>QR 보기</Text>
          </Pressable>
        ) : (
          <Text style={[styles.badge, styles.badgePending, { alignSelf: "center" }]}>결제 확인 후{"\n"}QR 발급</Text>
        )}
      </View>
    );
  }

  function renderDashboard() {
    const recent = reservations.slice(0, 5);
    return (
      <>
        <Text style={styles.title}>{agency?.name || "Partner"} Dashboard</Text>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>예치금 잔액</Text>
          <Text style={styles.balanceValue}>{fmtPeso(agency?.depositBalance)}</Text>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statCard}><Text style={styles.statValue}>{todayCount}</Text><Text style={styles.statLabel}>Today</Text></View>
          <View style={styles.statCard}><Text style={styles.statValue}>{upcomingCount}</Text><Text style={styles.statLabel}>Upcoming</Text></View>
        </View>
        <View style={styles.ctaRow}>
          <Pressable style={styles.ctaBtn} onPress={() => setView("reservation")}>
            <Text style={styles.ctaBtnText}>+ 신규 예약</Text>
          </Pressable>
          <Pressable style={[styles.ctaBtn, styles.ctaBtnSecondary]} onPress={() => setView("deposit")}>
            <Text style={[styles.ctaBtnText, styles.ctaBtnTextSecondary]}>+ 예치금</Text>
          </Pressable>
        </View>
        <Text style={styles.sectionLabel}>최근 예약</Text>
        {recent.length === 0 ? <Text style={styles.emptyText}>예약 내역이 없습니다.</Text> : recent.map(bookingRow)}
      </>
    );
  }

  function renderReservation() {
    return (
      <>
        <Text style={styles.title}>신규 예약</Text>
        <View style={styles.card}>
          <View style={isGroup && styles.disabledSection} pointerEvents={isGroup ? "none" : "auto"}>
            <Text style={styles.fieldLabel}>투어 종류{isGroup ? " (단독 호핑투어는 티켓 종류와 무관)" : ""}</Text>
            <View style={styles.pillRow}>
              {TOUR_TYPES.map((t) => (
                <Pressable key={t} style={[styles.pill, selectedTour === t && styles.pillActive]} onPress={() => setSelectedTour(t)}>
                  <Text style={[styles.pillText, selectedTour === t && styles.pillTextActive]}>{TOUR_NAMES[t]}</Text>
                </Pressable>
              ))}
            </View>
            {selectedTour === "T" && !isGroup && (
              <Text style={styles.noteRed}>Entrance fee / Environmental Fee / Transportation 포함</Text>
            )}
            {selectedTour !== "T" && (
              <Text style={styles.fixedNote}>픽업/미팅 장소: 메인로드 졸리비 (Jollibee Main Road)</Text>
            )}

            {showMeeting && (
              <>
                <Text style={styles.fieldLabel}>미팅 시간</Text>
                {needsMeetingChoice ? (
                  <View style={styles.pillRow}>
                    {MEETING_TIMES.map((t) => (
                      <Pressable key={t} style={[styles.pill, selectedMeetingTime === t && styles.pillActive]} onPress={() => setSelectedMeetingTime(t)}>
                        <Text style={[styles.pillText, selectedMeetingTime === t && styles.pillTextActive]}>오전 {t}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.fixedNote}>미팅 시간: 오전 07:30 (고정)</Text>
                )}
              </>
            )}
          </View>

          <Text style={styles.fieldLabel}>추가 옵션</Text>
          <View style={styles.pillRow}>
            {["H", "HG", "L"].map((a) => (
              <Pressable key={a} style={[styles.pill, styles.pillCheckbox, selectedAddons.has(a) && styles.pillActive]} onPress={() => toggleAddon(a)}>
                <Text style={[styles.pillText, selectedAddons.has(a) && styles.pillTextActive]}>
                  {selectedAddons.has(a) ? "☑ " : "☐ "}{ADDON_LABEL[a]}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedAddons.size > 0 && (
            <View style={{ marginTop: 10, gap: 10 }}>
              <Text style={styles.fieldLabel}>옵션 날짜</Text>
              <View style={styles.row}>
                {selectedAddons.has("H") && (
                  <DateField label="조인 호핑투어 날짜" value={addonDates.H} onChange={(v) => setAddonDates((p) => ({ ...p, H: v }))} minDate={new Date()} />
                )}
                {selectedAddons.has("L") && (
                  <DateField label="랜드투어 날짜" value={addonDates.L} onChange={(v) => setAddonDates((p) => ({ ...p, L: v }))} minDate={new Date()} />
                )}
                {selectedAddons.has("HG") && (
                  <DateField label="단독 호핑투어 날짜" value={addonDates.HG} onChange={(v) => setAddonDates((p) => ({ ...p, HG: v }))} minDate={new Date()} />
                )}
              </View>
            </View>
          )}

          {isGroup && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.fieldLabel}>GUESTS (단독 호핑투어 그룹 인원 — 티켓 할인 포함가)</Text>
              <View style={styles.pillRow}>
                {GROUP_SIZES.map((size) => (
                  <Pressable key={size} style={[styles.pill, selectedGroupSize === size && styles.pillActive]} onPress={() => setSelectedGroupSize(size)}>
                    <Text style={[styles.pillText, selectedGroupSize === size && styles.pillTextActive]}>{size} pax · {fmtPeso(GROUP_PRICES[size])}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          <View style={isGroup && styles.disabledSection} pointerEvents={isGroup ? "none" : "auto"}>
            <Text style={styles.fieldLabel}>고객 유형{isGroup ? " (단독 호핑투어는 국적과 무관)" : ""}</Text>
            <View style={styles.pillRow}>
              {NATIONALITIES.map((n) => (
                <Pressable key={n.code} style={[styles.pill, selectedNationality === n.code && styles.pillActive]} onPress={() => setSelectedNationality(n.code)}>
                  <Text style={[styles.pillText, selectedNationality === n.code && styles.pillTextActive]}>{n.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ marginTop: 12 }}>
            <DateField label="투어일" value={date} onChange={setDate} minDate={new Date()} />
          </View>

          <View style={[styles.row, { marginTop: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>성인</Text>
              <View style={styles.stepperRow}>
                <Pressable style={styles.stepperBtn} onPress={() => setAdultCount((c) => Math.max(1, c - 1))}><Text style={styles.stepperBtnText}>−</Text></Pressable>
                <Text style={styles.stepperValue}>{adultCount}</Text>
                <Pressable style={styles.stepperBtn} onPress={() => setAdultCount((c) => c + 1)}><Text style={styles.stepperBtnText}>+</Text></Pressable>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>아동</Text>
              <View style={styles.stepperRow}>
                <Pressable style={styles.stepperBtn} onPress={() => setChildCount((c) => Math.max(0, c - 1))}><Text style={styles.stepperBtnText}>−</Text></Pressable>
                <Text style={styles.stepperValue}>{childCount}</Text>
                <Pressable style={styles.stepperBtn} onPress={() => setChildCount((c) => c + 1)}><Text style={styles.stepperBtnText}>+</Text></Pressable>
              </View>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Payment Method</Text>
          <View style={styles.pillRow}>
            <Pressable style={[styles.pill, selectedPay === "deposit" && styles.pillActive]} onPress={() => setSelectedPay("deposit")}>
              <Text style={[styles.pillText, selectedPay === "deposit" && styles.pillTextActive]}>Deposit</Text>
            </Pressable>
            <Pressable style={[styles.pill, selectedPay === "cash_office" && styles.pillActive]} onPress={() => setSelectedPay("cash_office")}>
              <Text style={[styles.pillText, selectedPay === "cash_office" && styles.pillTextActive]}>보라카이션 오피스페이</Text>
            </Pressable>
          </View>

          {breakdown && (
            <View style={styles.breakdownBox}>
              {breakdown.group ? (
                <View style={styles.breakdownRow}>
                  <Text style={styles.breakdownLabel}>{breakdown.label}</Text>
                  <Text style={styles.breakdownNow}>{fmtPeso(breakdown.value)}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.breakdownRow}>
                    <Text style={styles.breakdownLabel}>{breakdown.tourLabel}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      {breakdown.publishedBase > breakdown.netBase && (
                        <Text style={styles.breakdownWas}>{fmtPeso(breakdown.publishedBase)}</Text>
                      )}
                      <Text style={styles.breakdownNow}>{fmtPeso(breakdown.netBase)}</Text>
                    </View>
                  </View>
                  {breakdown.addons.map((a) => (
                    <View key={a} style={styles.breakdownSubRow}>
                      <Text style={styles.breakdownSubText}>+ {ADDON_LABEL[a]} 추가</Text>
                      <Text style={styles.breakdownSubText}>{fmtPeso(ADDON_PRICE[a])}</Text>
                    </View>
                  ))}
                  <View style={[styles.breakdownRow, styles.breakdownTotalRow]}>
                    <Text style={styles.breakdownLabel}>인당 합계 × {breakdown.peopleCount}명</Text>
                    <Text style={styles.breakdownNow}>{fmtPeso(breakdown.perPersonTotal)}</Text>
                  </View>
                </>
              )}
            </View>
          )}

          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>예상 금액</Text>
            <Text style={styles.totalValue}>{fmtPeso(total)}</Text>
          </View>

          {bookingMsg && (
            <Text style={bookingMsg.type === "error" ? styles.errorText : styles.successText}>{bookingMsg.text}</Text>
          )}

          <Pressable style={[styles.bookBtn, submitting && styles.bookBtnDisabled]} onPress={handleBook} disabled={submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.bookBtnText}>예약 확정</Text>}
          </Pressable>
        </View>
      </>
    );
  }

  function renderReservations() {
    const sorted = [...reservations].sort((a, b) => (a.date < b.date ? 1 : -1));
    return (
      <>
        <Text style={styles.title}>예약 목록</Text>
        {sorted.length === 0 ? <Text style={styles.emptyText}>예약 내역이 없습니다.</Text> : sorted.map(bookingRow)}
      </>
    );
  }

  function renderDeposit() {
    return (
      <>
        <Text style={styles.title}>예치금</Text>
        <View style={styles.balanceBox}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>{fmtPeso(agency?.depositBalance)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>입금 신청 (GCash)</Text>
          <Text style={styles.cardDesc}>아래 GCash로 입금 후, 입금하신 날짜와 입금자명을 정확히 기입해 신청해주세요. 관리자가 확인하고 잔액에 반영합니다.</Text>
          <View style={styles.gcashBox}>
            <Image source={require("../../assets/images/gcash-qr.jpg")} style={styles.gcashQr} resizeMode="contain" />
            <Text style={styles.gcashCaption}>GCash: +63 967 466 7943</Text>
          </View>
          <Text style={styles.fieldLabel}>입금액 (PHP)</Text>
          <TextInput style={styles.textInput} keyboardType="number-pad" value={drAmount} onChangeText={setDrAmount} placeholder="0" placeholderTextColor="#94a3b8" />
          <View style={[styles.row, { marginTop: 12 }]}>
            <DateField label="입금 날짜 *" value={drDate} onChange={setDrDate} />
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>입금자 이름 *</Text>
              <TextInput style={styles.textInput} value={drName} onChangeText={setDrName} placeholder="GCash에 뜨는 이름" placeholderTextColor="#94a3b8" />
            </View>
          </View>
          {drMsg && (
            <Text style={drMsg.type === "error" ? styles.errorText : styles.successText}>{drMsg.text}</Text>
          )}
          <Pressable style={[styles.bookBtn, drSubmitting && styles.bookBtnDisabled]} onPress={handleDepositRequest} disabled={drSubmitting}>
            {drSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.bookBtnText}>입금 신청하기</Text>}
          </Pressable>
        </View>
        <Text style={styles.sectionLabel}>신청 내역</Text>
        {depositRequests.length === 0 ? (
          <Text style={styles.emptyText}>신청 내역이 없습니다.</Text>
        ) : (
          depositRequests.map((r) => {
            const statusLabel = { pending: "확인중", approved: "승인됨", rejected: "거절됨" }[r.status] || r.status;
            const statusStyle = { pending: styles.badgePending, approved: styles.badgeUsed, rejected: styles.badgeConfirmed }[r.status] || styles.badgePending;
            return (
              <View key={r.id} style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txNote}>{r.note || "입금 신청"}</Text>
                  <Text style={styles.txDate}>{fmtDate(r.requestedAt)}</Text>
                </View>
                <Text style={[styles.txAmount, styles.txPositive]}>+{fmtPeso(r.amount)}</Text>
                <Text style={[styles.badge, statusStyle]}>{statusLabel}</Text>
              </View>
            );
          })
        )}
      </>
    );
  }

  function renderTransactions() {
    return (
      <>
        <Text style={styles.title}>거래내역</Text>
        {transactions.length === 0 ? (
          <Text style={styles.emptyText}>거래 내역이 없습니다.</Text>
        ) : (
          transactions.map((tx) => (
            <View key={tx.id} style={styles.txRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.txNote}>{tx.type === "topup" ? "입금 반영" : (tx.note || "예약 결제")}</Text>
                <Text style={styles.txDate}>{fmtDate(tx.createdAt)}</Text>
              </View>
              <Text style={[styles.txAmount, tx.amount >= 0 ? styles.txPositive : styles.txNegative]}>
                {tx.amount >= 0 ? "+" : ""}{fmtPeso(tx.amount)}
              </Text>
            </View>
          ))
        )}
      </>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.headerRow}>
        <Text style={styles.headerBrand}>🐋 {agency?.name || "BORACATION B2B"}</Text>
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
        {view === "reservation" && renderReservation()}
        {view === "reservations" && renderReservations()}
        {view === "deposit" && renderDeposit()}
        {view === "transactions" && renderTransactions()}
      </ScrollView>

      <Modal visible={!!qrBooking} transparent animationType="fade" onRequestClose={() => setQrBooking(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setQrBooking(null)}>
          <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
            {qrBooking && (
              <>
                <Text style={styles.modalTitle}>{bookingCode(qrBooking.id)} · {qrBooking.date} · {qrBooking.people}명</Text>
                <View style={styles.qrWrap}><QRCode value={qrBooking.qrToken} size={200} /></View>
                <Pressable style={styles.modalClose} onPress={() => setQrBooking(null)}>
                  <Text style={styles.modalCloseText}>닫기</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  noteRed: { color: "#dc2626", fontFamily: fonts.bodyMedium, fontSize: 11, marginTop: 8, marginBottom: 4 },
  fixedNote: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },

  balanceBox: { backgroundColor: colors.brandBlue, borderRadius: 16, padding: 20, marginBottom: 16 },
  balanceLabel: { color: "rgba(255,255,255,0.75)", fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  balanceValue: { color: colors.white, fontFamily: fonts.headingBlack, fontSize: 28 },

  statsRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: colors.white, borderRadius: 14, padding: 14, alignItems: "center" },
  statValue: { fontFamily: fonts.headingBlack, fontSize: 22, color: colors.heading },
  statLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginTop: 2 },

  ctaRow: { flexDirection: "row", gap: 10, marginBottom: 24 },
  ctaBtn: { flex: 1, backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 12, alignItems: "center" },
  ctaBtnSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.brandBlue },
  ctaBtnText: { color: colors.white, fontFamily: fonts.heading, fontSize: 12 },
  ctaBtnTextSecondary: { color: colors.brandBlue },

  card: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 28, gap: 4 },
  cardTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.heading, marginBottom: 6 },
  cardDesc: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, marginBottom: 14, lineHeight: 18 },
  fieldLabel: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.5, color: colors.brandBlue, marginTop: 12, marginBottom: 6 },
  textInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 14, color: colors.heading, justifyContent: "center",
  },
  dateText: { fontFamily: fonts.body, fontSize: 14, color: colors.heading },
  datePlaceholder: { fontFamily: fonts.body, fontSize: 14, color: "#94a3b8" },
  row: { flexDirection: "row", gap: 12 },
  disabledSection: { opacity: 0.4 },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  pillCheckbox: {},
  pillActive: { backgroundColor: colors.brandBlue, borderColor: colors.brandBlue },
  pillText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.heading },
  pillTextActive: { color: colors.white },

  stepperRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  stepperBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  stepperBtnText: { fontFamily: fonts.heading, fontSize: 16, color: colors.heading },
  stepperValue: { fontFamily: fonts.headingBlack, fontSize: 16, color: colors.heading, minWidth: 20, textAlign: "center" },

  breakdownBox: { backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12, marginTop: 16, gap: 6 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  breakdownTotalRow: { borderTopWidth: 1, borderTopColor: "#cbd5e1", borderStyle: "dashed", paddingTop: 8, marginTop: 2 },
  breakdownLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.heading, flexShrink: 1 },
  breakdownWas: { fontFamily: fonts.body, fontSize: 11, color: "#dc2626", textDecorationLine: "line-through" },
  breakdownNow: { fontFamily: fonts.headingBlack, fontSize: 13, color: colors.heading },
  breakdownSubRow: { flexDirection: "row", justifyContent: "space-between", paddingLeft: 8 },
  breakdownSubText: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },

  totalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 4, alignItems: "center" },
  totalLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  totalValue: { fontFamily: fonts.headingBlack, fontSize: 18, color: colors.heading },
  bookBtn: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 14, alignItems: "center", marginTop: 10 },
  bookBtnDisabled: { opacity: 0.5 },
  bookBtnText: { color: colors.white, fontFamily: fonts.heading, fontSize: 13 },

  gcashBox: { alignItems: "center", backgroundColor: "#F8FAFC", borderRadius: 12, padding: 16, marginBottom: 8 },
  gcashQr: { width: 180, height: 180, marginBottom: 10 },
  gcashCaption: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.heading },

  bookingRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: 12,
    padding: 14, marginBottom: 10,
  },
  bookingCode: { fontFamily: fonts.bodyMedium, fontSize: 10, color: colors.muted, marginBottom: 2 },
  bookingDate: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.heading, marginBottom: 2 },
  bookingSub: { fontFamily: fonts.body, fontSize: 11, color: colors.muted, marginBottom: 4 },
  qrBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  qrBtnText: { fontFamily: fonts.heading, fontSize: 11, color: colors.brandBlue },

  badge: { fontFamily: fonts.heading, fontSize: 9, letterSpacing: 0.5, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 999, textAlign: "center", overflow: "hidden" },
  badgeUsed: { backgroundColor: "#dcfce7", color: "#16a34a" },
  badgePending: { backgroundColor: "#fef3c7", color: "#b45309" },
  badgeConfirmed: { backgroundColor: "#dbeafe", color: "#1d4ed8" },

  txRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.white, borderRadius: 12,
    padding: 14, marginBottom: 10, gap: 10,
  },
  txNote: { fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.heading, marginBottom: 2 },
  txDate: { fontFamily: fonts.body, fontSize: 11, color: colors.muted },
  txAmount: { fontFamily: fonts.headingBlack, fontSize: 14 },
  txPositive: { color: "#16a34a" },
  txNegative: { color: "#dc2626" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(4,16,24,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: colors.white, borderRadius: 20, padding: 24, alignItems: "center" },
  modalTitle: { fontFamily: fonts.heading, fontSize: 15, color: colors.heading, marginBottom: 16 },
  qrWrap: { padding: 12 },
  modalClose: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999, backgroundColor: colors.brandBlue },
  modalCloseText: { color: colors.white, fontFamily: fonts.heading, fontSize: 12 },
});
