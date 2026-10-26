import Foundation
@main struct AppInfoTests {
    static func main() throws {
        let expiry = Date(timeIntervalSince1970: 1_800_000_000)
        let xml = try PropertyListSerialization.data(fromPropertyList: ["ExpirationDate": expiry], format: .xml, options: 0)
        let cms = Data([0x30, 0x82, 0xff]) + xml + Data([0x00, 0xff])
        precondition(AideAppInfo.profileExpiry(cms) == expiry)
        precondition(AideAppInfo.profileExpiry(Data("no profile".utf8)) == nil)
        precondition(AideAppInfo.profileExpiry(Data("<?xml broken </plist>".utf8)) == nil)
        precondition(AideAppInfo.profileExpiry(Data(repeating: 0, count: 2_000_001)) == nil)
        let noDate = try PropertyListSerialization.data(fromPropertyList: ["Name": "fixture"], format: .xml, options: 0)
        precondition(AideAppInfo.profileExpiry(noDate) == nil)
        let value = AideAppInfo.current()
        let data = try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) as! [String: Any]
        precondition(data["version"] != nil && data["build"] != nil && data["osVersion"] != nil)
        precondition(data["expirySource"] as? String == "unavailable")
        precondition(data["profileExpiresAt"] == nil)
        print("AppInfo: 8 checks passed; no credentials or device identifiers emitted")
    }
}
