# Aide 아이폰 알람 실행부

PC는 일정 입력과 예약 상태 확인을 담당합니다. 앱의 ‘나의 Aide’는 기존 웹 Aide의 화면·일정·프로젝트·대화를 그대로 사용하고, 네이티브 실행부가 iOS 26 AlarmKit으로 반복·날짜 지정 알람을 예약합니다. 기존 Safari 홈 화면 앱의 데이터와 푸시 등록을 삭제하지 않습니다. 새 앱에서는 알람을 위해 단축어를 만들지 않습니다.

## 0.2 앱 구성

- `AideWebView.swift`: 기존 Aide 화면, 같은 서버 데이터. Safari와 앱 저장 공간이 다르므로 최초 한 번 기존 PC와 기기 연결 필요.
- `AideAlarms.swift`: Keychain의 제한된 기기 키, AlarmKit 권한, 반복·날짜 지정 예약, 실제 설정 읽기, 서버 결과 회신.
- `AideAlarmModels.swift`, `AideAlarmWidget.swift`: 앱/위젯 공통 메타데이터와 잠금 화면·Dynamic Island의 다시 알림 표시 구성.
- `generate-project.mjs`: iOS 26 앱과 포함된 Widget 확장을 함께 생성. 앱과 Widget은 별도 배포 프로파일을 사용.
- 서버 공통 규약: `shared/native-alarm-schedule.mjs`. 월=1…일=7, 한국 시간, 24시간제. 평일 08:30이 초기 입력값이며 자동 등록하지 않음.
- 다시 알림은 5분 또는 10분. AlarmKit 알림에서 시스템 ‘중지’·‘다시 알림’을 사용. 소리가 무한히 지속된다고 보장하지 않으며 실제 iOS 동작을 기기에서 확인해야 함.
- 한국 시간의 주간 반복은 아이폰 시간대가 Asia/Seoul일 때 예약. 해외 시간대를 감지하면 잘못된 시각으로 예약하지 않고 `ALARM_TIMEZONE_MISMATCH` 보고.
- PC ‘설정 → 아이폰 앱 알람’에서 승인 전 확인, 예약 대기/기기 확인 시각/오류/실제 취소 응답을 구분.

## 현재 검증 범위

- 첫 연결은 한 번에 한 단계: 일정 연결 → 아이폰 연결 → 알람 허용. 짧은 설명과 주 버튼 하나만 먼저 보이며, 직접 코드 입력과 예약 상세는 접힌 도움말에서 확인합니다. 실제 예약은 별도 승인 후 기기에서 읽은 결과로만 확인합니다.
- 알람 편집은 큰 오전/오후 시각, 요일 버튼과 평일 선택, 5/10분 다시 알림을 같은 화면에 둡니다. 하단 확인 → 별도 승인 후 요청하며, 승인 후 예약 확인 영역을 펼칩니다. PC에서도 같은 영역에서 실제 기기 응답·확인 시각·오류·취소 상태를 확인합니다. 저장만으로 예약 확인 표시하지 않습니다.

- 이 폴더는 실행부 소스입니다. 소스 파일 존재나 시뮬레이터 컴파일 성공은 실제 아이폰 설치·예약·울림 검증을 의미하지 않습니다.
- 생성 프로젝트는 `node ios-alarm/generate-project.mjs`로 만듭니다. 외부 패키지를 설치하지 않습니다.
- GitHub `Aide iPhone alarm build`는 macOS/iOS SDK 컴파일만 하며 서명, TestFlight 업로드, 알람 실행을 하지 않습니다.
- TestFlight 설치에는 본인 Developer Program 팀의 배포 서명·프로파일과 App Store Connect 앱 등록이 추가로 필요합니다. Apple ID 비밀번호, API 키, 인증서 개인키를 소스·채팅·빌드 로그에 넣지 않습니다.
- `Aide iPhone TestFlight (manual approval)`는 수동 실행 전용입니다. 워크플로를 검토해 기본 브랜치에 반영한 뒤 실행합니다. `aide-testflight` Environment에 배포 인증서 P12와 비밀번호, App Store 프로파일, App Store Connect API 키를 직접 등록해야 합니다. 해당 환경은 소유자 승인과 검토한 브랜치만 허용하도록 제한하는 것을 권장합니다. 아직 실행·업로드하지 않았습니다.
- Environment Secrets: `AIDE_IOS_CERTIFICATE_BASE64`, `AIDE_IOS_CERTIFICATE_PASSWORD`, `AIDE_IOS_PROFILE_BASE64`, `AIDE_IOS_WIDGET_PROFILE_BASE64`, `AIDE_ASC_KEY_P8`, `AIDE_ASC_KEY_ID`, `AIDE_ASC_ISSUER_ID`. Environment Variables: `AIDE_IOS_TEAM_ID`, `AIDE_IOS_BUNDLE_ID`. 해당 정보와 키는 채팅에 보내지 않습니다.

## 실행 흐름

1. PC Aide가 일정과 전용 알람 요청을 서버에 한 번에 저장합니다. 아직 실제 예약 완료가 아닙니다.
2. 설치한 이 앱에 PC에서 만든 12자리·5분·1회용 코드를 입력합니다. 서버는 일정 전체 열람·AI 호출·쇼핑 승인이 불가능한 알람 전용 기기 키를 발급합니다. 키는 Keychain에 보관합니다.
3. 사용자가 알람 권한과 알림 권한을 허용합니다.
4. 앱은 활성 상태에서 10초마다 요청을 확인하고, 지정 날짜는 `Alarm.Schedule.fixed(Date)`, 요일 반복은 `.relative(... .weekly(...))`로 예약합니다.
5. `AlarmManager.shared.alarms`에서 ID·실제 날짜 또는 요일/시각·다시 알림 간격·상태를 다시 읽은 결과만 서버에 회신합니다. PC는 그 응답과 확인 시각을 표시합니다. 구버전 앱은 새 반복 요청을 실행하지 못합니다.
6. 일정 날짜·시간 변경, 완료·삭제·알림 끄기는 새 버전으로 확인합니다. 이전 예약의 확인 응답은 새 예약 성공으로 인정하지 않습니다.

## 전달과 울림의 구분

- **이미 기기에 예약된 알람**: PC와 서버에 계속 연결돼 있어야 울리는 방식이 아닙니다. 다만 실제 기기 울림은 별도 수신 시험으로 확인해야 합니다.
- **새 요청·수정·취소**: 아이폰 실행부가 받아야 적용됩니다. 오프라인·강제 종료·iOS 백그라운드 제한은 지연 원인입니다.
- APNs는 실행부를 깨우는 무음 백그라운드 전달입니다. APNs HTTP 200은 아이폰에서 예약됐다는 증거가 아닙니다. 앱이 실제 알람을 읽어 회신해야 확인됩니다.
- APNs 서버 Secret `APNS_AUTH_KEY`, vars `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`가 필요합니다. 개발 설치는 `APNS_ENVIRONMENT=development`, TestFlight는 production입니다. 미설정이면 앱을 열어 확인해야 하며 PC에 이를 표시합니다.
- 이 앱의 AlarmKit 알람은 Apple 기본 시계 앱의 알람 목록과 별도입니다.
- 예정 시각이 지났다고 울렸다고 추정하지 않습니다. 울리는 알람을 동기화 과정에서 자동 취소하지 않습니다.
- 사용자가 아이폰에서 지운 이미 확인된 알람을 자동 재생성하지 않습니다.
- 이 앱에서 만든 요청은 `reminderChannel=iphone-alarm`입니다. 일반 웹 푸시·Telegram 일정 알림과 중복 전송하지 않습니다. 기존 일반 일정의 알림 경로는 유지합니다.

## 설치 후 수동 인수 시험

PC에서 가상 시험 일정을 5분 뒤로 한 번 등록 → PC에 기기 예약 확인·정확한 날짜 확인 → 아이폰 앱 종료·화면 잠금 → PC 종료 → 정한 시각 실제 알람 울림 확인. 이어서 새 요청 전달, 날짜 변경·취소·수신 실패 표시를 각각 확인합니다. 컴파일만으로 이 시험을 통과 처리하지 않습니다.

서명·배포·기기 설치 전에는 자동 예약 기능이 완성됐다고 안내하지 않습니다.

## 유료 단계와 현재 보류점

- 코드 개발과 공개 저장소의 표준 GitHub macOS unsigned 빌드는 이번 작업에서 유료 결제 없이 수행합니다. 로그는 Actions 기본 로그만 사용하며 별도 빌드 artifact를 업로드하지 않습니다.
- 2026-10-23 Apple Developer 계정에서 활성 멤버십과 갱신일 2027-10-24를 확인했습니다. 사용자가 서명·TestFlight 배포·본인 아이폰 설치를 요청했습니다. 추가 구매·갱신·유료 runner 실행은 승인되지 않았습니다.
- 그 다음 App ID와 Widget ID, 배포 인증서, 두 프로파일, App Store Connect 앱 등록/APNs 키가 필요합니다. 계정 약관·결제는 소유자가 직접 확인합니다. 키와 인증서 비밀번호는 채팅으로 받지 않습니다.
- 수동 TestFlight workflow는 준비만 했으며, 배포 서명·업로드는 아직 검증하지 않았습니다. Apple의 처리·설치·기기 알람 권한·실제 울림 확인 후에만 실제 사용 가능으로 표시합니다.
- 운영 `IPHONE_NATIVE_ALARMS=false` 유지. 설치 준비가 끝나면 기존 push를 유지한 채 앱 기능만 별도로 켭니다. 기존 Clock 재입고 알람은 자동 재생성하지 않습니다.

공식 근거: [AlarmKit](https://developer.apple.com/documentation/AlarmKit/scheduling-an-alarm-with-alarmkit), [백그라운드 푸시 제한](https://developer.apple.com/documentation/usernotifications/pushing-background-updates-to-your-app), [Apple 가입 비용](https://developer.apple.com/help/account/membership/program-enrollment), [GitHub Actions 요금](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
