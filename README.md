# 고래상어 투어 예약 사이트

스노클링 · 다이빙 체험 예약을 받는 정적 웹사이트입니다.
프론트엔드는 순수 HTML/CSS/JS이며, 예약 데이터는 Firebase Firestore에 저장됩니다.

## 폴더 구조

```
index.html          홈페이지
reservation.html     예약 폼
admin.html            예약 목록 관리자 페이지 (기본 상태에서는 비활성 - 아래 참고)
css/style.css
js/firebase-config.js  Firebase 프로젝트 설정 (직접 값 채워 넣어야 함)
js/reservation.js      예약 폼 -> Firestore 저장 로직
js/admin.js             Firestore 실시간 목록 표시/상태변경/삭제 로직
firestore.rules         Firestore 보안 규칙
firebase.json            Firebase CLI 설정 (규칙 배포용)
```

## 1. Firebase 프로젝트 설정

1. https://console.firebase.google.com 에서 새 프로젝트를 생성합니다.
2. 왼쪽 메뉴 **Firestore Database** 에서 데이터베이스를 생성합니다 (프로덕션 모드 권장).
3. 프로젝트 설정 > 일반 > "내 앱" 에서 웹 앱(</>)을 추가하고, 발급되는 설정 값을
   `js/firebase-config.js` 의 `firebaseConfig` 객체에 붙여넣습니다.
4. Firebase CLI로 보안 규칙을 배포합니다 (최초 1회 로그인 필요):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add        # 방금 만든 프로젝트 선택
   firebase deploy --only firestore:rules
   ```

`firestore.rules` 는 기본적으로 "예약 생성"만 허용하고, 읽기/수정/삭제는 차단되어 있습니다.
즉 **admin.html 은 기본 상태에서 데이터를 불러오지 못합니다.** 이는 의도된 보안 기본값입니다
(인증 없이 예약자 개인정보를 아무나 조회할 수 없도록). 관리자 페이지를 실제로 쓰려면:

1. Firebase Authentication(이메일/비밀번호)을 활성화하고 관리자 계정을 만듭니다.
2. `firestore.rules` 하단 안내에 따라 규칙을 수정하고, `admin.html`에 로그인 UI를 추가합니다.

이 부분은 현재 범위(예약 폼 + Firestore 저장)에 포함되어 있지 않으므로, 필요하시면 이어서 요청해주세요.

## 2. 로컬에서 확인하기

정적 파일이라 별도 빌드가 필요 없습니다. 아무 로컬 서버로 열면 됩니다:

```bash
npx serve .
# 또는
python3 -m http.server 8080
```

`file://` 로 직접 열면 브라우저에 따라 ES 모듈(import)이 막힐 수 있으니 로컬 서버 사용을 권장합니다.

## 3. GitHub 연결

```bash
gh repo create whale-shark-reservation --private --source=. --remote=origin
git push -u origin main
```

또는 GitHub 웹에서 저장소를 만든 뒤:

```bash
git remote add origin <저장소 URL>
git branch -M main
git push -u origin main
```

## 4. Cloudflare Pages 배포

1. Cloudflare 대시보드 > Workers & Pages > "Create application" > Pages > "Connect to Git"
2. 방금 만든 GitHub 저장소 선택
3. 빌드 설정:
   - Build command: (비워둠 — 정적 사이트라 빌드 불필요)
   - Build output directory: `/`
4. 배포 완료 후 발급되는 `*.pages.dev` 도메인으로 접속 확인

이후 GitHub `main` 브랜치에 push 할 때마다 Cloudflare Pages가 자동으로 재배포합니다.

## 참고: Firebase Web API Key

`firebase-config.js`에 들어가는 `apiKey`는 비밀 키가 아니라 프로젝트 식별용 공개 값입니다
(공식 문서 기준). 실제 데이터 보호는 Firestore 보안 규칙(`firestore.rules`)이 담당하므로,
그대로 GitHub에 커밋해도 괜찮습니다.
