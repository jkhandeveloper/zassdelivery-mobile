const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Generated native projects and bundler output are not source.
    ignores: ["dist/*", "android/*", "ios/*", ".expo/*"],
  },
  {
    /**
     * The copied data layer answers to the web app's lint config, not this one.
     *
     * These files are byte-identical to `/var/www/zassdeliver-frontend/src` and
     * `scripts/check-api-drift.sh` fails the build if they stop being. So a
     * stylistic warning here is not a defect to fix — "fixing" it would create
     * the very drift the check exists to prevent, and the same edit would have
     * to be made twice forever.
     *
     * Both rules disabled below are style, not correctness:
     *
     * - `no-redeclare` fires on `const Role = {...} as const` paired with
     *   `type Role = ...`. That is the standard TypeScript idiom for an
     *   enum-like value that is also a type, and the redeclaration is the
     *   entire point of it.
     * - `array-type` prefers `T[]` over `Array<T>`. The web app uses
     *   `Array<...>` for long inline object members, where it reads better.
     */
    files: ["src/types/**/*.ts", "src/lib/api/**/*.ts", "src/hooks/**/*.ts", "src/lib/*.ts"],
    rules: {
      "@typescript-eslint/no-redeclare": "off",
      "@typescript-eslint/array-type": "off",
    },
  },
]);
