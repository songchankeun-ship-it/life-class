import ActivityKit
import AlarmKit
import SwiftUI
import WidgetKit

@main struct AideAlarmWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: AlarmAttributes<AideMetadata>.self) { context in
            HStack {
                Label(context.attributes.metadata.title, systemImage: "alarm.fill")
                Spacer()
                Button(intent: StopAideAlarmIntent(alarmID: context.state.alarmID.uuidString)) { Label("중지", systemImage: "stop.fill") }
            }.padding().activityBackgroundTint(.black).activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.center) { Label(context.attributes.metadata.title, systemImage: "alarm.fill") }
                DynamicIslandExpandedRegion(.bottom) { Button(intent: StopAideAlarmIntent(alarmID: context.state.alarmID.uuidString)) { Label("중지", systemImage: "stop.fill") } }
            } compactLeading: { Image(systemName: "alarm.fill") } compactTrailing: { Text("Aide") } minimal: { Image(systemName: "alarm.fill") }
        }
    }
}
