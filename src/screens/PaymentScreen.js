import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { PRICES, TOURS } from "../prices";
import { colors, fonts } from "../theme";
import { getExpoPushToken } from "../notifications";
import { sendVoucherEmail } from "../voucherEmail";

const TOUR_LABEL = { PH: "Local (Philippine)", FOREIGN: "Foreigner" };

// Step 2/2 — 앞 화면(BookingScreen)에서 받은 정보를 리뷰하고, 여기서 실제
// 예약 문서를 생성합니다. 지금은 결제수단이 현장지불(보라카이션 오피스페이)
// 하나뿐이라 선택지는 없지만, 리뷰 + 확정을 별도 화면으로 분리해 웹
// 위저드의 "Payment" 단계와 같은 흐름을 유지합니다.
export default function PaymentScreen({ route, navigation }) {
  const {
    tourType, date, people, nationality, meetingTime, pickup, name, email, emergencyContact,
  } = route.params;
  const tour = TOURS.find((t) => t.code === tourType);

  const [submitting, setSubmitting] = useState(false);

  const pricePerPerson = PRICES[nationality]?.[tourType] || 0;
  const totalPrice = pricePerPerson * people;

  async function handleConfirm() {
    setSubmitting(true);
    try {
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
        paymentStatus: "unpaid",
        paymentMethod: "보라카이션 오피스페이",
        createdAt: serverTimestamp(),
        ...(pushToken ? { pushToken } : {}),
      };
      await addDoc(collection(db, "reservations"), reservation);
      sendVoucherEmail(reservation, "en");
      navigation.replace("Confirmation", { name, date, qrToken: null });
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

      <Field label="Payment">
        <Text style={styles.fixedNote}>Pay on-site (Boracation OfficePay) when you arrive on the tour day.</Text>
      </Field>

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
  fixedNote: { fontSize: 14, fontFamily: fonts.body, color: colors.muted },
  totalBox: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border,
    padding: 18, marginBottom: 20, marginTop: 6,
  },
  totalLabel: { fontSize: 12, fontFamily: fonts.heading, color: colors.brandBlue, letterSpacing: 1 },
  totalValue: { fontSize: 22, fontFamily: fonts.headingBlack, color: colors.heading },
  submitBtn: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 14, fontFamily: fonts.heading, letterSpacing: 0.5 },
  backBtn: { paddingVertical: 14, alignItems: "center", marginTop: 4 },
  backBtnText: { color: colors.muted, fontSize: 13, fontFamily: fonts.bodyMedium },
});
