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
    // Output read by a human, in a terminal or a Vercel build log, rather than
    // by a log aggregator — which is what the app logger's structured JSON is
    // aimed at and what would make these worse. `migrate-on-deploy` also runs
    // before the app is built and should not import from it at all; the other
    // two are operator scripts whose entire purpose is the report they print.
    files: [
      "scripts/migrate-on-deploy.ts",
      "scripts/count-shared-income.ts",
      "scripts/backfill-personal-amounts.ts",
    ],
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

    // Playwright's own output. `playwright-report` is 2.3MB of bundled
    // JavaScript, and linting it turned `pnpm lint` from seconds into a hang
    // for anybody who had run the suite even once.
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
  ]),
]);

export default eslintConfig;
