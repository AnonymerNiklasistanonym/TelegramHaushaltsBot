module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2020: true
    },
    extends: [
        'plugin:promise/recommended',
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking"
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: [
            "tsconfig.json",
        ],
        sourceType: "module"
    },
    plugins: [
        'promise',
        "jsdoc",
        "@typescript-eslint",
        "prefer-arrow"
    ],
    rules: {
        '@typescript-eslint/array-type': 'error',
        '@typescript-eslint/indent': 'error',
        '@typescript-eslint/member-delimiter-style': [
            'error',
            {
                multiline: {
                    delimiter: 'none',
                    requireLast: true
                },
                singleline: {
                    delimiter: 'semi',
                    requireLast: false
                }
            }
        ],
        '@typescript-eslint/restrict-template-expressions': ['error', { allowBoolean: true }],
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-floating-promises': 'error',
        '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: false }],
        '@typescript-eslint/no-parameter-properties': 'off',
        '@typescript-eslint/no-use-before-define': 'error',
        '@typescript-eslint/prefer-for-of': 'error',
        '@typescript-eslint/prefer-function-type': 'error',
        '@typescript-eslint/quotes': ['error', 'double'],
        '@typescript-eslint/semi': 'error',
        '@typescript-eslint/unified-signatures': 'error',
        'require-await': 'error'
    }
}
