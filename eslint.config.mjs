import nextVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const storageRestriction = [
  "error",
  { name: "localStorage", message: "Use the data/local store (LLD 0.3)." },
  { name: "sessionStorage", message: "Use the data/local store (LLD 0.3)." },
];

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      ".tools/**",
      "src/components/ui/**",
      "next-env.d.ts",
    ],
  },
  ...nextVitals,
  ...tseslint.configs.strictTypeChecked.map((c) => ({ ...c, files: ["**/*.{ts,tsx,mts}"] })),
  {
    files: ["**/*.{ts,tsx,mts}"],
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": ["error", { max: 40, skipBlankLines: true, skipComments: true }],
      "max-params": ["error", 5],
      "max-lines": ["error", { max: 300, skipBlankLines: true, skipComments: true }],
      "no-console": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-restricted-globals": storageRestriction,
    },
  },
  {
    files: ["**/*.tsx"],
    rules: {
      "max-lines-per-function": ["error", { max: 80, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    files: ["src/components/ui/**", "src/data/seed/seed.json"],
    rules: { "max-lines": "off", "max-lines-per-function": "off", complexity: "off" },
  },
  {
    files: ["src/data/local/**", "src/features/feedback-form/draft.ts"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    files: ["scripts/**", "*.config.{ts,mjs}", "tests/**"],
    rules: { "no-console": "off" },
  },
];

export default eslintConfig;
