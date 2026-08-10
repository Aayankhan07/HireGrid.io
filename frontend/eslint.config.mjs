import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsxA11y from "eslint-plugin-jsx-a11y";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // next/core-web-vitals already registers the jsx-a11y plugin but enables only
  // a subset of its rules. Spread the recommended ruleset in without
  // re-declaring the plugin (which ESLint rejects as a redefinition). These are
  // the rules that catch unlabelled form controls, click handlers on
  // non-interactive elements, and icon-only buttons with no accessible name --
  // all of which this codebase previously shipped.
  {
    files: ["src/**/*.{js,jsx,ts,tsx}"],
    rules: jsxA11y.flatConfigs.recommended.rules,
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
