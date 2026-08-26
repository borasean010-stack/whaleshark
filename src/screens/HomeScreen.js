import { useRef, useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Linking, Dimensions, Platform, TextInput } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import YoutubePlayer from "react-native-youtube-iframe";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { TOURS, PRICES } from "../prices";
import { colors, fonts } from "../theme";
import MenuDrawer from "../components/MenuDrawer";

// admin이 settings/tourStatus 문서를 바꾸면 앱 홈 화면에 바로 반영되는
// "오늘 운영 여부" 배너. 상태값이 없거나 모르는 값이면 기본적으로 정상
// 운영으로 취급합니다 — 배너가 잘못된 이유로 "취소"처럼 보이면 안 되니까요.
const STATUS_STYLES = {
  operating: { tint: "#16a34a", soft: "rgba(22,163,74,0.12)", icon: "🐋", label: "TODAY — OPERATING", fallback: "Today's tour is operating as scheduled." },
  delayed: { tint: "#d97706", soft: "rgba(217,119,6,0.12)", icon: "⚠️", label: "TODAY — SCHEDULE MAY CHANGE", fallback: "Today's tour schedule may be affected." },
  cancelled: { tint: "#dc2626", soft: "rgba(220,38,38,0.12)", icon: "⛔", label: "TODAY — CANCELLED", fallback: "Today's tour is cancelled." },
};

// aspectRatio 스타일만 믿지 않고 실제 화면 너비 기준으로 높이를 직접
// 계산합니다 — 배너가 의도보다 훨씬 크게 보인다는 피드백이 있어, 크기를
// 명확한 숫자(px)로 못박아 둡니다.
const SCREEN_WIDTH = Dimensions.get("window").width;
const CONTENT_WIDTH = SCREEN_WIDTH - 40; // section의 좌우 padding 20px씩
const ABOUT_BANNER_HEIGHT = 180; // 웹사이트는 320~520px(뷰포트 기준)이지만, 앱 화면에서는 그 비율 그대로면 과도하게 커서 축소

// 공식 판매처 섹션 — 웹사이트는 모바일에서도(<760px) 세로로 쌓지 않고
// 배너(66%) + 관광청 로고(나머지)를 가로로 나란히 둡니다. 두 카드는 같은
// 높이를 공유하도록 배너의 실제 비율(1774:887)로 높이를 계산합니다.
const OFFICIAL_GAP = 12;
const OFFICIAL_BANNER_WIDTH = (CONTENT_WIDTH - OFFICIAL_GAP) * 0.66;
const OFFICIAL_LOGO_WIDTH = CONTENT_WIDTH - OFFICIAL_GAP - OFFICIAL_BANNER_WIDTH;
const OFFICIAL_ROW_HEIGHT = OFFICIAL_BANNER_WIDTH * (887 / 1774);

const HERO_VIDEO_ID = "GnC-jWDaqgY";
// 화면 너비 기준으로 16:9 높이를 계산해서, 히어로 영역을 꽉 채우도록 확대해
// 둡니다 (실제 플레이어는 이 높이를 기준으로 렌더링되고, 밖으로 넘치는 부분은
// 부모의 overflow:hidden으로 잘려서 웹사이트의 배경 영상 느낌을 냅니다).
const HERO_VIDEO_HEIGHT = (Dimensions.get("window").width * 9) / 16;

const TRUST_ITEMS = [
  { icon: "🌊", label: "Operated Locally in Libertad" },
  { icon: "👨‍👩‍👧", label: "Family Friendly" },
  { icon: "🐋", label: "See it. Respect it." },
  { icon: "💳", label: "Easy Online Booking" },
];

const SHARK_STATS = [
  { num: "20M", label: "Max Length (65 ft)" },
  { num: "30T", label: "Max Weight" },
  { num: "0%", label: "Danger to Humans" },
  { num: "1 of 1", label: "Unique Spot Pattern" },
];

const INFO_ITEMS = [
  "A representative will contact you within 1 business day after booking.",
  "Schedules may change depending on weather conditions.",
  "Same-day cancellations are non-refundable.",
];

const DOS = [
  "Listen carefully to your guides and boat crew at all times.",
  "Wear your life jacket and snorkeling gear properly.",
  "Keep 5m from the whale shark's head, 6m from its body/tail.",
  "Observe quietly and respectfully — let them swim freely.",
];

const DONTS = [
  "Don't touch, ride, chase, or block a whale shark.",
  "Don't feed them or throw food/trash into the sea.",
  "No flash photography or bright lights underwater.",
  "Don't enter the water without your guide's permission.",
];

// index.html의 "Moments from the Water" 섹션과 같은 유튜브 영상들.
const FB_VIDEOS = ["38XKiXpHcJs", "pg3YY3XJDI4", "fcHfrmR25NI", "_noTU4PI-Ss", "CgfHdMA2VAk"];
const CONSERVATION_VIDEO_ID = "voKLallVr84";

const PARTNER_LOGOS = [
  require("../../assets/images/partners/1.png"),
  require("../../assets/images/partners/2.png"),
  require("../../assets/images/partners/3.png"),
  require("../../assets/images/partners/4.png"),
  require("../../assets/images/partners/5.png"),
  require("../../assets/images/partners/6.png"),
  require("../../assets/images/partners/7.png"),
  require("../../assets/images/partners/8.png"),
];

export default function HomeScreen({ navigation }) {
  const scrollRef = useRef(null);
  const toursY = useRef(0);
  const [qsTour, setQsTour] = useState("VF");
  const [qsDate, setQsDate] = useState("");
  const [qsPeople, setQsPeople] = useState("2");
  const [qsNationality, setQsNationality] = useState("PH");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tourStatus, setTourStatus] = useState(null);

  useEffect(() => {
    return onSnapshot(doc(db, "settings", "tourStatus"), (snap) => {
      setTourStatus(snap.exists() ? snap.data() : null);
    }, () => {});
  }, []);

  function onPickDate(event, selectedDate) {
    setShowDatePicker(Platform.OS === "ios");
    if (selectedDate) {
      setQsDate(selectedDate.toISOString().slice(0, 10));
    }
  }

  function scrollToTours() {
    scrollRef.current?.scrollTo({ y: toursY.current, animated: true });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.hero}>
          <Image source={require("../../assets/images/hero-bg.jpg")} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          <View style={[StyleSheet.absoluteFillObject, styles.heroVideoWrap]} pointerEvents="none">
            <YoutubePlayer
              height={HERO_VIDEO_HEIGHT}
              width={SCREEN_WIDTH}
              play
              mute
              videoId={HERO_VIDEO_ID}
              webViewStyle={{ backgroundColor: "transparent" }}
              initialPlayerParams={{ controls: false, modestbranding: true, rel: false, loop: true, playlist: HERO_VIDEO_ID }}
            />
          </View>
          <View style={styles.heroOverlay} pointerEvents="none" />
          <View style={styles.heroContent} pointerEvents="none">
            <Text style={styles.heroTitle}>BORACAY{"\n"}WHALE SHARK.</Text>
            <Text style={styles.heroSubtitle}>
              Operated locally in Antique Libertad. Experience the magic of swimming
              with whale sharks in the deep blue sea.
            </Text>
          </View>
        </View>

        {/* TODAY'S TOUR STATUS — admin.html/앱 Admin 화면에서 관리자가 바꾸면
            바로 반영되는 오늘 운영 여부. 히어로 하단에 살짝 겹치는 카드형. */}
        {tourStatus && (() => {
          const st = STATUS_STYLES[tourStatus.status] || STATUS_STYLES.operating;
          return (
            <View style={styles.statusCardWrap}>
              <View style={styles.statusCard}>
                <View style={[styles.statusIconBadge, { backgroundColor: st.soft }]}>
                  <Text style={styles.statusIconText}>{st.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.statusLabel, { color: st.tint }]}>{st.label}</Text>
                  <Text style={styles.statusMessage} numberOfLines={2}>
                    {tourStatus.message || st.fallback}
                  </Text>
                </View>
              </View>
            </View>
          );
        })()}

        {/* TRUST BAR */}
        <View style={styles.trustBar}>
          {TRUST_ITEMS.map((t) => (
            <View key={t.label} style={styles.trustItem}>
              <Text style={styles.trustIcon}>{t.icon}</Text>
              <Text style={styles.trustLabel}>{t.label}</Text>
            </View>
          ))}
        </View>

        {/* OFFICIAL SALES POINT — 웹사이트처럼 배너 + 관광청 로고 가로 배치 */}
        <View style={styles.officialSection}>
          <Image source={require("../../assets/images/mwbaneren.jpg")} style={styles.officialBanner} resizeMode="cover" />
          <View style={styles.officialLogoCard}>
            <Image source={require("../../assets/images/dot-k-logo.png")} style={styles.officialLogo} resizeMode="contain" />
          </View>
        </View>

        {/* ONLINE BOOKING — 웹사이트 quick-search 위젯과 같은 필드 구성 */}
        <View style={styles.sectionEyebrowWrap}>
          <Text style={styles.sectionEyebrow}>ONLINE BOOKING</Text>
          <Text style={styles.sectionTitle}>Book Your Whale Shark Experience</Text>
        </View>
        <View style={styles.qsForm}>
          <View style={styles.qsField}>
            <Text style={styles.qsLabel}>PACKAGE</Text>
            <View style={styles.qsPillCol}>
              {TOURS.map((t) => (
                <Pressable
                  key={t.code}
                  style={[styles.qsPill, styles.qsPillFull, qsTour === t.code && styles.qsPillActive]}
                  onPress={() => setQsTour(t.code)}
                >
                  <Text style={[styles.qsPillText, qsTour === t.code && styles.qsPillTextActive]}>{t.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.qsRow}>
            <View style={[styles.qsField, { flex: 1 }]}>
              <Text style={styles.qsLabel}>DATE</Text>
              <Pressable style={styles.qsInput} onPress={() => setShowDatePicker(true)}>
                <Text style={qsDate ? styles.qsInputText : styles.qsInputPlaceholder}>
                  {qsDate || "Select date"}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={qsDate ? new Date(qsDate) : new Date()}
                  mode="date"
                  minimumDate={new Date()}
                  onChange={onPickDate}
                />
              )}
            </View>
            <View style={[styles.qsField, { width: 90 }]}>
              <Text style={styles.qsLabel}>GUESTS</Text>
              <TextInput style={styles.qsInput} keyboardType="number-pad" value={qsPeople} onChangeText={setQsPeople} />
            </View>
          </View>
          <View style={styles.qsField}>
            <Text style={styles.qsLabel}>NATIONALITY</Text>
            <View style={styles.qsPillRow}>
              {[["PH", "Philippine"], ["FOREIGN", "Foreigner"]].map(([code, label]) => (
                <Pressable
                  key={code}
                  style={[styles.qsPill, qsNationality === code && styles.qsPillActive]}
                  onPress={() => setQsNationality(code)}
                >
                  <Text style={[styles.qsPillText, qsNationality === code && styles.qsPillTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable
            style={styles.qsSubmit}
            onPress={() => navigation.navigate("Booking", {
              tourType: qsTour, initialDate: qsDate, initialPeople: qsPeople, initialNationality: qsNationality,
            })}
          >
            <Text style={styles.qsSubmitText}>SEARCH</Text>
          </Pressable>
        </View>

        {/* TOUR PACKAGES — 2열 */}
        <View onLayout={(e) => { toursY.current = e.nativeEvent.layout.y; }}>
          <View style={styles.sectionEyebrowWrap}>
            <Text style={styles.sectionEyebrow}>CHOOSE YOUR EXPERIENCE</Text>
            <Text style={styles.sectionTitle}>Tour Packages</Text>
          </View>

          <View style={styles.grid}>
            {TOURS.map((tour) => (
              <Pressable
                key={tour.code}
                style={[styles.card, { borderTopColor: colors.tour[tour.code] }]}
                onPress={() => navigation.navigate("Detail", { tourType: tour.code })}
              >
                <View style={styles.cardImgWrap}>
                  <Image source={tour.image} style={styles.cardImg} resizeMode="cover" />
                  <View style={[styles.tag, { backgroundColor: colors.tour[tour.code] }]}>
                    <Text style={styles.tagText} numberOfLines={1}>{tour.tag}</Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                  <View>
                    <Text style={styles.cardTitle}>{tour.name}</Text>
                    <Text style={styles.cardDesc} numberOfLines={2}>{tour.desc}</Text>
                    <Text style={styles.priceValue}>₱{PRICES.PH[tour.code].toLocaleString()}</Text>
                    <Text style={styles.priceLabel}>local / person</Text>
                  </View>
                  <View>
                    <Pressable
                      style={styles.cardLink}
                      onPress={() => navigation.navigate("Detail", { tourType: tour.code })}
                    >
                      <Text style={styles.cardLinkText}>VIEW DETAILS</Text>
                    </Pressable>
                    <Pressable
                      style={styles.cardCta}
                      onPress={() => navigation.navigate("Booking", { tourType: tour.code })}
                    >
                      <Text style={styles.cardCtaText}>BOOK NOW</Text>
                    </Pressable>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* FACEBOOK VIDEO GALLERY */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleLeft}>Moments from the Water</Text>
          <Text style={styles.paragraph}>Real videos from Libertad Whale Shark facebook page</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.fbRow}>
          {FB_VIDEOS.map((id, i) => (
            <Pressable
              key={id}
              style={styles.fbCard}
              onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${id}`)}
            >
              <Image source={{ uri: `https://img.youtube.com/vi/${id}/hqdefault.jpg` }} style={styles.fbThumb} resizeMode="cover" />
              <View style={styles.fbPlayBadge}><Text style={styles.fbPlayIcon}>▶</Text></View>
            </Pressable>
          ))}
        </ScrollView>

        {/* ABOUT THE WHALE SHARK */}
        <View style={styles.section}>
          <Image source={require("../../assets/images/baneren.jpg")} style={styles.aboutBanner} resizeMode="cover" />
          <Text style={styles.sectionEyebrowLeft}>SEE IT. RESPECT IT. PROTECT IT.</Text>
          <Text style={styles.sectionTitleLeft}>About the Whale Shark</Text>
          <Text style={styles.paragraph}>
            The Libertad Whale Shark Experience, in Libertad, Antique — a short trip from
            Boracay — lets you observe the world's largest fish in its natural habitat
            through responsible, sustainable marine tourism.
          </Text>
          <View style={styles.statsGrid}>
            {SHARK_STATS.map((s) => (
              <View key={s.label} style={styles.statTile}>
                <Text style={styles.statNum}>{s.num}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.paragraph}>
            Whale sharks are gentle, filter-feeding giants — completely harmless to
            humans. No two share the same spot pattern, as unique as a fingerprint,
            which scientists use to identify individuals across their migrations.
          </Text>
        </View>

        {/* CONSERVATION MATTERS */}
        <View style={styles.section}>
          <Pressable
            style={styles.conservationThumb}
            onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${CONSERVATION_VIDEO_ID}`)}
          >
            <Image
              source={{ uri: `https://img.youtube.com/vi/${CONSERVATION_VIDEO_ID}/hqdefault.jpg` }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
            <View style={styles.fbPlayBadge}><Text style={styles.fbPlayIcon}>▶</Text></View>
          </Pressable>
          <View style={[styles.tag, { backgroundColor: "#ef4444", alignSelf: "center", marginTop: 16 }]}>
            <Text style={styles.tagText}>VULNERABLE SPECIES</Text>
          </View>
          <Text style={styles.sectionTitleLeft}>Conservation Matters</Text>
          <Text style={styles.paragraph}>
            Whale sharks are classified Vulnerable due to fishing bycatch, vessel
            strikes, pollution, and habitat loss. At Libertad, conservation comes
            first — strict guidelines, respect for wildlife, and minimal impact on
            every encounter. Sightings are never guaranteed, which makes each one a
            genuine privilege.
          </Text>
        </View>

        {/* GUEST RULES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleLeft}>Safety &amp; Rules</Text>
          <Text style={styles.paragraph}>Protecting gentle giants is the top priority.</Text>
          <View style={styles.rulesCard}>
            <Text style={[styles.rulesTitle, { color: colors.tour.T }]}>DO'S</Text>
            {DOS.map((d) => <Text key={d} style={styles.ruleLine}>• {d}</Text>)}
          </View>
          <View style={styles.rulesCard}>
            <Text style={[styles.rulesTitle, { color: "#ef4444" }]}>DON'TS</Text>
            {DONTS.map((d) => <Text key={d} style={styles.ruleLine}>• {d}</Text>)}
          </View>
        </View>

        {/* PARTNERS */}
        <View style={styles.sectionEyebrowWrap}>
          <Text style={styles.sectionEyebrow}>TRUSTED BY &amp; IN PARTNERSHIP WITH</Text>
        </View>
        <View style={styles.partnersGrid}>
          {PARTNER_LOGOS.map((src, i) => (
            <View key={i} style={styles.partnerCard}>
              <Image source={src} style={styles.partnerLogo} resizeMode="contain" />
            </View>
          ))}
        </View>

        {/* INFO */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleLeft}>Things to Know Before Booking</Text>
          {INFO_ITEMS.map((info, i) => (
            <View key={info} style={styles.infoRow}>
              <Text style={styles.infoNum}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={styles.infoText}>{info}</Text>
            </View>
          ))}
        </View>

        {/* FOOTER / CONTACT */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>BORACAY WHALE SHARK</Text>
          <Text style={styles.footerLine}>Boracay Official Designated Ticket Office</Text>
          <Text style={styles.footerLine}>G/F, Henann Lagoon, Brgy. Balabag, Boracay Island, Malay, Philippines</Text>
          <Pressable onPress={() => Linking.openURL("tel:+639674667943")}>
            <Text style={[styles.footerLine, styles.footerLink]}>GLOBE: 09674667943</Text>
          </Pressable>
          <Text style={styles.footerLine}>Libertad, Antique, Philippines</Text>
        </View>
      </ScrollView>

      <MenuDrawer navigation={navigation} onNavigateTours={scrollToTours} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { height: 380, backgroundColor: colors.navy, justifyContent: "center", paddingTop: 40, overflow: "hidden" },
  heroVideoWrap: { alignItems: "center", justifyContent: "center" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(4,16,24,0.55)" },
  heroContent: { paddingHorizontal: 24 },
  heroTitle: { color: colors.white, fontFamily: fonts.headingBlack, fontSize: 40, lineHeight: 44, marginBottom: 16 },
  heroSubtitle: { color: "rgba(255,255,255,0.85)", fontFamily: fonts.body, fontSize: 14, lineHeight: 20, maxWidth: 320 },
  statusCardWrap: { paddingHorizontal: 20, marginTop: -28, marginBottom: 8, zIndex: 5 },
  statusCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: colors.white, borderRadius: 18, padding: 14,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  statusIconBadge: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statusIconText: { fontSize: 18 },
  statusLabel: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.8, marginBottom: 3 },
  statusMessage: { color: colors.heading, fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },

  trustBar: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 16,
    backgroundColor: colors.white, paddingVertical: 16, paddingHorizontal: 20,
  },
  trustItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  trustIcon: { fontSize: 14 },
  trustLabel: { fontFamily: fonts.bodyMedium, fontSize: 11, color: colors.heading },

  sectionEyebrowWrap: { alignItems: "center", marginTop: 32, marginBottom: 20, paddingHorizontal: 20 },
  sectionEyebrow: { color: colors.brandBlue, fontFamily: fonts.heading, fontSize: 11, letterSpacing: 2, marginBottom: 6 },
  sectionTitle: { color: colors.heading, fontFamily: fonts.headingBlack, fontSize: 22, textAlign: "center" },

  qsForm: {
    marginHorizontal: 20, marginBottom: 36, backgroundColor: colors.white, borderRadius: 18,
    borderWidth: 1, borderColor: colors.border, padding: 18, gap: 16,
    shadowColor: colors.brandBlue, shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 3,
  },
  qsRow: { flexDirection: "row", gap: 12 },
  qsField: { gap: 8 },
  qsLabel: { fontFamily: fonts.heading, fontSize: 10, letterSpacing: 1, color: colors.brandBlue },
  qsInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontFamily: fonts.body, fontSize: 14, color: colors.heading, justifyContent: "center", minHeight: 42,
  },
  qsInputText: { fontFamily: fonts.body, fontSize: 14, color: colors.heading },
  qsInputPlaceholder: { fontFamily: fonts.body, fontSize: 14, color: "#94a3b8" },
  qsPillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  qsPillCol: { gap: 8 },
  qsPillFull: { width: "100%" },
  qsPill: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.border },
  qsPillActive: { backgroundColor: colors.brandBlue, borderColor: colors.brandBlue },
  qsPillText: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.heading },
  qsPillTextActive: { color: colors.white },
  qsSubmit: { backgroundColor: colors.accentOrange, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  qsSubmitText: { color: colors.white, fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1 },

  grid: { paddingHorizontal: 16, flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "space-between" },
  card: {
    width: "48%", backgroundColor: colors.white, borderRadius: 18, borderTopWidth: 4, overflow: "hidden",
    shadowColor: colors.brandBlue, shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  cardImgWrap: { width: "100%", aspectRatio: 4 / 3, position: "relative" },
  cardImg: { width: "100%", height: "100%" },
  tag: { position: "absolute", top: 8, right: 8, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8, maxWidth: "80%" },
  tagText: { color: colors.white, fontFamily: fonts.heading, fontSize: 8, letterSpacing: 0.3 },
  cardBody: { flex: 1, padding: 12, justifyContent: "space-between" },
  cardTitle: { color: colors.brandBlue, fontFamily: fonts.heading, fontSize: 13, marginBottom: 3 },
  cardDesc: { color: colors.muted, fontFamily: fonts.body, fontSize: 11, marginBottom: 8, lineHeight: 15 },
  priceValue: { color: colors.heading, fontFamily: fonts.headingBlack, fontSize: 16 },
  priceLabel: { color: colors.muted, fontFamily: fonts.body, fontSize: 10, marginBottom: 10 },
  cardLink: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingVertical: 8, alignItems: "center", marginBottom: 8 },
  cardLinkText: { color: colors.brandBlue, fontFamily: fonts.heading, fontSize: 10, letterSpacing: 0.3 },
  cardCta: { backgroundColor: colors.brandBlue, borderRadius: 999, paddingVertical: 9, alignItems: "center" },
  cardCtaText: { color: colors.white, fontFamily: fonts.heading, fontSize: 11, letterSpacing: 0.3 },

  officialSection: {
    flexDirection: "row", alignItems: "stretch", paddingHorizontal: 20, paddingVertical: 24,
    gap: OFFICIAL_GAP, backgroundColor: colors.bg,
  },
  officialBanner: { width: OFFICIAL_BANNER_WIDTH, height: OFFICIAL_ROW_HEIGHT, borderRadius: 16 },
  officialLogoCard: {
    width: OFFICIAL_LOGO_WIDTH, height: OFFICIAL_ROW_HEIGHT, backgroundColor: colors.white,
    borderRadius: 16, alignItems: "center", justifyContent: "center", padding: 10,
  },
  officialLogo: { width: "100%", height: "100%" },

  section: { paddingHorizontal: 20, marginTop: 40, alignItems: "center" },
  sectionEyebrowLeft: { color: colors.brandBlue, fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1.5, marginBottom: 6, textAlign: "center" },
  sectionTitleLeft: { color: colors.heading, fontFamily: fonts.headingBlack, fontSize: 20, marginBottom: 12, textAlign: "center" },
  paragraph: { color: colors.heading, fontFamily: fonts.body, fontSize: 13, lineHeight: 20, marginBottom: 16, opacity: 0.75, textAlign: "center" },
  aboutBanner: { width: CONTENT_WIDTH, height: ABOUT_BANNER_HEIGHT, borderRadius: 16, marginBottom: 20 },
  conservationThumb: {
    width: "100%", aspectRatio: 16 / 9, borderRadius: 16, overflow: "hidden",
    backgroundColor: colors.navy, marginBottom: 8,
  },

  partnersGrid: {
    flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between",
    paddingHorizontal: 20, gap: 12, marginTop: 8, marginBottom: 8,
  },
  partnerCard: {
    width: "22%", aspectRatio: 3 / 2, backgroundColor: colors.white, borderRadius: 14,
    alignItems: "center", justifyContent: "center", padding: 10,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2,
  },
  partnerLogo: { width: "100%", height: "100%" },

  fbRow: { paddingHorizontal: 20, gap: 12, marginTop: 20, marginBottom: 8 },
  fbCard: { width: 160, aspectRatio: 220 / 390, borderRadius: 14, overflow: "hidden", backgroundColor: colors.navy },
  fbThumb: { width: "100%", height: "100%" },
  fbPlayBadge: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    alignItems: "center", justifyContent: "center", backgroundColor: "rgba(4,16,24,0.25)",
  },
  fbPlayIcon: { color: colors.white, fontSize: 22 },

  statsGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16, justifyContent: "space-between" },
  statTile: { width: "47%", backgroundColor: colors.white, borderRadius: 14, padding: 14, alignItems: "center" },
  statNum: { fontFamily: fonts.headingBlack, fontSize: 20, color: colors.brandBlue },
  statLabel: { fontFamily: fonts.body, fontSize: 10, color: colors.muted, textAlign: "center", marginTop: 4 },

  rulesCard: { width: "100%", backgroundColor: colors.white, borderRadius: 16, padding: 16, marginBottom: 12 },
  rulesTitle: { fontFamily: fonts.heading, fontSize: 13, letterSpacing: 1, marginBottom: 8, textAlign: "center" },
  ruleLine: { fontFamily: fonts.body, fontSize: 12.5, color: colors.heading, lineHeight: 20, opacity: 0.85 },

  infoRow: { width: "100%", flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  infoNum: { fontFamily: fonts.headingBlack, fontSize: 18, color: colors.tour.F, width: 32 },
  infoText: { flex: 1, fontFamily: fonts.body, fontSize: 13, color: colors.heading, lineHeight: 19, opacity: 0.85 },

  footer: { backgroundColor: colors.navy, padding: 24, marginTop: 40 },
  footerBrand: { color: colors.white, fontFamily: fonts.headingBlack, fontSize: 16, marginBottom: 10 },
  footerLine: { color: "rgba(255,255,255,0.7)", fontFamily: fonts.body, fontSize: 12, marginBottom: 6, lineHeight: 17 },
  footerLink: { color: colors.tour.T },
});
