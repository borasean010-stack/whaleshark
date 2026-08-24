import { View, Text, StyleSheet, Pressable } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { colors, fonts } from "../theme";

export default function ConfirmationScreen({ route, navigation }) {
  const { name, date, qrToken } = route.params;
  return (
    <View style={styles.container}>
      <View style={styles.checkCircle}>
        <Text style={styles.check}>✓</Text>
      </View>
      <Text style={styles.title}>Reservation Confirmed</Text>
      <Text style={styles.body}>Thanks, {name}! Your whale shark tour on {date} is booked.</Text>

      {qrToken ? (
        <View style={styles.qrBox}>
          <Text style={styles.qrLabel}>YOUR ENTRY TICKET</Text>
          <View style={styles.qrCard}>
            <QRCode value={qrToken} size={180} />
          </View>
          <Text style={styles.qrNote}>Show this QR at Libertad to check in — screenshot it now.</Text>
        </View>
      ) : (
        <Text style={styles.note}>A confirmation email with your voucher is on its way.</Text>
      )}

      <Pressable style={styles.btn} onPress={() => navigation.popToTop()}>
        <Text style={styles.btnText}>BACK TO HOME</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.bg },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.tour.T,
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  check: { fontSize: 32, color: colors.white, fontFamily: fonts.headingBlack },
  title: { fontSize: 22, fontFamily: fonts.headingBlack, color: colors.heading, marginBottom: 12 },
  body: { fontSize: 15, fontFamily: fonts.body, color: colors.heading, textAlign: "center", marginBottom: 8 },
  note: { fontSize: 13, fontFamily: fonts.body, color: colors.muted, textAlign: "center", marginBottom: 32 },
  qrBox: { alignItems: "center", marginTop: 12, marginBottom: 28 },
  qrLabel: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.5, color: colors.brandBlue, marginBottom: 12 },
  qrCard: { backgroundColor: colors.white, padding: 16, borderRadius: 16, shadowColor: colors.brandBlue, shadowOpacity: 0.15, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  qrNote: { fontFamily: fonts.body, fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 12, maxWidth: 260 },
  btn: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 32 },
  btnText: { color: colors.white, fontFamily: fonts.heading, fontSize: 13, letterSpacing: 0.5 },
});
