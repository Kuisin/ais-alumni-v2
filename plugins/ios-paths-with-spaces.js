/**
 * Local iOS builds from a folder whose path has spaces or parentheses
 * (e.g. "/Volumes/Main Storage (4TB)/…"): two generated build scripts run a
 * path without quotes and fail — "syntax error near unexpected token `('"
 * (expo-constants) and "/Volumes/Main: No such file or directory" (bundling
 * React Native). This quotes both; builds elsewhere (EAS) are unaffected.
 *
 * expo-constants' script still reads the path unquoted inside, so from such
 * a folder it skips embedding app.config: development builds don't need it
 * (they load the config from Metro); make release builds with EAS Build.
 */
const { withPodfile, withXcodeProject } = require("expo/config-plugins");

const MARKER = "# ios-paths-with-spaces";

/** CocoaPods writes expo-constants' script phase; fix it after install. */
function withQuotedConstantsScript(config) {
  return withPodfile(config, (c) => {
    const src = c.modResults.contents;
    const hook = "post_install do |installer|\n";
    if (src.includes(MARKER)) return c;
    if (!src.includes(hook))
      throw new Error("ios-paths-with-spaces: no post_install in the Podfile");
    c.modResults.contents = src.replace(
      hook,
      `${hook}    ${MARKER} (plugins/ios-paths-with-spaces.js)
    installer.pods_project.targets.each do |target|
      target.shell_script_build_phases.each do |phase|
        phase.shell_script = phase.shell_script.sub(
          '"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh"',
          %q("'$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh'"),
        )
      end
    end
`,
    );
    return c;
  });
}

/** The app target's "Bundle React Native code and images" phase. */
function withQuotedBundleScript(config) {
  return withXcodeProject(config, (c) => {
    const phases =
      c.modResults.hash.project.objects.PBXShellScriptBuildPhase ?? {};
    for (const phase of Object.values(phases)) {
      if (typeof phase !== "object" || typeof phase.shellScript !== "string")
        continue;
      // `"$NODE_BINARY" --print "…/react-native-xcode.sh"` → "$(…)"
      phase.shellScript = phase.shellScript.replace(
        /`(\\"\$NODE_BINARY\\" --print \\"[^`]*react-native-xcode\.sh'\\")`/,
        '\\"$($1)\\"',
      );
    }
    return c;
  });
}

module.exports = function withIosPathsWithSpaces(config) {
  return withQuotedBundleScript(withQuotedConstantsScript(config));
};
