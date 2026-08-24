import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";

// Expo Go는 SDK 53부터 원격(remote) 푸시 알림을 지원하지 않습니다 — 개발
// 빌드(EAS dev client)에서만 실제 토큰을 받아올 수 있습니다. Expo Go에서는
// 로컬 알림(sendTestLocalNotification)만 동작합니다.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationPermission() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function sendTestLocalNotification() {
  const granted = await ensureNotificationPermission();
  if (!granted) return false;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "🐋 Boracay Whale Shark",
      body: "Boracay Whale Shark meron! 🦈",
    },
    trigger: null,
  });
  return true;
}

// Expo Go에서 호출되면 조용히 null을 반환합니다 — 원격 푸시는 개발/정식
// 빌드에서만 의미가 있습니다.
export async function getExpoPushToken() {
  if (Constants.appOwnership === "expo") return null;
  const granted = await ensureNotificationPermission();
  if (!granted) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) return null;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (err) {
    console.error("Failed to get Expo push token:", err);
    return null;
  }
}

// 고래상어 출몰 알림처럼 "앱을 열어본 사람 전체"에게 보내는 방송용 —
// 토큰을 pushTokens/{token} 문서로 저장해둡니다 (문서 ID를 토큰 자체로 써서
// 같은 기기가 여러 번 등록해도 자연스럽게 덮어써집니다).
export async function registerPushToken(db) {
  const token = await getExpoPushToken();
  if (!token) return null;
  try {
    await setDoc(
      doc(db, "pushTokens", token),
      { token, platform: Platform.OS, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (err) {
    console.error("Failed to register push token:", err);
  }
  return token;
}
