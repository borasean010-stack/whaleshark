import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { TOURS, PRICES } from "../prices";
import { DETAILS } from "../details";
import { colors, fonts } from "../theme";

export default function DetailScreen({ route, navigation }) {
  const { tourType } = route.params;
  const tour = TOURS.find((t) => t.code === tourType);
  const detail = DETAILS[tourType];
  const accent = colors.tour[tourType];

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      <View style={styles.body}>
        <View style={[styles.tag, { backgroundColor: accent, alignSelf: "flex-start" }]}>
          <Text style={styles.tagText}>{tour.tag}</Text>
        </View>
        <Text style={styles.heroTitle}>{tour.name}</Text>

        <Text style={[styles.sectionLabel, { color: accent }]}>BEST FOR</Text>
        <Text style={styles.paragraph}>{detail.bestFor}</Text>

        <Text style={[styles.sectionLabel, { color: accent }]}>WHAT'S INCLUDED</Text>
        <View style={styles.inclusionList}>
          {detail.inclusions.map((inc) => (
            <View key={inc.label} style={styles.inclusionRow}>
              <View style={[styles.inclusionCheck, { backgroundColor: accent }]}>
                <Text style={styles.inclusionCheckMark}>✓</Text>
              </View>
              <Text style={styles.inclusionLabel}>{inc.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.priceBox}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Local (Philippine)</Text>
            <Text style={styles.priceValue}>₱{PRICES.PH[tourType].toLocaleString()}</Text>
          </View>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Foreigner</Text>
            <Text style={styles.priceValue}>₱{PRICES.FOREIGN[tourType].toLocaleString()}</Text>
          </View>
        </View>

        <Pressable style={[styles.bookBtn, { backgroundColor: accent }]} onPress={() => navigation.navigate("Booking", { tourType })}>
          <Text style={styles.bookBtnText}>BOOK NOW</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  tag: { borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 10 },
  tagText: { color: colors.white, fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.5 },
  heroTitle: { fontFamily: fonts.headingBlack, fontSize: 24, color: colors.heading, lineHeight: 28, marginBottom: 4 },
  body: { padding: 20, paddingTop: 24 },
  sectionLabel: { fontFamily: fonts.heading, fontSize: 12, letterSpacing: 1.5, marginBottom: 8, marginTop: 8 },
  paragraph: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, color: colors.heading, opacity: 0.8, marginBottom: 20 },
  inclusionList: { gap: 12, marginBottom: 24 },
  inclusionRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.white, borderRadius: 12, padding: 12 },
  inclusionCheck: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  inclusionCheckMark: { color: colors.white, fontSize: 12, fontFamily: fonts.heading },
  inclusionLabel: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13, color: colors.heading },
  priceBox: { backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 20, gap: 10 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.muted },
  priceValue: { fontFamily: fonts.headingBlack, fontSize: 18, color: colors.heading },
  bookBtn: { borderRadius: 999, paddingVertical: 16, alignItems: "center" },
  bookBtnText: { color: colors.white, fontFamily: fonts.heading, fontSize: 14, letterSpacing: 0.5 },
});
