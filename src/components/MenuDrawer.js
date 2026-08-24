import { useState } from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { colors, fonts } from "../theme";

// 웹사이트 헤더 nav(Home / Tours / Book Now / Partner)와 같은 항목을
// 담은 햄버거 메뉴. 화면마다 반복해서 써야 하니 하나의 컴포넌트로 뺐습니다.
export default function MenuDrawer({ navigation, onNavigateTours }) {
  const [open, setOpen] = useState(false);

  function go(action) {
    setOpen(false);
    action();
  }

  return (
    <>
      <Pressable style={styles.hamburgerBtn} onPress={() => setOpen(true)} hitSlop={12}>
        <View style={styles.bar} />
        <View style={styles.bar} />
        <View style={styles.bar} />
      </Pressable>

      <Modal visible={open} animationType="fade" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.panel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.panelTitle}>MENU</Text>

            <MenuItem label="Home" onPress={() => go(() => navigation.navigate("Home"))} />
            <MenuItem
              label="Tours"
              onPress={() => go(() => {
                navigation.navigate("Home");
                onNavigateTours && onNavigateTours();
              })}
            />
            <MenuItem label="Book Now" onPress={() => go(() => navigation.navigate("Booking", { tourType: "F" }))} />
            <MenuItem label="Partner" onPress={() => go(() => navigation.navigate("Partner"))} />

            <Pressable style={styles.closeBtn} onPress={() => setOpen(false)}>
              <Text style={styles.closeBtnText}>CLOSE</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function MenuItem({ label, onPress }) {
  return (
    <Pressable style={styles.item} onPress={onPress}>
      <Text style={styles.itemText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hamburgerBtn: {
    position: "absolute",
    top: 56,
    right: 20,
    zIndex: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  bar: { width: 18, height: 2, backgroundColor: colors.white, borderRadius: 1 },
  backdrop: { flex: 1, backgroundColor: "rgba(4,16,24,0.6)", justifyContent: "flex-start", alignItems: "flex-end" },
  panel: {
    marginTop: 56,
    marginRight: 16,
    width: 220,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  panelTitle: {
    fontFamily: fonts.heading,
    fontSize: 10,
    letterSpacing: 1.5,
    color: colors.muted,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 4,
  },
  item: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 },
  itemText: { fontFamily: fonts.bodyMedium, fontSize: 15, color: colors.heading },
  closeBtn: { marginTop: 6, paddingVertical: 12, alignItems: "center", borderTopWidth: 1, borderTopColor: colors.border },
  closeBtnText: { fontFamily: fonts.heading, fontSize: 11, letterSpacing: 1, color: colors.brandBlue },
});
