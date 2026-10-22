import SwiftUI
import AlarmKit
import Security
import UserNotifications
import UIKit

// This app owns only AlarmKit alarms. It never changes the Clock app's alarms.
private let aideServer = URL(string: "https://aide-personal-assistant.songchankeun.workers.dev")!
struct Credentials: Codable { let deviceId: String; let deviceKey: String }
enum CredentialStore {
    private static let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "AideAlarms", kSecAttrAccount as String: "executor"]
    static func load() -> Credentials? {
        var q = query; q[kSecReturnData as String] = true; q[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(Credentials.self, from: data)
    }
    static func save(_ value: Credentials) throws {
        let data = try JSONEncoder().encode(value)
        let values: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemUpdate(query as CFDictionary, values as CFDictionary)
        if status == errSecItemNotFound {
            var q = query; values.forEach { q[$0.key] = $0.value }
            guard SecItemAdd(q as CFDictionary, nil) == errSecSuccess else { throw AideError.storage }
        } else if status != errSecSuccess { throw AideError.storage }
    }
}
enum AideError: Error { case server(Int), storage, invalidCommand, mismatchedAlarm }
struct PairBody: Encodable { let code: String; let label: String }
struct PollBody: Encodable { let authorization: String; let pushToken: String?; let bundleId: String?; let protocolVersion = 2 }
struct NativeSchedule: Codable, Equatable {
    let kind: String; let fireAt: Double?; let weekdays: [Int]?; let time: String?; let timeZone: String; let snoozeSeconds: Int
}
struct Command: Decodable {
    let id: String; let version: Int; let nativeId: UUID; let operation: String
    let title: String; let fireAt: Double?; let ownedNativeIds: [UUID]; let challenge: String
    let schedule: NativeSchedule?; let protocolVersion: Int?
}
struct Poll: Decodable { let commands: [Command] }
struct Receipt: Encodable {
    let id: String; let version: Int; let nativeId: String; let status: String
    let observedAt: Int64; let fireAt: Int64?; let challenge: String; let errorCode: String?
    let schedule: NativeSchedule?
}
struct Accepted: Decodable { let accepted: Bool }
struct AlarmCheck: Identifiable {
    let id: String; let title: String; let timing: String; let status: String
    let observedAt: Date; let acknowledged: Bool; let errorCode: String?
    var fresh: Bool { Date().timeIntervalSince(observedAt) < 120 }
    var titleForStatus: String {
        switch status {
        case "scheduled": return !fresh ? "이전 기기 예약 확인" : acknowledged ? "아이폰 예약 · PC 전달 확인" : "기기 예약 확인 · PC 전달 대기"
        case "cancelled": return acknowledged ? "아이폰 취소 · PC 전달 확인" : "기기 취소 확인 · PC 전달 대기"
        case "alerting": return "아이폰에서 울리는 상태 확인"
        case "snoozed": return "다시 알림 중으로 확인"
        case "paused": return "아이폰에서 일시 정지됨"
        case "permission-denied": return "아이폰 알람 권한이 필요해요"
        case "missing": return "기기에서 예약을 찾지 못했어요"
        case "elapsed-unverified": return "예정 시각 지남 · 울림 미확인"
        default: return "확인이 필요한 알람이에요"
        }
    }
}
private func alarmTiming(_ schedule: NativeSchedule?) -> String {
    guard let schedule else { return "설정 확인 필요" }
    if schedule.kind == "weekly", let days = schedule.weekdays, let time = schedule.time {
        let names = ["월","화","수","목","금","토","일"]
        let label = days == [1,2,3,4,5] ? "월~금" : days.filter { (1...7).contains($0) }.map { names[$0-1] }.joined(separator: "·")
        return label+" "+time+" · 한국 시간"
    }
    guard let fireAt = schedule.fireAt else { return "날짜 확인 필요" }
    let formatter = DateFormatter(); formatter.locale = Locale(identifier: "ko_KR"); formatter.timeZone = TimeZone(identifier: "Asia/Seoul"); formatter.dateFormat = "M월 d일 HH:mm"
    return formatter.string(from: Date(timeIntervalSince1970: fireAt / 1000))+" · 한국 시간"
}

@MainActor final class AlarmExecutor: ObservableObject {
    static let shared = AlarmExecutor()
    @Published var connected = CredentialStore.load() != nil
    @Published var busy = false
    @Published var message = CredentialStore.load() == nil ? "기존 Aide 연결부터 시작해 주세요." : "저장된 기기 연결이 있어요. 실제 예약을 확인하고 있어요."
    @Published var lastSync: Date?
    @Published var reservationCount = 0
    @Published var checks: [AlarmCheck] = []
    var permissionGranted: Bool { authorization == "authorized" }
    var pushToken: String?
    private var loop: Task<Void, Never>?
    private var observations: Task<Void, Never>?
    // Record successful read-back before returning a receipt. A lost HTTP response
    // cannot cause a user-deleted alarm to be silently recreated on the next poll.
    private var confirmed: Set<String> = Set(UserDefaults.standard.stringArray(forKey: "confirmedAlarmIDs") ?? [])
    private func remember(_ id: UUID) { confirmed.insert(id.uuidString); UserDefaults.standard.set(Array(confirmed), forKey: "confirmedAlarmIDs") }

    private func api<B: Encodable, R: Decodable>(_ path: String, body: B, auth: Bool = true) async throws -> R {
        var request = URLRequest(url: aideServer.appendingPathComponent(path))
        request.httpMethod = "POST"; request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if auth { guard let key = CredentialStore.load()?.deviceKey else { throw AideError.storage }; request.setValue(key, forHTTPHeaderField: "X-Aide-Alarm-Key") }
        request.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else { throw AideError.server((response as? HTTPURLResponse)?.statusCode ?? 0) }
        return try JSONDecoder().decode(R.self, from: data)
    }
    func pair(code: String) async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            let credential: Credentials = try await api("alarms/device/redeem", body: PairBody(code: code.replacingOccurrences(of: "-", with: ""), label: "내 아이폰 알람"), auth: false)
            try CredentialStore.save(credential); connected = true; message = "연결했어요. 알람 권한을 허용해 주세요."
        } catch { message = "연결하지 못했어요. 코드 만료·인터넷·PC의 기존 기기 연결을 확인해 주세요." }
    }
    func authorize() async {
        do {
            let state = try await AlarmManager.shared.requestAuthorization()
            guard state == .authorized else { message = "설정 앱에서 Aide 알람 권한을 허용해 주세요."; return }
            _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
            UIApplication.shared.registerForRemoteNotifications()
            await sync()
        } catch { message = "아이폰 알람 권한을 확인하지 못했어요. 설정 앱에서 확인해 주세요." }
    }
    private var authorization: String {
        switch AlarmManager.shared.authorizationState { case .authorized: return "authorized"; case .denied: return "denied"; default: return "notDetermined" }
    }
    func active(_ isActive: Bool) {
        loop?.cancel(); loop = nil
        if !isActive { return }
        if connected { UIApplication.shared.registerForRemoteNotifications() }
        loop = Task { while !Task.isCancelled { await sync(); try? await Task.sleep(for: .seconds(10)) } }
        if observations == nil {
            observations = Task { for await _ in AlarmManager.shared.alarmUpdates { if Task.isCancelled { break }; await sync() } }
        }
    }
    func sync() async {
        guard connected, !busy else { return }; busy = true; defer { busy = false }
        do {
            let poll: Poll = try await api("alarms/device/poll", body: PollBody(authorization: authorization, pushToken: pushToken, bundleId: pushToken == nil ? nil : Bundle.main.bundleIdentifier))
            var failures = 0
            for command in poll.commands {
                do {
                    let receipt = try await execute(command)
                    var acknowledged = false
                    do { let response: Accepted = try await api("alarms/device/receipt", body: receipt); acknowledged = response.accepted } catch { /* Keep local evidence separate from server acceptance. */ }
                    let check = AlarmCheck(id: command.id, title: command.title, timing: alarmTiming(command.schedule), status: receipt.status, observedAt: Date(timeIntervalSince1970: Double(receipt.observedAt) / 1000), acknowledged: acknowledged, errorCode: receipt.errorCode)
                    checks.removeAll { $0.id == command.id }; checks.append(check)
                    if !acknowledged || ["failed","missing","permission-denied","elapsed-unverified"].contains(receipt.status) { failures += 1 }
                } catch { failures += 1 }
            }
            reservationCount = (try? AlarmManager.shared.alarms.filter { $0.state == .scheduled }.count) ?? 0
            lastSync = Date()
            message = poll.commands.isEmpty ? "새 알람 요청이 없어요. 앱 알람 화면에서 내용을 확인하고 승인해 주세요." : failures == 0 ? "기기에서 읽은 확인 결과를 PC로 보냈어요." : "확인 또는 PC 전달이 끝나지 않은 항목이 있어요. 아래 결과를 확인해 주세요."
        } catch { message = "서버에 연결하지 못했어요. 기존 예약은 유지돼요. 인터넷·기기 연결을 확인해 주세요." }
    }
    private func execute(_ cmd: Command) async throws -> Receipt {
        let observedAt = { Int64(Date().timeIntervalSince1970 * 1000) }
        func result(_ status: String, _ date: Date? = nil, _ error: String? = nil) -> Receipt {
            Receipt(id: cmd.id, version: cmd.version, nativeId: cmd.nativeId.uuidString.lowercased(), status: status, observedAt: observedAt(), fireAt: date.map { Int64(($0.timeIntervalSince1970 * 1000).rounded()) }, challenge: cmd.challenge, errorCode: error, schedule: ["scheduled", "alerting", "snoozed", "paused"].contains(status) ? cmd.schedule : nil)
        }
        guard ["schedule", "cancel", "inspect"].contains(cmd.operation), cmd.ownedNativeIds.count <= 128, cmd.ownedNativeIds.contains(cmd.nativeId) else { throw AideError.invalidCommand }
        guard authorization == "authorized" else { return result("permission-denied") }
        do {
            if cmd.operation == "cancel" {
                for alarm in try AlarmManager.shared.alarms where cmd.ownedNativeIds.contains(alarm.id) { try AlarmManager.shared.cancel(id: alarm.id) }
                guard try !AlarmManager.shared.alarms.contains(where: { cmd.ownedNativeIds.contains($0.id) }) else { throw AideError.mismatchedAlarm }
                return result("cancelled")
            }
            guard let expected = cmd.schedule, expected.timeZone == "Asia/Seoul", [300,600].contains(expected.snoozeSeconds) else { throw AideError.invalidCommand }
            let weekly = expected.kind == "weekly"
            let target = expected.fireAt.map { Date(timeIntervalSince1970: $0 / 1000) }
            let schedule: Alarm.Schedule
            if weekly {
                guard TimeZone.current.identifier == expected.timeZone else { return result("failed", nil, "ALARM_TIMEZONE_MISMATCH") }
                guard let days = expected.weekdays, !days.isEmpty, Set(days).count == days.count, days.allSatisfy({ (1...7).contains($0) }), let time = expected.time else { throw AideError.invalidCommand }
                let parts = time.split(separator: ":").compactMap { Int($0) }
                guard parts.count == 2, (0...23).contains(parts[0]), (0...59).contains(parts[1]) else { throw AideError.invalidCommand }
                let names: [Locale.Weekday] = [.monday,.tuesday,.wednesday,.thursday,.friday,.saturday,.sunday]
                schedule = .relative(.init(time: .init(hour: parts[0], minute: parts[1]), repeats: .weekly(days.map { names[$0-1] })))
            } else {
                guard expected.kind == "fixed", let target, expected.fireAt == cmd.fireAt else { throw AideError.invalidCommand }
                schedule = .fixed(target)
            }
            // Never cancel a ringing alarm just because its scheduled time passed.
            if cmd.operation == "schedule" && (weekly || (target ?? .distantPast) > Date()) {
                for alarm in try AlarmManager.shared.alarms where cmd.ownedNativeIds.contains(alarm.id) && alarm.id != cmd.nativeId { try AlarmManager.shared.cancel(id: alarm.id) }
                if try !AlarmManager.shared.alarms.contains(where: { $0.id == cmd.nativeId }) {
                    if confirmed.contains(cmd.nativeId.uuidString) { return result("missing") }
                    guard weekly || (target ?? .distantFuture).timeIntervalSinceNow <= 366 * 86400 else { throw AideError.invalidCommand }
                    let stop = AlarmButton(text: "중지", textColor: .white, systemImageName: "stop.fill")
                    let snooze = AlarmButton(text: "다시 알림", textColor: .white, systemImageName: "zzz")
                    let title = LocalizedStringResource(stringLiteral: cmd.title)
                    let alert = AlarmPresentation.Alert(title: title, stopButton: stop, secondaryButton: snooze, secondaryButtonBehavior: .countdown)
                    let countdown = AlarmPresentation.Countdown(title: title, pauseButton: AlarmButton(text: "일시 정지", textColor: .white, systemImageName: "pause.fill"))
                    let paused = AlarmPresentation.Paused(title: title, resumeButton: AlarmButton(text: "다시 시작", textColor: .white, systemImageName: "play.fill"))
                    let attrs = AlarmAttributes(presentation: AlarmPresentation(alert: alert, countdown: countdown, paused: paused), metadata: AideMetadata(requestId: cmd.id, title: cmd.title), tintColor: Color.blue)
                    let config = AlarmManager.AlarmConfiguration(countdownDuration: Alarm.CountdownDuration(preAlert: nil, postAlert: Double(expected.snoozeSeconds)), schedule: schedule, attributes: attrs, sound: .default)
                    _ = try await AlarmManager.shared.schedule(id: cmd.nativeId, configuration: config)
                }
            }
            guard let alarm = try AlarmManager.shared.alarms.first(where: { $0.id == cmd.nativeId }) else { return result(!weekly && (target ?? .distantPast) <= Date() ? "elapsed-unverified" : "missing") }
            guard let actual = alarm.schedule, alarm.countdownDuration?.postAlert == Double(expected.snoozeSeconds) else { throw AideError.mismatchedAlarm }
            var actualDate: Date?
            switch actual {
            case .fixed(let date):
                guard !weekly, let target, abs(date.timeIntervalSince(target)) < 0.001 else { throw AideError.mismatchedAlarm }; actualDate = date
            case .relative(let value):
                guard weekly, case .weekly(let days) = value.repeats else { throw AideError.mismatchedAlarm }
                let names: [Locale.Weekday] = [.monday,.tuesday,.wednesday,.thursday,.friday,.saturday,.sunday]
                let observed = days.compactMap { names.firstIndex(of: $0).map { $0+1 } }.sorted()
                guard observed == expected.weekdays?.sorted(), String(format: "%02d:%02d", value.time.hour, value.time.minute) == expected.time else { throw AideError.mismatchedAlarm }
            @unknown default: throw AideError.mismatchedAlarm
            }
            if alarm.state == .alerting { remember(alarm.id); return result("alerting", actualDate) }
            if alarm.state == .countdown { remember(alarm.id); return result("snoozed", actualDate) }
            if alarm.state == .paused { remember(alarm.id); return result("paused", actualDate) }
            if alarm.state == .scheduled && (weekly || (target ?? .distantPast) > Date()) { remember(alarm.id); return result("scheduled", actualDate) }
            return result("elapsed-unverified")
        } catch { return result("failed", nil, "ALARMKIT_OPERATION_FAILED") }
    }
}

final class AideDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool { UNUserNotificationCenter.current().delegate = self; return true }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) { Task { @MainActor in AlarmExecutor.shared.pushToken = deviceToken.map { String(format: "%02x", $0) }.joined(); await AlarmExecutor.shared.sync() } }
    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any], fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) { Task { @MainActor in await AlarmExecutor.shared.sync(); completionHandler(.newData) } }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) { Task { @MainActor in await AlarmExecutor.shared.sync(); completionHandler() } }
}
@main struct AideAlarmsApp: App {
    @UIApplicationDelegateAdaptor(AideDelegate.self) var delegate
    @Environment(\.scenePhase) private var phase
    @StateObject private var executor = AlarmExecutor.shared
    @StateObject private var web = AideWebSession()
    @State private var selectedTab = CredentialStore.load() == nil ? 1 : 0
    @State private var code = ""
    var body: some Scene { WindowGroup {
        TabView(selection: $selectedTab) {
        AideWebView(session: web).overlay { if let error = web.loadError { VStack(spacing: 16) { Image(systemName: "wifi.exclamationmark").font(.largeTitle); Text(error).multilineTextAlignment(.center); Button("다시 연결") { web.open(.reload) } }.padding(28).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(uiColor: .systemBackground)) } else if !web.loaded { ProgressView("Aide를 열고 있어요") } }.tabItem { Label("나의 Aide", systemImage: "sparkles") }.tag(0)
        NavigationStack { Form {
            Section { Label("반가워요. 여기서 함께 연결해요.", systemImage: "sparkles"); Text("기존 일정은 그대로 가져오고, 알람은 이 아이폰에서만 울려요. 단축어를 따로 만들 필요 없어요.") }
            Section("1 · 기존 일정 연결") {
                Label(web.configured ? "이 앱에 Aide 연결 정보가 있어요" : "PC와 같은 일정에 연결해 주세요", systemImage: web.configured ? "checkmark.circle.fill" : "1.circle")
                Text("Safari 홈 화면 앱과 새 앱의 저장 공간은 달라요. 처음 한 번만 PC 설정에서 만든 새 기기 코드를 입력하면 됩니다. 실제 동기화 결과는 나의 Aide 화면에서 확인해요.").font(.footnote)
                Button(web.configured ? "Aide 연결 화면 확인" : "기존 일정 연결하기") { web.open(.connection); selectedTab = 0 }
            }
            Section("2 · 아이폰 알람 연결·허용") {
                Label(executor.connected && executor.permissionGranted ? "기기 연결 · 알람 권한 허용됨" : executor.connected ? "기기는 연결됐어요. 알람을 허용해 주세요" : "Aide에서 이 아이폰을 연결해 주세요", systemImage: executor.connected && executor.permissionGranted ? "checkmark.circle.fill" : "2.circle")
                Text("기존 일정 연결 후 아래 버튼을 눌러 ‘이 아이폰 연결’을 선택해 주세요. 알람 허용 안내가 이어집니다.").font(.footnote)
                Button("아이폰 알람 연결 화면 열기") { web.open(.alarms); selectedTab = 0 }.disabled(!web.configured)
                if executor.connected { Button(executor.permissionGranted ? "알람 권한 다시 확인" : "알람 허용하기") { Task { await executor.authorize() } }.disabled(executor.busy) }
            }
            Section("3 · 실제 예약 결과") {
                Text(executor.message)
                Button(executor.busy ? "예약 확인 중…" : "기기 예약 확인하고 PC로 보내기") { Task { await executor.sync() } }.disabled(executor.busy || !executor.connected)
                if executor.connected && executor.permissionGranted { Text("현재 기기에서 예약 상태인 알람 \(executor.reservationCount)개").font(.footnote) }
                if let date = executor.lastSync { Text("마지막 서버 통신 \(date.formatted(date: .abbreviated, time: .standard))").font(.footnote) }
                ForEach(executor.checks) { check in VStack(alignment: .leading, spacing: 6) {
                    Text(check.title).font(.headline); Text(check.timing).font(.subheadline)
                    Text(check.titleForStatus).foregroundStyle(check.status == "scheduled" && check.acknowledged && check.fresh ? Color.green : Color.secondary)
                    Text("기기 확인 \(check.observedAt.formatted(date: .abbreviated, time: .standard)) · \(check.acknowledged ? "PC 전달 접수됨" : "PC 전달 확인 대기")").font(.caption)
                    if let code = check.errorCode { Text(code).font(.caption.monospaced()) }
                }.padding(.vertical, 4) }
                if executor.checks.isEmpty { Text("아직 이 앱에서 읽은 알람 확인 결과가 없어요. 서버에 일정을 저장하는 것과 실제 아이폰 예약은 별개예요.").font(.footnote) }
            }
            if let error = web.loadError { Section("Aide 화면 연결") { Text(error); Button("Aide 다시 열기") { web.open(.reload); selectedTab = 0 } } }
            if !executor.connected { Section { DisclosureGroup("알람 전용 코드 직접 입력 · 필요할 때만") {
                Text("PC의 ‘아이폰 앱 알람 → 앱 연결 코드 만들기’에서 만든 숫자 12자리 코드예요. 위 1단계의 새 기기 연결 코드와 다릅니다.").font(.footnote)
                TextField("알람 전용 숫자 코드", text: $code).keyboardType(.numberPad).textContentType(.oneTimeCode)
                Button("알람 기기 연결") { Task { await executor.pair(code: code); if executor.connected { code = ""; await executor.authorize() } } }.disabled(executor.busy || code.filter(\.isNumber).count != 12)
            } } }
            Section("기억해 주세요") { Text("이미 기기에 예약된 알람은 PC를 꺼도 유지돼요. 새 요청·변경·취소는 아이폰이 받아야 반영됩니다. 마지막 확인 뒤 상태가 달라질 수 있어요.").font(.footnote); Text("Aide의 AlarmKit 알람은 기본 시계 앱의 목록과 별도예요. 기존 일정과 아이폰 푸시 알림을 지우지 않아요.").font(.footnote) }
        }.navigationTitle("연결과 알람") }.tabItem { Label("연결·알람", systemImage: "alarm") }.tag(1)
        }.onChange(of: phase) { _, value in executor.active(value == .active) }.task { executor.active(true) }
    } }
}
