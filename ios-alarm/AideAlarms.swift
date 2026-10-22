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

@MainActor final class AlarmExecutor: ObservableObject {
    static let shared = AlarmExecutor()
    @Published var connected = CredentialStore.load() != nil
    @Published var busy = false
    @Published var message = "PC에서 만든 연결 코드를 입력해 주세요."
    @Published var lastSync: Date?
    @Published var reservationCount = 0
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
                do { let receipt = try await execute(command); let _: Accepted = try await api("alarms/device/receipt", body: receipt) }
                catch { failures += 1 }
            }
            reservationCount = (try? AlarmManager.shared.alarms.filter { $0.state == .scheduled }.count) ?? 0
            lastSync = Date()
            message = failures == 0 ? "PC 요청을 확인했어요. 예약 결과를 서버에 보냈어요." : "일부 예약 확인이 끝나지 않았어요. PC에서 대기·오류 상태를 확인해 주세요."
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
    @State private var code = ""
    var body: some Scene { WindowGroup {
        TabView {
        AideWebView().tabItem { Label("나의 Aide", systemImage: "sparkles") }
        NavigationStack { Form {
            Section { Label("알람은 이 아이폰에서만 울려요", systemImage: "alarm.fill"); Text("PC Aide에서 등록한 날짜·시간을 받아 예약하고, 실제 기기 예약 결과를 PC에 돌려줍니다.") }
            if !executor.connected { Section("PC에서 만든 12자리 연결 코드") { TextField("연결 코드", text: $code).keyboardType(.numberPad).textContentType(.oneTimeCode); Button("이 아이폰 연결") { Task { await executor.pair(code: code); if executor.connected { code = "" } } }.disabled(executor.busy || code.filter(\.isNumber).count != 12) } }
            else { Section("아이폰 알람") { Button("알람·알림 권한 허용") { Task { await executor.authorize() } }; Button("PC 요청 지금 확인") { Task { await executor.sync() } }.disabled(executor.busy); Text("현재 기기 예약 \(executor.reservationCount)개"); if let date = executor.lastSync { Text("마지막 서버 통신 \(date.formatted(date: .abbreviated, time: .standard))") } } }
            Section("상태") { Text(executor.message); Text("예약을 마친 알람은 PC가 꺼져 있어도 아이폰에서 실행됩니다. 새 요청은 아이폰이 받아야 예약돼요. 오프라인·앱 강제 종료 등으로 전달이 지연될 수 있으며 PC에서 확인 결과를 봐 주세요.").font(.footnote); Text("Aide가 만든 AlarmKit 알람입니다. 기본 시계 앱의 알람 목록과는 별도로 관리됩니다.").font(.footnote) }
            Section { Link("Aide 일정 열기", destination: aideServer.appendingPathComponent("life-class/")) }
        }.navigationTitle("아이폰 알람 연결") }.tabItem { Label("알람 연결", systemImage: "alarm") }
        }.onChange(of: phase) { _, value in executor.active(value == .active) }.task { executor.active(true) }
    } }
}
