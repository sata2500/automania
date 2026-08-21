import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // One-off diagnostics are retained for history but are not application code.
    "test.mjs",
    "temp_check_urls.js",
    "fix_mime.js",
    "refactor.js",
    "get-etsy-data.js",
    "scratch/**",
  ]),
]);

export default eslintConfig;
