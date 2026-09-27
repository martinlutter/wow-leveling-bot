// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';
import jestPlugin from 'eslint-plugin-jest';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      'cdk.out',
      'dist',
      'eslint.config.mjs',
      'jest.config.js',
    ],
  },
  eslint.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['tests/**'],
    plugins: { jest: jestPlugin },
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      'jest/unbound-method': 'error',
    },
  },
);
