module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2020: true
    },
    extends: [
        'standard',
        'plugin:promise/recommended'
    ],
    plugins: [
        'promise'
    ],
    parserOptions: {
        ecmaVersion: 11
    },
    rules: {
        'require-await': 'error',
        indent: ['error', 4]
    }
}
