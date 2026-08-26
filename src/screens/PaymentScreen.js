import { useState, useRef } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Image } from "react-native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { PRICES, TOURS } from "../prices";
import { colors, fonts } from "../theme";
import { getExpoPushToken } from "../notifications";
import { sendVoucherEmail } from "../voucherEmail";
import { startQrphPayment, checkQrphStatus } from "../qrph";

const TOUR_LABEL = { PH: "Local (Philippine)", FOREIGN: "Foreigner" };

// reservation.html과 동일한 3가지 결제 방법: QR 결제(PayMongo QRPh, 실제
// 온라인 결제) / On-Site(투어 당일 미팅 장소에서 현금) / Boracaysean
// OfficePay(투어 전 사무실 방문 결제) — 뒤 둘은 둘 다 "미결제 상태로 예약"
// 이지만 장소/시점이 달라서 별도 옵션으로 구분합니다.
const PAYMENT_OPTIONS = [
  { key: "qrph", title: "Pay via QR", desc: "GCash, Maya, or any bank app" },
  { key: "onsite", title: "Pay On-Site", desc: "Cash at the meeting point on tour day" },
  { key: "office", title: "Boracaysean OfficePay", desc: "Visit our office to pay before the tour" },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Step 2/2 — 앞 화면(BookingScreen)에서 받은 정보를 리뷰하고, 결제 방법을
// 고른 뒤 여기서 실제 예약 문서를 생성합니다.
export default function PaymentScreen({ route, navigation }) {
  const {
    tourType, date, people, nationality, meetingTime, pickup, name, email, emergencyContact,
  } = route.params;
  const tour = TOURS.find((t) => t.code === tourType);

  const [paymentChoice, setPaymentChoice] = useState("qrph");
  const [submitting, setSubmitting] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [qrImageUri, setQrImageUri] = useState(null);
  const [qrStatusText, setQrStatusText] = useState("");
  const qrCancelledRef = useRef(false);

  const pricePerPerson = PRICES[nationality]?.[tourType] || 0;
  const totalPrice = pricePerPerson * people;

  async function finalizeReservation(paymentStatus, paymentMethod) {
    // 관리자가 예약을 확정할 때 이 기기로 바로 알림을 보낼 수 있게, 지금
    // 이 기기의 푸시 토큰을 예약 문서에 같이 저장해둡니다. Expo Go거나
    // 권한이 없으면 null이라 그냥 필드가 빠집니다.
    const pushToken = await getExpoPushToken();

    const reservation = {
      tourType,
      date,
      people,
      pickup,
      meetingTime,
      nationality,
      pricePerPerson,
      totalPrice,
      currency: "PHP",
      name,
      email,
      emergencyContact,
      status: "pending",
      paymentStatus,
      paymentMethod,
      createdAt: serverTimestamp(),
      ...(pushToken ? { pushToken } : {}),
    };
    await addDoc(collection(db, "reservations"), reservation);
    sendVoucherEmail(reservation, "en");
    navigation.replace("Confirmation", { name, date, qrToken: null });
  }

  async function runQrphFlow() {
    qrCancelledRef.current = false;
    setQrVisible(true);
    setQrImageUri(null);
    setQrStatusText("Generating QR code...");
    try {
      const { id, imageUrl } = await startQrphPayment(totalPrice, `${tourType} tour - ${date}`);
      if (qrCancelledRef.current) return false;

      setQrImageUri(imageUrl);
      setQrStatusText("Waiting for payment...");

      while (!qrCancelledRef.current) {
        await sleep(3000);
        if (qrCancelledRef.current) break;
        const status = await checkQrphStatus(id);
        if (status === "succeeded") {
          setQrStatusText("Payment received! Confirming reservation...");
          return true;
        }
        if (status === "payment_failed" || status === "cancelled") {
          setQrStatusText("Payment failed or expired. Please try again.");
          return false;
        }
      }
      return false;
    } catch (err) {
      console.error("QRPh flow error:", err);
      setQrStatusText("Could not start QR payment. Please try again or choose a different payment method.");
      return false;
    }
  }

  function cancelQrphFlow() {
    qrCancelledRef.current = true;
    setQrVisible(false);
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      if (paymentChoice === "qrph") {
        const paid = await runQrphFlow();
        setQrVisible(false);
        if (!paid) return; // cancelled, failed, or expired — let them retry
        await finalizeReservation("paid", "QRPh");
      } else if (paymentChoice === "office") {
        await finalizeReservation("unpaid", "보라카이션 오피스페이");
      } else {
        await finalizeReservation("unpaid", "On-Site");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong creating your reservation. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
      <View style={[styles.tourBadge, { backgroundColor: colors.tour[tourType] }]}>
        <Text style={styles.tourBadgeText}>{tour?.name?.toUpperCase()}</Text>
      </View>
      <Text style={styles.title}>Review & Payment</Text>
      <Text style={styles.subtitle}>Check your details before confirming</Text>

      <View style={styles.card}>
        <ReviewRow label="Tour Date" value={date} />
        <ReviewRow label="Number of People" value={String(people)} />
        <ReviewRow label="Nationality" value={TOUR_LABEL[nationality] || nationality} />
        {meetingTime ? <ReviewRow label="Meeting Time" value={`${meetingTime} AM`} /> : null}
        <ReviewRow label="Pickup Location" value={pickup} />
        <ReviewRow label="Full Name" value={name} />
        <ReviewRow label="Email" value={email} />
        {emergencyContact ? <ReviewRow label="Emergency Contact" value={emergencyContact} /> : null}
      </View>

      <Field label="How would you like to pay? *">
        <View style={{ gap: 8 }}>
          {PAYMENT_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.payOption, paymentChoice === opt.key && styles.payOptionActive]}
              onPress={() => setPaymentChoice(opt.key)}
            >
              <Text style={[styles.payOptionTitle, paymentChoice === opt.key && styles.payOptionTitleActive]}>{opt.title}</Text>
              <Text style={styles.payOptionDesc}>{opt.desc}</Text>
            </Pressable>
          ))}
        </View>
      </Field>

      {qrVisible && (
        <View style={styles.gcashBox}>
          {qrImageUri ? (
            <Image source={{ uri: qrImageUri }} style={styles.gcashQr} resizeMode="contain" />
          ) : (
            <ActivityIndicator color={colors.brandBlue} style={{ marginBottom: 10 }} />
          )}
          <Text style={styles.gcashCaption}>{qrStatusText}</Text>
          <Pressable style={styles.qrCancelBtn} onPress={cancelQrphFlow}>
            <Text style={styles.qrCancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.totalBox}>
        <Text style={styles.totalLabel}>TOTAL</Text>
        <Text style={styles.totalValue}>₱{totalPrice.toLocaleString()}</Text>
      </View>

      <Pressable style={[styles.submitBtn, submitting && styles.submitBtnDisabled]} onPress={handleConfirm} disabled={submitting}>
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>CONFIRM RESERVATION</Text>}
      </Pressable>
      <Pressable style={styles.backBtn} onPress={() => navigation.goBack()} disabled={submitting}>
        <Text style={styles.backBtnText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function ReviewRow({ label, value }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tourBadge: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 16, marginBottom: 10 },
  tourBadgeText: { color: colors.white, fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.5 },
  title: { fontSize: 24, fontFamily: fonts.headingBlack, color: colors.heading },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 20 },
  label: {
    fontSize: 11, fontFamily: fonts.heading, color: colors.brandBlue,
    letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8,
  },
  card: {
    backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 18, marginBottom: 20, gap: 12,
  },
  reviewRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  reviewLabel: { fontSize: 12, fontFamily: fonts.body, color: colors.muted, flexShrink: 0 },
  reviewValue: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.heading, flexShrink: 1, textAlign: "right" },
  payOption: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
  },
  payOptionActive: { borderColor: colors.brandBlue, backgroundColor: "rgba(28,82,158,0.06)" },
  payOptionTitle: { fontSize: 14, fontFamily: fonts.bodyMedium, color: colors.heading, marginBottom: 2 },
  payOptionTitleActive: { color: colors.brandBlue },
  payOptionDesc: { fontSize: 12, fontFamily: fonts.body, color: colors.muted },
  gcashBox: { alignItems: "center", backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 18, marginTop: 14 },
  gcashQr: { width: 180, height: 180, marginBottom: 10 },
  gcashCaption: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.heading, textAlign: "center" },
  qrCancelBtn: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  qrCancelBtnText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.muted },
  totalBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 18, marginBottom: 20, marginTop: 14,
  },
  totalLabel: { fontSize: 12, fontFamily: fonts.heading, color: colors.brandBlue, letterSpacing: 1 },
  totalValue: { fontSize: 22, fontFamily: fonts.headingBlack, color: colors.heading },
  submitBtn: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 14, fontFamily: fonts.heading, letterSpacing: 0.5 },
  backBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  backBtnText: { color: colors.muted, fontSize: 13, fontFamily: fonts.bodyMedium },
});
