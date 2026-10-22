import SwiftUI
import WebKit

enum AideWebDestination: Equatable { case connection, alarmConnection, alarms, reload }
@MainActor final class AideWebSession: ObservableObject {
    @Published var configured = false
    @Published var loaded = false
    @Published var loadError: String?
    @Published var destination: AideWebDestination?
    @Published var revision = 0
    func open(_ value: AideWebDestination) { destination = value; revision += 1 }
}

@MainActor struct AideWebView: UIViewRepresentable {
    @ObservedObject var session: AideWebSession
    private let origin = "aide-personal-assistant.songchankeun.workers.dev"
    func makeCoordinator() -> Coordinator { Coordinator(session: session) }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "aideAlarm")
        config.userContentController.addUserScript(WKUserScript(source: "window.aideNativeAlarms=true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        // Only a presence flag crosses the bridge. Account keys stay inside the web app.
        let report = """
        (()=>{const ready=()=>window.webkit.messageHandlers.aideAlarm.postMessage({type:'web-ready'});const report=()=>{let configured=false;try{configured=localStorage.getItem('lifeclass_cloud_url')===location.origin&&(localStorage.getItem('lifeclass_cloud_key')||'').length>=32;}catch{}window.webkit.messageHandlers.aideAlarm.postMessage({type:'web-session',configured:String(configured)});};window.addEventListener('aide-sync-config',report);window.addEventListener('aide-app-ready',ready);report();if(window.aideNativeReady)ready();})();
        """
        config.userContentController.addUserScript(WKUserScript(source: report, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        let view = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = view; view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.load(URLRequest(url: URL(string: "https://"+origin+"/life-class/")!))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) { context.coordinator.openRequestedPage() }
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) { uiView.configuration.userContentController.removeScriptMessageHandler(forName: "aideAlarm") }
    @MainActor final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var webView: WKWebView?
        let session: AideWebSession
        private var openedRevision = 0
        private var appReady = false
        init(session: AideWebSession) { self.session = session }
        func openRequestedPage() {
            guard session.revision != openedRevision, let destination = session.destination else { return }
            if destination == .reload { openedRevision = session.revision; webView?.reload(); return }
            guard appReady else { return }
            openedRevision = session.revision
            let event = destination == .connection ? "aide-open-device-connection" : destination == .alarmConnection ? "aide-open-alarm-connection" : "aide-open-remote-alarms"
            // Both events only open UI. Pairing, permissions and reservation still require a user action.
            webView?.evaluateJavaScript("window.dispatchEvent(new Event('"+event+"'));")
        }
        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { session.loaded = true; session.loadError = nil; openRequestedPage() }
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { appReady = false; session.loaded = false }
        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { session.loaded = false; session.loadError = "인터넷 연결을 확인한 뒤 앱을 다시 열어 주세요. 기존 일정과 기기 예약은 지우지 않아요." }
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "https", message.frameInfo.securityOrigin.host == "aide-personal-assistant.songchankeun.workers.dev", [0,443].contains(message.frameInfo.securityOrigin.port), let body = message.body as? [String: String], let type = body["type"] else { return }
            Task { @MainActor in
                if type == "web-ready" { appReady = true; session.loaded = true; session.loadError = nil; openRequestedPage(); return }
                if type == "web-session" { session.configured = body["configured"] == "true"; return }
                if type == "pair", let code = body["code"], code.filter(\.isNumber).count == 12 {
                    await AlarmExecutor.shared.pair(code: code)
                    if AlarmExecutor.shared.connected { await AlarmExecutor.shared.authorize() }
                } else if type == "sync" { await AlarmExecutor.shared.sync() }
                else { return }
                let payload = ["connected":AlarmExecutor.shared.connected]
                guard let data = try? JSONSerialization.data(withJSONObject: payload), let json = String(data:data,encoding:.utf8) else { return }
                _ = try? await webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('aide-native-alarm-result',{detail:"+json+"}));")
            }
        }
        func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = action.request.url else { decisionHandler(.cancel); return }
            if url.scheme == "https", url.host == "aide-personal-assistant.songchankeun.workers.dev", url.port == nil || url.port == 443 { decisionHandler(.allow); return }
            if action.navigationType == .linkActivated, ["https","http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
}
