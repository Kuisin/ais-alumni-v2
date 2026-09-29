/**
 * iOS 27 SDK (Xcode 27): an app that hasn't adopted the UIScene life cycle
 * stops at launch (UIKit asserts in
 * _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption). Expo
 * adopted it in its project template after SDK 57 (expo/expo#46734); this
 * applies the same change to the SDK 57 template when the native project is
 * generated (prebuild, EAS Build):
 *  - Info.plist declares a single window scene handled by SceneDelegate;
 *  - SceneDelegate (expo's ExpoAppSceneDelegate) creates the window and
 *    starts React Native, so AppDelegate no longer does, and passes links,
 *    notification taps and life-cycle events on to AppDelegate.
 * Remove when upgrading to an SDK whose template has SceneDelegate.swift.
 */
const { withAppDelegate, withInfoPlist } = require("expo/config-plugins");

const SCENE_DELEGATE = `
@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {
  // Extension point for config plugins.
}
`;

// The SDK 57 template's AppDelegate starts React Native in its own window.
const START_IN_APP_DELEGATE =
  /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/;

function withSceneManifest(config) {
  return withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: "Default Configuration",
            UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate",
          },
        ],
      },
    };
    return c;
  });
}

function withSceneDelegate(config) {
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== "swift")
      throw new Error("ios-scene-lifecycle: expected a Swift AppDelegate");
    let src = c.modResults.contents;
    if (src.includes("class SceneDelegate")) return c;
    const declaration = "class AppDelegate: ExpoAppDelegate {";
    if (!src.includes(declaration) || !START_IN_APP_DELEGATE.test(src))
      throw new Error(
        "ios-scene-lifecycle: AppDelegate.swift isn't the SDK 57 template; " +
          "check whether this plugin is still needed.",
      );
    src = src
      .replace(
        declaration,
        "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {",
      )
      .replace(
        START_IN_APP_DELEGATE,
        "\n    // SceneDelegate creates the window and starts React Native.\n",
      );
    c.modResults.contents = `${src.trimEnd()}\n${SCENE_DELEGATE}`;
    return c;
  });
}

module.exports = function withIosSceneLifecycle(config) {
  return withSceneDelegate(withSceneManifest(config));
};
