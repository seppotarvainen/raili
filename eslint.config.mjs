// @ts-check
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // ── Global ignores ──
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "reports/**",
      "node_modules/**",
      "scripts/**",
      "src/cli/generatedDocs.ts",
    ],
  },

  // ── Base: ESLint recommended ──
  eslint.configs.recommended,

  // ── TypeScript: strict + type-aware ──
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // ── Parser & type-aware settings ──
  {
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.eslint.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ── Source code rules ──
  {
    files: ["src/**/*.ts"],
    rules: {
      // ── Strict safety ──
      eqeqeq: ["error", "always"],
      curly: ["error", "all"],
      "no-else-return": "error",
      "no-throw-literal": "off", // handled by typescript-eslint
      "@typescript-eslint/only-throw-error": "error",

      // ── Promise safety (critical for async runner) ──
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",

      // ── No any leakage ──
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-call": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/no-unsafe-argument": "error",

      // ── Explicit contracts ──
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",

      // ── Switch exhaustiveness (state type routing) ──
      "@typescript-eslint/switch-exhaustiveness-check": "error",

      // ── Clean code ──
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/prefer-nullish-coalescing": "error",
      "@typescript-eslint/prefer-optional-chain": "error",
      "@typescript-eslint/no-unnecessary-condition": "error",
      "@typescript-eslint/no-unnecessary-type-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],

      // ── No console (use presenter for output) ──
      "no-console": ["warn", { allow: ["error"] }],

      // ── Naming conventions ──
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
      ],
    },
  },

  // ── Test file overrides (relaxed) ──
  // Tests are mock-heavy by nature; enforce structure, not type purity.
  {
    files: ["__tests__/**/*.ts"],
    rules: {
      // Type safety — off for tests (mocking produces `any` everywhere)
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-argument": "off",

      // Contracts — not useful in tests
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/naming-convention": "off",
      "@typescript-eslint/consistent-type-definitions": "off",

      // Assertions & optional patterns — off for test convenience
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unnecessary-condition": "off",
      "@typescript-eslint/no-unnecessary-type-assertion": "off",
      "@typescript-eslint/no-confusing-void-expression": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-empty-function": "off",
      "@typescript-eslint/dot-notation": "off",
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/non-nullable-type-assertion-style": "off",

      // Allow require() for jest.mock patterns
      "@typescript-eslint/no-require-imports": "off",

      // Allow console in tests
      "no-console": "off",

      // Keep useful rules ON in tests
      // eqeqeq, no-unused-vars (with underscore pattern), curly
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  }
);

