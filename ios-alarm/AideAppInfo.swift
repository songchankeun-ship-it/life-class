import Foundation

// Diagnostic evidence only: this is not a signature/certificate validation API.
struct AideAppInfo: Encodable {
    let version: String
    let build: String
    let osVersion: String
    let profileExpiresAt: Int64?
    let expirySource: String

    static func profileExpiry(_ data: Data) -> Date? {
        // Provisioning formats may change. Missing/unreadable profiles stay unknown.
        guard data.count <= 2_000_000,
              let start = data.range(of: Data("<?xml".utf8)),
              let end = data.range(of: Data("</plist>".utf8), in: start.lowerBound..<data.endIndex),
              let plist = try? PropertyListSerialization.propertyList(from: data.subdata(in: start.lowerBound..<end.upperBound), format: nil) as? [String: Any]
        else { return nil }
        return plist["ExpirationDate"] as? Date
    }

    static func current(bundle: Bundle = .main) -> AideAppInfo {
        let expiry = bundle.url(forResource: "embedded", withExtension: "mobileprovision")
            .flatMap { try? Data(contentsOf: $0) }.flatMap(profileExpiry)
        return AideAppInfo(
            version: bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0",
            build: bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0",
            osVersion: ProcessInfo.processInfo.operatingSystemVersionStringForAide,
            profileExpiresAt: expiry.map { Int64($0.timeIntervalSince1970 * 1000) },
            expirySource: expiry == nil ? "unavailable" : "embedded-profile")
    }
}

private extension ProcessInfo {
    var operatingSystemVersionStringForAide: String {
        let v = operatingSystemVersion
        return "\(v.majorVersion).\(v.minorVersion).\(v.patchVersion)"
    }
}
