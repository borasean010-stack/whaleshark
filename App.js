import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  useFonts,
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_800ExtraBold,
  Outfit_900Black,
} from "@expo-google-fonts/outfit";

import HomeScreen from "./src/screens/HomeScreen";
import DetailScreen from "./src/screens/DetailScreen";
import BookingScreen from "./src/screens/BookingScreen";
import ConfirmationScreen from "./src/screens/ConfirmationScreen";
import PartnerScreen from "./src/screens/PartnerScreen";
import { colors, fonts } from "./src/theme";
import { sendTestLocalNotification } from "./src/notifications";

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  // TEMPORARY: 푸시 알림 테스트용 — 앱 켜지면 바로 로컬 알림 하나를 띄웁니다.
  // 확인 끝나면 이 useEffect는 지워도 됩니다.
  useEffect(() => {
    sendTestLocalNotification();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.brandBlue} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator
        screenOptions={{
          headerTintColor: colors.heading,
          headerTitleStyle: { fontFamily: fonts.bodyMedium },
          headerStyle: { backgroundColor: colors.white },
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Detail"
          component={DetailScreen}
          options={{ headerTransparent: true, headerTintColor: colors.white, headerTitle: "" }}
        />
        <Stack.Screen name="Booking" component={BookingScreen} options={{ title: "Book Your Tour" }} />
        <Stack.Screen name="Confirmation" component={ConfirmationScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Partner" component={PartnerScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
