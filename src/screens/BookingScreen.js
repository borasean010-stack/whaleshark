import { useState, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable, Platform, Modal, KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { TOURS } from "../prices";
import { colors, fonts } from "../theme";

const MEETING_TIMES = ["07:30", "09:00"];

// 웹 reservation.html과 동일하게, 픽업/미팅 장소는 선택지 없이 고정입니다.
const PICKUP_LOCATION = "Jollibee Main Road";

// Step 1/2 — 투어 정보/예약자 정보 입력. 다음 단계(Payment 화면)에서
// 리뷰 + 결제 확인 + 실제 예약 생성을 처리합니다 (reservation.html의
// 위저드처럼 정보 입력과 결제 확인을 분리).
export default function BookingScreen({ route, navigation }) {
  const { tourType, initialDate, initialPeople, initialNationality } = route.params;
  const tour = TOURS.find((t) => t.code === tourType);

  const [nationality, setNationality] = useState(initialNationality || "FOREIGN");
  const [date, setDate] = useState(initialDate || "");
  const [people, setPeople] = useState(initialPeople || "1");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [meetingTime, setMeetingTime] = useState(tourType === "F" || tourType === "VF" ? "07:30" : MEETING_TIMES[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  function onPickDateAndroid(event, selectedDate) {
    setShowDatePicker(false);
    if (event.type !== "dismissed" && selectedDate) {
      setDate(selectedDate.toISOString().slice(0, 10));
    }
  }

  function onPickDateIOS(event, selectedDate) {
    if (selectedDate) setDate(selectedDate.toISOString().slice(0, 10));
  }

  const needsMeetingChoice = tourType === "R";
  const showMeeting = tourType === "R" || tourType === "F" || tourType === "VF";

  const peopleNum = Number(people) || 0;

  const canContinue = useMemo(
    () => date.trim() && peopleNum > 0 && name.trim() && email.trim(),
    [date, peopleNum, name, email]
  );

  function handleNext() {
    navigation.navigate("Payment", {
      tourType,
      date: date.trim(),
      people: peopleNum,
      nationality,
      meetingTime: showMeeting ? meetingTime : "",
      pickup: PICKUP_LOCATION,
      name: name.trim(),
      email: email.trim(),
      emergencyContact: emergencyContact.trim(),
    });
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
      <View style={[styles.tourBadge, { backgroundColor: colors.tour[tourType] }]}>
        <Text style={styles.tourBadgeText}>{tour?.name?.toUpperCase()}</Text>
      </View>
      <Text style={styles.title}>Book Your Tour</Text>
      <Text style={styles.subtitle}>Fill in your details below</Text>

      <Field label="Nationality">
        <View style={styles.row}>
          {["PH", "FOREIGN"].map((n) => (
            <Pressable key={n} style={[styles.pill, nationality === n && styles.pillActive]} onPress={() => setNationality(n)}>
              <Text style={[styles.pillText, nationality === n && styles.pillTextActive]}>
                {n === "PH" ? "Local (Philippine)" : "Foreigner"}
              </Text>
            </Pressable>
          ))}
        </View>
      </Field>

      <Field label="Tour Date *">
        <Pressable style={styles.input} onPress={() => setShowDatePicker(true)}>
          <Text style={date ? styles.inputText : styles.inputPlaceholder}>{date || "Select date"}</Text>
        </Pressable>
        {Platform.OS === "android" && showDatePicker && (
          <DateTimePicker
            value={date ? new Date(date) : new Date()}
            mode="date"
            minimumDate={new Date()}
            onChange={onPickDateAndroid}
          />
        )}
        {Platform.OS === "ios" && (
          <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
            <Pressable style={styles.modalBackdrop} onPress={() => setShowDatePicker(false)}>
              <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
                <DateTimePicker
                  value={date ? new Date(date) : new Date()}
                  mode="date"
                  display="inline"
                  themeVariant="light"
                  minimumDate={new Date()}
                  onChange={onPickDateIOS}
                />
                <Pressable style={styles.modalClose} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.modalCloseText}>확인</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </Field>
      <Field label="Number of People *"><TextInput style={styles.input} keyboardType="number-pad" value={people} onChangeText={setPeople} /></Field>

      {showMeeting && (
        <Field label="Meeting Time">
          {needsMeetingChoice ? (
            <View style={styles.row}>
              {MEETING_TIMES.map((t) => (
                <Pressable key={t} style={[styles.pill, meetingTime === t && styles.pillActive]} onPress={() => setMeetingTime(t)}>
                  <Text style={[styles.pillText, meetingTime === t && styles.pillTextActive]}>{t} AM</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.fixedNote}>07:30 AM (fixed)</Text>
          )}
          <Text style={[styles.fixedNote, { marginTop: 8 }]}>Meeting Point: {PICKUP_LOCATION}, Boracay</Text>
        </Field>
      )}

      <Field label="Pickup Location">
        <View style={styles.input}><Text style={styles.inputText}>{PICKUP_LOCATION}</Text></View>
      </Field>
      <Field label="Full Name *"><TextInput style={styles.input} value={name} onChangeText={setName} /></Field>
      <Field label="Email *"><TextInput style={styles.input} keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} /></Field>
      <Field label="Emergency Contact"><TextInput style={styles.input} value={emergencyContact} onChangeText={setEmergencyContact} /></Field>

      <Pressable style={[styles.submitBtn, !canContinue && styles.submitBtnDisabled]} onPress={handleNext} disabled={!canContinue}>
        <Text style={styles.submitBtnText}>NEXT: REVIEW & PAY</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tourBadge: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginTop: 16, marginBottom: 10 },
  tourBadgeText: { color: colors.white, fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.5 },
  title: { fontSize: 24, fontFamily: fonts.headingBlack, color: colors.heading },
  subtitle: { fontSize: 14, fontFamily: fonts.body, color: colors.muted, marginBottom: 24 },
  label: {
    fontSize: 11, fontFamily: fonts.heading, color: colors.brandBlue,
    letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 8,
  },
  input: {
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: fonts.body, color: colors.heading,
    justifyContent: "center", minHeight: 46,
  },
  inputText: { fontSize: 15, fontFamily: fonts.body, color: colors.heading },
  inputPlaceholder: { fontSize: 15, fontFamily: fonts.body, color: "#94a3b8" },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pill: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  pillActive: { backgroundColor: colors.brandBlue, borderColor: colors.brandBlue },
  pillText: { fontSize: 13, fontFamily: fonts.bodyMedium, color: colors.heading },
  pillTextActive: { color: colors.white },
  fixedNote: { fontSize: 14, fontFamily: fonts.body, color: colors.muted },
  submitBtn: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.white, fontSize: 14, fontFamily: fonts.heading, letterSpacing: 0.5 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(4,16,24,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalBox: { backgroundColor: colors.white, borderRadius: 20, padding: 20, alignItems: "center" },
  modalClose: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 999, backgroundColor: colors.brandBlue },
  modalCloseText: { color: colors.white, fontFamily: fonts.heading, fontSize: 12 },
});
