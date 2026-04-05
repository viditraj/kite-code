import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
  {
    // Ignore patterns (must be first)
    ignores: ['dist/**', 'node_modules/**', 'scripts/**'],
  },
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript handles unused vars better than ESLint
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // Allow explicit any in type assertions (we use it sparingly)
      '@typescript-eslint/no-explicit-any': 'off',

      // Consistent type imports
      '@typescript-eslint/consistent-type-imports': ['warn', {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
      }],

      // No console in library code (allow in CLI, screens, tests)
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // Prefer const
      'prefer-const': 'warn',

      // No var
      'no-var': 'error',
    },
  },
  {
    // Relaxed rules for test files
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Relaxed rules for CLI, screens, and REPL (needs console.log)
    files: [
      'src/entrypoints/**/*.ts',
      'src/screens/**/*.ts',
      'src/screens/**/*.tsx',
    ],
    rules: {
      'no-console': 'off',
    },
  },
]
