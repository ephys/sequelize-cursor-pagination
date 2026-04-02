import { basePreset } from '@ephys/eslint-config-typescript';

export default [
  {
    ignores: ['**/__snapshots__/**'],
  },
  ...basePreset(`${import.meta.dirname}/tsconfig.json`),
  {
    rules: {
      'import/no-duplicates': 'off',
      'import/no-extraneous-dependencies': 'off',
      'import/no-useless-path-segments': 'off',
    },
  },
];
