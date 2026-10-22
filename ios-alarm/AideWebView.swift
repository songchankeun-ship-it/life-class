import SwiftUI
import WebKit

struct AideWebView: UIViewRepresentable {
    private let origin = "aide-personal-assistant.songchankeun.workers.dev"
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "aideAlarm")
        config.userContentController.addUserScript(WKUserScript(source: "window.aideNativeAlarms=true;", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let view = WKWebView(frame: .zero, configuration: config)
        context.coordinator.webView = view; view.navigationDelegate = context.coordinator
        view.allowsBackForwardNavigationGestures = true
        view.load(URLRequest(url: URL(string: "https://"+origin+"/life-class/")!))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) { uiView.configuration.userContentController.removeScriptMessageHandler(forName: "aideAlarm") }
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        weak var webView: WKWebView?
        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "https", message.frameInfo.securityOrigin.host == "aide-personal-assistant.songchankeun.workers.dev", let body = message.body as? [String: String], let type = body["type"] else { return }
            Task { @MainActor in
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
            if url.scheme == "https", url.host == "aide-personal-assistant.songchankeun.workers.dev" { decisionHandler(.allow); return }
            if action.navigationType == .linkActivated, ["https","http"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
            decisionHandler(.cancel)
        }
    }
}
