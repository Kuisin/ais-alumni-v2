/**
 * Local iOS builds from a folder whose path has spaces or parentheses
 * (e.g. "/Volumes/Main Storage (4TB)/…"): two generated build scripts run a
 * path without quotes and fail — "syntax error near unexpected token `('"
 * (expo-constants) and "/Volumes/Main: No such file or directory" (bundling
 * React Native). This fixes both; builds elsewhere (EAS) are unaffected.
 *
 * expo-constants' get-app-config-ios.sh also runs `basename $PROJECT_DIR`
 * unquoted, so from such a folder it silently skipped embedding app.config
 * and release builds crashed on launch ("expo-linking needs access to the
 * expo-constants manifest"). Its phase now runs the same steps, quoted.
 */
const { withPodfile, withXcodeProject } = require("expo/config-plugins");

const MARKER = "# ios-paths-with-spaces v2";

/** get-app-config-ios.sh for the pod target, with every path quoted. */
const CONSTANTS_SCRIPT = `set -eo pipefail
PKG="$PODS_TARGET_SRCROOT/.."
if [ "$BUNDLE_FORMAT" = "deep" ]; then
  DEST="$CONFIGURATION_BUILD_DIR/EXConstants.bundle/Contents/Resources"
  mkdir -p "$DEST"
else
  DEST="$CONFIGURATION_BUILD_DIR/EXConstants.bundle"
fi
"$PKG/scripts/with-node.sh" "$PKG/scripts/getAppConfig.js" "$PROJECT_DIR/../.." "$DEST"
`;

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
        next unless phase.shell_script.include?("get-app-config-ios.sh")
        phase.shell_script = <<~'EXCONSTANTS'
${CONSTANTS_SCRIPT.trimEnd().replace(/^/gm, "          ")}
        EXCONSTANTS
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
