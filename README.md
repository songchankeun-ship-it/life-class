# 오늘의 교시 · Life Class

> 오늘을 한 번에 다 바꾸지 말고, 한 교시씩 정리하세요.

“갓생 시간표 자동화 앱”의 MVP(1+2단계)입니다.
하루를 학교 시간표(1교시 / 2교시 / 3교시 / 선택교시)로 쪼개고,
컨디션과 시간 여유에 따라 자동으로 오늘의 행동을 골라줍니다.

## 기술 스택

- React 18 + TypeScript
- Vite 6
- Tailwind CSS v4 (`@tailwindcss/vite` 플러그인)
- 데이터 저장: 브라우저 `localStorage`

> AI API/외부 서비스는 사용하지 않습니다. 규칙 기반(rule-based) 자동 분류로 동작합니다.

## 실행 방법

```bash
# 1) 의존성 설치
npm install

# 2) 개발 서버 실행 (http://localhost:5173)
npm run dev

# 3) 타입 체크
npm run typecheck

# 4) 프로덕션 빌드
npm run build
npm run preview
```

> Node 18 이상을 권장합니다.

## 폴더 구조

```
src/
├── main.tsx              # 엔트리포인트
├── App.tsx               # 탭 라우팅 + 상태 관리
├── types.ts              # 도메인 타입 / 라벨
├── styles/index.css      # Tailwind v4 + 테마
├── data/defaultData.ts   # 초기 프로젝트, 이사 체크리스트, 구독 더미
├── utils/
│   ├── storage.ts        # localStorage 헬퍼 + JSON export/import
│   ├── planner.ts        # rule-based 분류 / 오늘의 교시 생성
│   └── date.ts           # 날짜 포매팅
└── components/
    ├── Layout.tsx              # 상단/하단 탭 네비
    ├── Dashboard.tsx           # 1. 대시보드
    ├── DailyCheckIn.tsx        # 2. 아침 체크인
    ├── ClassSchedule.tsx       # 3. 오늘의 교시
    ├── ProjectBoard.tsx        # 4. 프로젝트
    ├── ParkingLot.tsx          # 5. 작업 주차장
    ├── MoveChecklist.tsx       # 6. 이사 체크리스트
    ├── SubscriptionManager.tsx # 7. 구독 / 자동결제
    ├── NightReview.tsx         # 8. 밤 정산
    ├── Settings.tsx            # 9. 설정 / 백업
    ├── StatCard.tsx
    ├── SectionCard.tsx
    └── EmptyState.tsx
```

## 사용 흐름

1. **아침 체크인** 탭에서
   - 컨디션 (좋음/보통/나쁨)
   - 시간 여유 (많음/보통/적음)
   - 떠오르는 할 일들 (줄바꿈으로 여러 개)
   - 오늘 꼭 끝내고 싶은 일 1개
   - 오늘 미루면 안 되는 일
   - 운동 여부, 한 줄 메모
   를 입력하고 **`오늘 시간표 만들기`** 를 누르세요.
2. **오늘의 교시** 가 자동 생성됩니다.
   - 컨디션이 나쁘면 2교시까지만 추천
   - 컨디션이 좋고 시간이 많으면 선택교시 1개 추가
   - 한 교시에는 행동 1개만 들어갑니다.
3. **작업 주차장** 에 떠오른 일을 잠깐 세워두고, 필요할 때 “오늘로 옮기기”로 교시에 추가합니다.
4. **이사 체크리스트** 와 **구독 관리** 에서 실제 일상 정리를 진행하세요.
5. **밤 정산** 에서 오늘을 닫고, 내일 첫 행동까지 자동으로 정리됩니다.
6. **설정** 에서 JSON 백업/복원, 기본 데이터 다시 불러오기를 할 수 있습니다.

## 데이터 보관 위치

모든 데이터는 브라우저 `localStorage` 의 아래 키에 저장됩니다.

- `lifeclass_tasks`
- `lifeclass_projects`
- `lifeclass_daily_plans`
- `lifeclass_check_ins`
- `lifeclass_parking_lot`
- `lifeclass_move_checklist`
- `lifeclass_subscriptions`
- `lifeclass_reviews`
- `lifeclass_settings`

이사처럼 큰 변화 전엔 **설정 → JSON 내보내기** 를 꼭 한 번 해두세요.

## 3단계(나중에 붙일 것)

지금은 구조만 잡혀 있고 구현하지 않았습니다.

- 브라우저 알림 / Telegram 알림
- Google Calendar 연동
- Supabase / Firebase 동기화
- AI API 기반 자동 정리

`utils/storage.ts` 의 `loadAllData / saveAllData` 를 백엔드 동기 함수로 갈아끼우는 형태로 확장하면 됩니다.
