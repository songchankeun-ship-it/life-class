"""Read-only bundle checks before signing/upload. No network or credentials."""
import argparse
import json
import plistlib
from pathlib import Path


def verify(app_path, expected_bundle, expected_version=None):
    app = Path(app_path)
    widget = app / "PlugIns" / "AideAlarmWidget.appex"

    def plist(path):
        if not path.is_file():
            raise ValueError(f"Required bundle file missing: {path.name}")
        with path.open("rb") as source:
            return plistlib.load(source)

    info, widget_info = plist(app / "Info.plist"), plist(widget / "Info.plist")
    if info.get("CFBundleIdentifier") != expected_bundle:
        raise ValueError("App bundle identifier mismatch")
    if widget_info.get("CFBundleIdentifier") != expected_bundle + ".widgets":
        raise ValueError("Widget bundle identifier mismatch")
    for key in ("CFBundleShortVersionString", "CFBundleVersion"):
        if not info.get(key) or info[key] != widget_info.get(key):
            raise ValueError("App and widget versions must match")
    if expected_version and info["CFBundleShortVersionString"] != expected_version:
        raise ValueError("Candidate does not match the intended release version")
    if not info.get("NSAlarmKitUsageDescription", "").strip():
        raise ValueError("Alarm permission description missing")
    if "remote-notification" not in info.get("UIBackgroundModes", []):
        raise ValueError("Existing background alarm delivery mode missing")
    if widget_info.get("NSExtension", {}).get("NSExtensionPointIdentifier") != "com.apple.widgetkit-extension":
        raise ValueError("Alarm widget extension missing")
    for minimum in (info.get("MinimumOSVersion"), widget_info.get("MinimumOSVersion")):
        if not minimum or int(minimum.split(".")[0]) < 26:
            raise ValueError("Alarm app and widget require iOS 26")
    privacy = plist(app / "PrivacyInfo.xcprivacy")
    widget_privacy = plist(widget / "PrivacyInfo.xcprivacy")
    for manifest in (privacy, widget_privacy):
        if manifest.get("NSPrivacyTracking") is not False or manifest.get("NSPrivacyTrackingDomains") != []:
            raise ValueError("Unexpected tracking declaration")
    declared = privacy.get("NSPrivacyAccessedAPITypes", [])
    if not any(row.get("NSPrivacyAccessedAPIType") == "NSPrivacyAccessedAPICategoryUserDefaults"
               and row.get("NSPrivacyAccessedAPITypeReasons") == ["CA92.1"] for row in declared):
        raise ValueError("Own-app UserDefaults reason declaration missing")
    # The widget has no defaults reader and must not claim shared app-group use.
    if widget_privacy.get("NSPrivacyAccessedAPITypes") != []:
        raise ValueError("Unexpected required-reason API in widget")
    return {"bundleChecked": True, "version": info["CFBundleShortVersionString"],
            "build": info["CFBundleVersion"], "privacyResourcesPresent": True,
            "appWidgetVersionsMatch": True, "signingVerified": False,
            "appPrivacyAnswersVerified": False}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("app")
    parser.add_argument("--bundle", default="com.aide.personal.alarms")
    parser.add_argument("--version")
    args = parser.parse_args()
    try:
        print(json.dumps(verify(args.app, args.bundle, args.version)))
    except (ValueError, OSError, plistlib.InvalidFileException) as error:
        parser.exit(1, f"Bundle readiness failed: {error}\n")
