import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierRecommended from "eslint-plugin-prettier/recommended";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Disable ESLint rules that conflict with Prettier
  prettierRecommended,

  {
    plugins: {},

    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "warn",

      "no-debugger": "error",
      "no-var": "error",
      "prefer-const": "warn",
      "no-console": "warn",

      "react/react-in-jsx-scope": "off",
      "react-hooks/exhaustive-deps": "off",

      "@next/next/no-img-element": "warn",

      camelcase: "off",
    },
  },

  {
    // Build-time output, read by a human scrolling a Vercel build log. The app
    // logger's structured JSON is aimed at a log aggregator and would be worse
    // there, and this runs before the app is built — it should not import from
    // it either.
    files: ["scripts/migrate-on-deploy.ts"],
    rules: {
      "no-console": "off",
    },
  },

  {
    files: ["next.config.js", "postcss.config.js"],
    languageOptions: {
      parserOptions: {
        ecmaVersion: "latest",
      },
    },
  },

  globalIgnores([
    "node_modules/**",
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/components/ui/**",
  ]),
]);

export default eslintConfig;
