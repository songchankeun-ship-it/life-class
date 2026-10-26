"""Offline packaging regressions: fake bundles contain no real device or account data."""
import copy
import importlib.util
import plistlib
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parent
spec = importlib.util.spec_from_file_location("release_bundle", ROOT / "verify-release-bundle.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BundleChecks(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory(prefix="aide-bundle-fixture-")
        self.addCleanup(self.folder.cleanup)
        self.app = Path(self.folder.name) / "AideAlarms.app"
        self.widget = self.app / "PlugIns" / "AideAlarmWidget.appex"
        self.widget.mkdir(parents=True)
        self.info = {"CFBundleIdentifier": "com.aide.personal.alarms",
                     "CFBundleShortVersionString": "1.0", "CFBundleVersion": "3",
                     "MinimumOSVersion": "26.0", "NSAlarmKitUsageDescription": "일정 알람 예약",
                     "UIBackgroundModes": ["remote-notification"]}
        self.widget_info = {**self.info, "CFBundleIdentifier": "com.aide.personal.alarms.widgets",
                            "NSExtension": {"NSExtensionPointIdentifier": "com.apple.widgetkit-extension"}}
        self.write(self.app / "Info.plist", self.info)
        self.write(self.widget / "Info.plist", self.widget_info)
        for source, destination in [(ROOT / "PrivacyInfo.xcprivacy", self.app),
                                    (ROOT / "WidgetPrivacy" / "PrivacyInfo.xcprivacy", self.widget)]:
            (destination / "PrivacyInfo.xcprivacy").write_bytes(source.read_bytes())

    def write(self, path, value):
        path.write_bytes(plistlib.dumps(value, fmt=plistlib.FMT_BINARY))

    def verify(self):
        return module.verify(self.app, "com.aide.personal.alarms", "1.0")

    def test_valid_candidate_with_binary_info_and_xml_privacy(self):
        result = self.verify()
        self.assertTrue(result["privacyResourcesPresent"])
        self.assertFalse(result["signingVerified"])

    def test_missing_app_or_widget_privacy_cannot_pass(self):
        for folder in [self.app, self.widget]:
            target = folder / "PrivacyInfo.xcprivacy"
            original = target.read_bytes()
            target.unlink()
            with self.assertRaises(ValueError):
                self.verify()
            target.write_bytes(original)

    def test_rejects_old_marketing_version_or_widget_build_mismatch(self):
        for key, value in [("CFBundleVersion", "2"), ("CFBundleShortVersionString", "0.2.0")]:
            self.write(self.widget / "Info.plist", {**self.widget_info, key: value})
            with self.assertRaises(ValueError):
                self.verify()
        self.write(self.widget / "Info.plist", self.widget_info)
        with self.assertRaises(ValueError):
            module.verify(self.app, "com.aide.personal.alarms", "1.1")

    def test_rejects_incorrect_defaults_reason_or_tracking(self):
        file = self.app / "PrivacyInfo.xcprivacy"
        value = plistlib.loads(file.read_bytes())
        changed = copy.deepcopy(value)
        changed["NSPrivacyAccessedAPITypes"][0]["NSPrivacyAccessedAPITypeReasons"] = ["1C8F.1"]
        self.write(file, changed)
        with self.assertRaises(ValueError):
            self.verify()
        self.write(file, {**value, "NSPrivacyTracking": True})
        with self.assertRaises(ValueError):
            self.verify()

    def test_preserves_alarm_permission_background_mode_and_bundle_identity(self):
        for change in [{"NSAlarmKitUsageDescription": ""}, {"UIBackgroundModes": []},
                       {"CFBundleIdentifier": "com.example.wrong"}, {"MinimumOSVersion": "25.0"}]:
            self.write(self.app / "Info.plist", {**self.info, **change})
            with self.assertRaises(ValueError):
                self.verify()


if __name__ == "__main__":
    unittest.main()
