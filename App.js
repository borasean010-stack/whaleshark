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
import { registerPushToken } from "./src/notifications";
import { db } from "./src/firebaseConfig";

const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Outfit_400Regular,
    Outfit_600SemiBold,
    Outfit_800ExtraBold,
    Outfit_900Black,
  });

  // 앱을 열어본 모든 사람이 고래상어 출몰 알림 등 방송성 푸시를 받을 수
  // 있도록, 앱 시작 시 (권한이 있으면) 조용히 푸시 토큰을 등록해둡니다.
  useEffect(() => {
    registerPushToken(db);
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
