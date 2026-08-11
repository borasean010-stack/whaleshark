# 프로젝트 글로벌 규칙 (Project Global Rules)

이 프로젝트(보라카이 고래상어 투어)는 **UI/UX Pro Max 및 Design Taste 플러그인의 럭셔리 철학**을 엄격하게 따릅니다. 
새로운 페이지나 컴포넌트를 만들 때는 반드시 `css/style.css`의 `:root`에 정의된 CSS 변수(Tokens)를 가져다 써야 합니다. 하드코딩된 색상이나 픽셀 값을 절대 사용하지 마세요.

## 🎨 Boracay Whale Shark Design System
1. **타이포그래피 (Exaggerated Minimalism)**
   - 메인 타이틀: `var(--pm-hero-font)` / `var(--pm-hero-weight)` / `var(--pm-hero-ls)`
   - 여백의 미를 살리고 자간은 타이트하게 조여 긴장감을 줍니다.
2. **유리 질감 (Liquid Glass)**
   - 박스 모델 뼈대: `var(--pm-glass-bg-strong)` 또는 `var(--pm-glass-bg-light)`
   - 질감 처리: `var(--pm-glass-blur)`와 `var(--pm-glass-border)`
   - 빛 반사: `var(--pm-glass-shadow-inset)` (1px 화이트 이너 그림자 필수)
3. **버튼 (Cold Luxury)**
   - 차가운 실버/글래스 톤: `var(--pm-btn-gradient)`
   - 호버 액션: `var(--pm-btn-gradient-hover)` / `transform: translateY(-2px)`
   - 모션 규격: `var(--pm-transition-bounce)` (부드럽고 텐션 있는 이징)
4. **시네마틱 오버레이**
   - 모든 페이지의 최상단(`<body>` 직하위)에는 `<div class="noise-overlay"></div>`가 존재해야 하며, 이는 화면에 3.5% 농도의 미세한 필름 노이즈 그레인을 깔아줍니다.
