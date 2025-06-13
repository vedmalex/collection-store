import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginQwik from "eslint-plugin-qwik";

export default tseslint.config(
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json', './packages/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      qwik: pluginQwik,
    },
    rules: {
      // React rules
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
      // Qwik rules
      "qwik/no-react-specific-props": "off",
      "qwik/no-missing-qwik-imports": "off",
      "qwik/no-async-client-event": "off",
      // TypeScript rules
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      // General rules
      "no-unused-vars": "off",
      "no-constant-condition": "off",
      "no-inner-declarations": "off",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
  {
    ignores: [
      "dist/**",
      "types/**",
      "node_modules/**",
      "coverage/**",
      "**/*.js",
      "**/*.cjs",
      "**/*.mjs",
      "packages/qwik-test-app/src/entry.ssr.tsx",
    ],
  },
);