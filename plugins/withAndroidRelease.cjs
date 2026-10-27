const { withAppBuildGradle } = require('@expo/config-plugins');

const SIGNING = `
// ScrollSnooze release signing. Passwords are read at build time, never written to source.
def scrollsnoozeSigningNames = ["SCROLLSNOOZE_UPLOAD_STORE_FILE", "SCROLLSNOOZE_UPLOAD_KEY_ALIAS", "SCROLLSNOOZE_UPLOAD_STORE_PASSWORD", "SCROLLSNOOZE_UPLOAD_KEY_PASSWORD"]
def scrollsnoozeSigning = scrollsnoozeSigningNames.collectEntries { [(it): System.getenv(it)] }
def scrollsnoozeSigned = scrollsnoozeSigning.values().every { it != null && !it.isBlank() }
def scrollsnoozeUnsignedReview = providers.gradleProperty("scrollsnooze.unsignedReview").orNull == "true"
android {
    signingConfigs {
        upload {
            if (scrollsnoozeSigned) {
                storeFile file(scrollsnoozeSigning["SCROLLSNOOZE_UPLOAD_STORE_FILE"])
                keyAlias scrollsnoozeSigning["SCROLLSNOOZE_UPLOAD_KEY_ALIAS"]
                storePassword scrollsnoozeSigning["SCROLLSNOOZE_UPLOAD_STORE_PASSWORD"]
                keyPassword scrollsnoozeSigning["SCROLLSNOOZE_UPLOAD_KEY_PASSWORD"]
            }
        }
    }
    buildTypes.release.signingConfig = scrollsnoozeSigned ? signingConfigs.upload : null
}
gradle.taskGraph.whenReady { graph ->
    def releaseRequested = graph.allTasks.any { it.project == project && it.name.toLowerCase().contains("release") }
    // EAS injects its own release signing config AFTER prebuild; inspect the final config.
    def actualSigning = android.buildTypes.release.signingConfig
    def actualStore = actualSigning?.storeFile
    def actualAlias = actualSigning?.keyAlias
    def uploadSigningReady = actualStore != null && actualStore.exists() && actualAlias != null && actualSigning.storePassword != null && actualSigning.keyPassword != null && actualStore.name != "debug.keystore" && !actualAlias.equalsIgnoreCase("androiddebugkey")
    if (releaseRequested && !uploadSigningReady && !scrollsnoozeUnsignedReview) {
        throw new GradleException("Release signing is missing or uses a debug key. Build with Expo EAS remote credentials, or set all SCROLLSNOOZE_UPLOAD_* environment variables for a local build. Debug signing is never used for release. For a non-uploadable inspection bundle only, use -Pscrollsnooze.unsignedReview=true.")
    }
}
`;

function configureRelease(contents) {
  const marker = '// ScrollSnooze release signing.';
  const index = contents.indexOf(marker);
  const clean = index < 0 ? contents : contents.slice(0, index);
  // Remove the template's debug fallback before installing the guarded signing config.
  const fixed = clean.replace(
    /(release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    '$1signingConfig = null',
  );
  if (!/buildTypes\s*\{/.test(fixed)) throw new Error('Android buildTypes block missing');
  return fixed.trimEnd() + '\n\n' + SIGNING.trim() + '\n';
}
module.exports = function withAndroidRelease(config) {
  return withAppBuildGradle(config, (mod) => {
    if (mod.modResults.language !== 'groovy') throw new Error('Release signing expects Groovy');
    mod.modResults.contents = configureRelease(mod.modResults.contents);
    return mod;
  });
};
module.exports.configureRelease = configureRelease;
