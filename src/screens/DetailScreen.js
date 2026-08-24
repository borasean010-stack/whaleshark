import { View, Text, StyleSheet, ScrollView, Pressable, Image, Dimensions } from "react-native";
import { TOURS, PRICES } from "../prices";
import { DETAILS } from "../details";
import { colors, fonts } from "../theme";

// 웹사이트 .detail-hero(min-height:52vh, object-fit:cover)와 같은 비율을
// aspectRatio가 아니라 화면 높이 기준 실제 px로 계산합니다 — 카드/배너에서도
// aspectRatio만 믿었다가 이미지가 과도하게 커지는 문제가 있었습니다.
const DETAIL_HERO_HEIGHT = Dimensions.get("window").height * 0.52;

export default function DetailScreen({ route, navigation }) {
  const { tourType } = route.params;
  const tour = TOURS.find((t) => t.code === tourType);
  const detail = DETAILS[tourType];
  const accent = colors.tour[tourType];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.hero}>
        <Image source={tour.image} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <View style={[styles.tag, { backgroundColor: accent }]}>
            <Text style={styles.tagText}>{tour.tag}</Text>
          </View>
          <Text style={styles.heroTitle}>{tour.name}</Text>
        </View>
      </View>

      <View style={styles.body}>
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
  hero: { height: DETAIL_HERO_HEIGHT, backgroundColor: colors.navy, justifyContent: "flex-end", overflow: "hidden" },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    // 세로 그라디언트 대신 단색 반투명 오버레이 — RN 기본 View는 CSS
    // linear-gradient를 지원하지 않아 site와 완전히 같은 그라디언트는
    // expo-linear-gradient가 필요합니다. 우선 톤을 맞추는 단색으로 처리.
    backgroundColor: "rgba(5,10,14,0.55)",
  },
  heroContent: { padding: 24 },
  tag: { alignSelf: "flex-start", borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, marginBottom: 12 },
  tagText: { color: colors.white, fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.5 },
  heroTitle: { fontFamily: fonts.headingBlack, fontSize: 30, color: colors.white, lineHeight: 34 },
  body: { padding: 20 },
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
