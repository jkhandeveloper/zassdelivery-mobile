const fs = require("fs");

/**
 * Where Firebase's Android config is, if this build can use it.
 *
 * Downloaded from the Firebase console and placed at the project root, or
 * pointed to with `GOOGLE_SERVICES_JSON`.
 *
 * Returned only when it lists the package being built. Each variant has its
 * own package name, and the Google Services Gradle plugin fails the whole
 * build on a file with no matching client — so a file covering only the
 * production app would otherwise break every dev and preview build. Without
 * it the app builds and runs as before, with push switched off.
 */
function googleServicesFile(packageName) {
  const path = process.env.GOOGLE_SERVICES_JSON || "./google-services.json";

  if (!fs.existsSync(path)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(path, "utf8"));

    const covered = (parsed.client ?? []).some(
      (client) => client.client_info?.android_client_info?.package_name === packageName,
    );

    if (!covered) {
      console.warn(
        `google-services.json has no Android app for ${packageName}; building without push. ` +
          "Add that package to the Firebase project and download the file again.",
      );
    }

    return covered ? path : undefined;
  } catch {
    console.warn("google-services.json could not be read; building without push.");

    return undefined;
  }
}

module.exports = { googleServicesFile };
