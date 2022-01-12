module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
    'jest',
    'prefer-arrow',
    'prettier',
    'react',
    'react-hooks',
    'simple-import-sort',
    'sort-keys-fix',
  ],
  extends: [],
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true
    }
  },
  settings: {
    react: {
      version: 'detect'
    }
  },

  // Some of these rules were ported over from our common-ui/tslint.json file
  // The rules found here were ported and categorized using the tslint migration roadmap:
  // https://github.com/typescript-eslint/typescript-eslint/blob/master/packages/eslint-plugin/ROADMAP.md

  // The eslint rules can be found here: https://eslint.org/docs/rules/
  rules: {
    /* Code Quality */

    'constructor-super': 'warn',
    'curly': 'warn',
    'eqeqeq': ['warn', 'always', {'null': 'ignore'}],
    'guard-for-in': 'warn',
    'no-bitwise': 'warn',
    'no-caller': 'warn',
    'no-debugger': 'warn',
    'no-empty': 'warn',
    'no-eval': 'warn',
    'no-fallthrough': 'warn', // For switch statements
    'no-irregular-whitespace': 'warn',
    'no-new-wrappers': 'warn',
    'no-restricted-imports': ['error', {paths: ['rxjs'], patterns: ['../']}],
    'no-throw-literal': 'warn',
    'no-undef-init': 'warn',
    'no-var': 'warn',
    'radix': 'warn', // Add radix on parseInt
    // 'dot-notation': 'warn',  // 39 instances as of 3 Jan 2022
    // 'no-console': 'warn',  // 69 instances as of 3 Jan 2022
    // 'prefer-arrow/prefer-arrow-functions': ['warn'], // Lots of 'newable' functions in the code base
    // 'prefer-const': ['warn', {'destructuring': 'all'}],

    'no-use-before-define': 'off', // Needed for the below rule
    '@typescript-eslint/no-use-before-define': 'warn',

    '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
    '@typescript-eslint/explicit-member-accessibility': 'off',
    '@typescript-eslint/no-empty-interface': 'warn',
    '@typescript-eslint/no-inferrable-types': ['warn', {ignoreParameters: true}],
    '@typescript-eslint/no-misused-new': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-shadow': 'warn',
    '@typescript-eslint/unified-signatures': 'warn',
    // '@typescript-eslint/member-ordering': ['warn', { 'classExpressions': ['method', 'field'] }],
    // 'no-unused-vars': 'off', // Needed for the below rule
    // '@typescript-eslint/no-unused-vars': 'warn', // 271 instances as of 3 Jan 2022

    'react/jsx-uses-vars': 'warn',
    'react-hooks/rules-of-hooks': 'warn',
    // 'react-hooks/exhaustive-deps': 'warn',  // 45 instances as of 3 Jan 2022

    /* Style */

    // 'prettier/prettier': 'warn', // Possibly use prettier to handle some formatting

    'eol-last': 'warn',
    'max-len': ['warn', {code: 140, ignorePattern: '^import |^export\\{(.*?)\\}', ignoreComments: true}],
    'no-trailing-spaces': 'warn',
    'quotes': ['warn', 'single'],
    // 'brace-style': ['warn', '1tbs'],
    // 'no-multi-spaces': 'warn',
    // 'simple-import-sort/sort': 'warn',
    // 'space-before-function-paren': ['warn', { 'anonymous': 'never', 'named': 'never', 'asyncArrow': 'always' }],
    // 'spaced-comment': 'warn',

    '@typescript-eslint/type-annotation-spacing': 'warn',
    '@typescript-eslint/prefer-function-type': 'warn',
    // '@typescript-eslint/semi': 'warn',

    'react/jsx-curly-spacing': ["warn", {'when': 'never'}],

    /* Jest */
    'jest/no-focused-tests': 'warn',
  }
};
