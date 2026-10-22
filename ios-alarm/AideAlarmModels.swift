import AlarmKit
import AppIntents
import Foundation

struct AideMetadata: AlarmMetadata { var requestId: String; var title: String }

struct StopAideAlarmIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Aide 알람 중지"
    @Parameter(title: "알람 ID") var alarmID: String
    init() {}
    init(alarmID: String) { self.alarmID = alarmID }
    func perform() async throws -> some IntentResult {
        guard let id = UUID(uuidString: alarmID) else { return .result() }
        try AlarmManager.shared.stop(id: id)
        return .result()
    }
}
