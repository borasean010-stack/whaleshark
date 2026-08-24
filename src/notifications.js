import * as Notifications from "expo-notifications";

// Expo Go는 SDK 53부터 원격(remote) 푸시 알림을 지원하지 않습니다 —
// 여기서는 기기 안에서 바로 뜨는 로컬 알림만 씁니다. 실제 서버발 푸시가
// 필요해지면 별도로 expo-notifications 토큰 등록 + EAS 개발 빌드가 필요합니다.
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
