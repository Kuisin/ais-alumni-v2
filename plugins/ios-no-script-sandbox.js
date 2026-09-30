/**
 * Xcode's user script sandboxing (ENABLE_USER_SCRIPT_SANDBOXING, on in new
 * projects and after "Update to recommended settings") stops React Native's
 * and Expo's build scripts from writing into the app — e.g. "Sandbox: bash
 * deny file-write-create …/AISAlumni.app/ip.txt" (Metro's address for
 * debug builds). Turn it off in every build configuration.
 */
const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withIosNoScriptSandbox(config) {
  return withXcodeProject(config, (c) => {
    const configs =
      c.modResults.hash.project.objects.XCBuildConfiguration ?? {};
    for (const entry of Object.values(configs)) {
      if (typeof entry === "object" && entry.buildSettings)
        entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
    }
    return c;
  });
};
