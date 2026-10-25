/**
 * SDK 58's AppDelegate template has no application(_:open:options:): under
 * the scene life cycle SceneDelegate (expo's ExpoAppSceneDelegate) receives
 * opened URLs and forwards them to AppDelegate. @xmartlabs/react-native-line
 * hooks LINE's sign-in callback into that method and fails prebuild without
 * it, so this adds it back as SDK 57's template had it. Listed after the
 * LINE plugin in app.config.ts: mods run in reverse order, so this one runs
 * first. Remove once the LINE plugin supports the SDK 58 template.
 */
const { withAppDelegate } = require("expo/config-plugins");

const OPEN_URL = `
  // Linking API (LINE sign-in hooks in here: plugins/ios-open-url.js)
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }
`;

const DECLARATION =
  "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {";

module.exports = function withIosOpenUrl(config) {
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== "swift")
      throw new Error("ios-open-url: expected a Swift AppDelegate");
    const src = c.modResults.contents;
    if (/func application\(\s*_ app: UIApplication,\s*open url: URL/.test(src))
      return c;
    const end = src.indexOf("\n}\n", src.indexOf(DECLARATION));
    if (!src.includes(DECLARATION) || end < 0)
      throw new Error(
        "ios-open-url: AppDelegate.swift isn't the SDK 58 template; " +
          "check whether this plugin is still needed.",
      );
    c.modResults.contents = `${src.slice(0, end)}\n${OPEN_URL.trimEnd()}${src.slice(end)}`;
    return c;
  });
};
