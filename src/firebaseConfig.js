// 웹사이트(boracaywhaleshark.com)와 같은 Firebase 프로젝트/컬렉션을 그대로 씁니다.
// 여기서 만든 예약도 admin.html 대시보드에 바로 나타납니다.
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyB5HjvqxyKucPIx2tMQpmlFM0A2h_DtzBk",
  authDomain: "boracaysean-6217a.firebaseapp.com",
  projectId: "boracaysean-6217a",
  storageBucket: "boracaysean-6217a.firebasestorage.app",
  messagingSenderId: "390619286668",
  appId: "1:390619286668:web:5f03efd80dbba93fedbfa9",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// AsyncStorage에 세션을 저장해서, 앱을 완전히 껐다 켜도 로그인 상태가
// 유지되게 합니다 (기본 getAuth()는 메모리에만 세션을 두어 앱을 재시작하면
// 매번 로그아웃되어 있습니다).
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
