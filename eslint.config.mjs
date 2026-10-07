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
    // Serwist generates this service worker during production builds.
    "public/sw.js",
    "scratch/**",
  ]),
  {
    rules: {
      // `_` ile başlayan parametre/değişkenler kasıtlı olarak kullanılmıyor demektir.
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
      // Görseller çoğunlukla kullanıcıya ait blob:/data: URL'leri ve canvas çıktılarıdır;
      // next/image bunları optimize edemez, bu yüzden düz <img> bilinçli olarak kullanılır.
      "@next/next/no-img-element": "off",
      // React Compiler önerisi; mevcut "yüklemede senkronize et" efektleri davranış
      // riski olmadan kademeli olarak dönüştürülecek, o zamana kadar uyarı olarak görünür.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
