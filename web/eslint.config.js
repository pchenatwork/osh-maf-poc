import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

const FHIR_R4 = {
  name: "fhir/r4",
  message:
    "Import FHIR types from item-controls/contract.ts — one version-change point.",
};

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },

  // Rule 1: The engine stays domain-agnostic.
  //
  // Flat config REPLACES rule options rather than merging them, and this block
  // matches a subset of the one above. It must therefore restate FHIR_R4, or
  // renderer/ would silently lose the single-import-point guard.
  {
    files: ["src/renderer/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [FHIR_R4],
          patterns: [
            {
              // Both the barrel ("../item-controls/osh") and anything inside
              // it. A bare "**/osh/**" misses the barrel, which is the form
              // a caller is most likely to reach for.
              group: [
                "**/item-controls/osh",
                "**/item-controls/osh/**",
                "**/osh",
                "**/osh/**",
              ],
              message:
                "renderer/ must stay domain-agnostic. Register an item control instead.",
            },
          ],
        },
      ],
    },
  },

  // Rule 2: FHIR types enter through exactly one file.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/item-controls/contract.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [FHIR_R4] }],
    },
  },
]);
