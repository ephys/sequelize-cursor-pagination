import { basePreset } from "@ephys/eslint-config-typescript";

export default [
  ...basePreset(`${import.meta.dirname}/tsconfig.json`),
  {
    rules: {
      "@typescript-eslint/promise-function-async": "off",
      "import/no-duplicates": "off",
      "import/no-extraneous-dependencies": "off",
    },
  },
];
