// Firebase 프로젝트 설정
// Firebase 콘솔(https://console.firebase.google.com) > 프로젝트 설정 > 일반 > 내 앱 에서
// 웹 앱을 추가하면 아래와 동일한 형태의 설정 객체를 받을 수 있습니다.
// 아래 값을 발급받은 값으로 반드시 교체하세요.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
