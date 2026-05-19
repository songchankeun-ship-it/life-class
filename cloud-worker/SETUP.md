# Aide Cloud Notifier — Cloudflare Worker 설정

이 Worker 가 Aide 의 알림을 진짜 백그라운드에서 보내줍니다.
앱 안 열어도 일정 시간에 텔레그램에 알림이 와요. 무료입니다.

소요 시간: 약 5~10분.

---

## 1) Cloudflare 가입

https://dash.cloudflare.com/sign-up → 이메일/비밀번호로 가입.
(이미 계정 있으면 로그인)

## 2) Worker 만들기

1. 좌측 메뉴 → **Workers & Pages**
2. **Create** → **Workers** → **Create Worker** 클릭
3. 이름: `aide-notifier` (원하는 거 OK)
4. **Deploy** 클릭 (기본 hello world 가 일단 배포됨)
5. 그 다음 **Edit code** 클릭
6. 왼쪽 `worker.js` 파일 내용 **전부 삭제** → `cloud-worker/worker.js` 의 내용 통째로 복붙
7. 우측 상단 **Deploy** 클릭

## 3) KV 네임스페이스 만들기

1. 좌측 메뉴 → **Workers & Pages** → **KV** 탭
2. **Create a namespace** → 이름: `AIDE_KV`
3. 생성 완료

## 4) Worker 에 KV 바인딩

1. **Workers & Pages** → 방금 만든 `aide-notifier` Worker 클릭
2. **Settings** 탭 → **Variables** → **KV Namespace Bindings**
3. **Add binding**:
   - Variable name: `AIDE_KV` (정확히 이대로)
   - KV namespace: 방금 만든 `AIDE_KV` 선택
4. **Save and deploy**

## 5) 시크릿 3개 등록

같은 **Settings** → **Variables** → **Environment Variables** 섹션에서
**Add variable** 클릭 후 각각 추가. **Type 을 "Secret" 로 선택**.

| Variable name | Value |
|---|---|
| `TG_TOKEN` | 텔레그램 봇 토큰 (이미 사용 중인 `8880578706:...` 같이) |
| `TG_CHAT` | 본인 텔레그램 chat_id (숫자) |
| `SYNC_KEY` | 아무 랜덤 문자열 (32자 정도, 예: `aide_sync_2025_xyzabc123`) — 이 값을 앱에도 똑같이 입력해야 함 |

모두 입력했으면 **Save and deploy**.

## 6) 크론 트리거 설정

1. **Settings** 탭 → **Triggers**
2. **Cron Triggers** → **Add Cron Trigger**
3. Cron expression: `* * * * *` (매 분 실행)
4. **Add trigger**

## 7) Worker URL 확인

**Workers & Pages** 메인 → `aide-notifier` 클릭 → 상단에 URL 이 나옴.
예: `https://aide-notifier.YOUR-SUBDOMAIN.workers.dev`

이 URL 복사해두기.

## 8) 동작 테스트

브라우저에서 `https://aide-notifier.YOUR-SUBDOMAIN.workers.dev/` 열어보기.
`Aide notifier OK` 라고 뜨면 성공.

## 9) 앱에 입력

폰에서 Aide → ⚙ → **클라우드 알림** 섹션 (다음 배포 후 보임) → 두 값 입력:
- Worker URL: 위에서 복사한 URL
- Sync Key: 5단계에서 만든 SYNC_KEY 와 똑같이

저장 → 테스트 → 텔레그램에 ✅ 오면 끝!

---

## 작동 방식

- 앱이 entries 가 변할 때마다 Worker 에 자동 sync
- Worker 가 매 분 KV 의 entries 검사
- `오늘 날짜` + `time` 매치되면 → 텔레그램 ⏰ 알림
- 매일 9시 KST 에 오늘 일정 디지스트 자동 발송
- 같은 알림 하루에 1회만 (중복 방지)

## 비용

- Workers 요청: 일일 100,000 free → 매분 cron 만으로도 1440 / 일
- KV: 100,000 reads / 1,000 writes 일일 free → 앱이 entries 변경할 때만 write
- **개인 사용으로는 무료 한도 안에 충분히 들어옴**

## 문제 시

- 알림 안 옴 → Worker 의 **Logs** 탭에서 cron 실행 로그 확인
- `Unauthorized` → SYNC_KEY 가 앱과 Worker 시크릿에서 다른 값
- Telegram 안 옴 → TG_TOKEN / TG_CHAT 확인. `@userinfobot` 으로 chat id 재확인
