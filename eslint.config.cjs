const js = require('@eslint/js')
const { defineFlatConfig } = require('eslint-define-config')
const configPrettier = require('eslint-config-prettier')
const pluginPrettier = require('eslint-plugin-prettier')

module.exports = defineFlatConfig([
  {
    ...js.configs.recommended,
    ignores: ['**/.*', 'dist/*'],
    plugins: {
      prettier: pluginPrettier
    },
    rules: {
      ...configPrettier.rules,
      ...pluginPrettier.configs.recommended.rules,
      'no-debugger': 'off',
      'no-unused-vars': 'off',
      'prettier/prettier': [
        'error',
        {
          endOfLine: 'auto'
        }
      ]
    }
  }
])
