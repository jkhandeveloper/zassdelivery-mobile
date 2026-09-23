const { withGradleProperties, withProjectBuildGradle } = require("expo/config-plugins");

/**
 * Fixes to the generated android/ project that make a local release build
 * succeed. android/ is rewritten on every prebuild, so they have to live here
 * rather than as hand edits.
 */

/**
 * Pin every Android library module to the NDK React Native itself uses.
 *
 * Modules that do not declare `ndkVersion` (expo-updates, for one) fall back
 * to the Android Gradle Plugin's built-in default, which is a different NDK
 * from React Native's. Gradle then tries to download a second ~700 MB NDK in
 * the middle of the build — slow at best, and on a flaky link it fails with a
 * corrupt download. One NDK for everything avoids that.
 */
const NDK_MARKER = "// @generated with-android-build-fixes: uniform NDK";

const NDK_SNIPPET = `
${NDK_MARKER}
subprojects { sub ->
  sub.plugins.withId("com.android.library") {
    if (rootProject.hasProperty("ndkVersion")) {
      sub.android.ndkVersion = rootProject.ext.ndkVersion
    }
  }
}
`;

function withUniformNdk(config) {
  return withProjectBuildGradle(config, (mod) => {
    if (mod.modResults.language === "groovy" && !mod.modResults.contents.includes(NDK_MARKER)) {
      mod.modResults.contents += NDK_SNIPPET;
    }

    return mod;
  });
}

/**
 * The template's 512 MB Metaspace cap runs out while a release build compiles
 * ~40 Kotlin modules in one daemon ("Metaspace" / "Could not receive a message
 * from the daemon"). Class metadata, not heap, is what fills up.
 */
const JVM_ARGS = "-Xmx4096m -XX:MaxMetaspaceSize=1536m -XX:+HeapDumpOnOutOfMemoryError";

function withGradleMemory(config) {
  return withGradleProperties(config, (mod) => {
    const props = mod.modResults.filter(
      (item) => !(item.type === "property" && item.key === "org.gradle.jvmargs"),
    );

    props.push({ type: "property", key: "org.gradle.jvmargs", value: JVM_ARGS });
    mod.modResults = props;

    return mod;
  });
}

module.exports = function withAndroidBuildFixes(config) {
  return withGradleMemory(withUniformNdk(config));
};
