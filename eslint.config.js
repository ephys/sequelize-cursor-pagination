import { basePreset } from "@ephys/eslint-config-typescript";

export default [
  ...basePreset(`${import.meta.dirname}/tsconfig.json`),
  {
    rules: {
      "import/no-duplicates": "off",
      "import/no-extraneous-dependencies": "off",
    },
  },
];
