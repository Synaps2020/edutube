import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

const projectRules = {
  rules: {
    'commentaires-francais': {
      meta: {
        type: 'suggestion',
        schema: [],
        messages: { anglais: 'Écrivez ce commentaire en français, avec des mots simples.' },
      },
      create(context) {
        return {
          Program() {
            for (const comment of context.sourceCode.getAllComments()) {
              if (
                /\b(the|this|never|without|must|shared|scoped|normalized)\b/i.test(comment.value)
              ) {
                context.report({ loc: comment.loc, messageId: 'anglais' });
              }
            }
          },
        };
      },
    },
  },
};

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'docs/legacy/**'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: [
      'apps/web/**/*.{ts,tsx}',
      'apps/api/**/*.ts',
      'scripts/**/*.mjs',
      'packages/contracts/**/*.ts',
    ],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { projet: projectRules },
    rules: {
      'projet/commentaires-francais': 'error',
      'id-length': ['error', { min: 3, max: 32, properties: 'never', exceptions: ['id'] }],
      eqeqeq: ['error', 'always'],
      curly: ['error', 'all'],
      'prefer-const': 'error',
      'no-var': 'error',
      'no-self-compare': 'error',
      'no-duplicate-imports': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
);
