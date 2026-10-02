import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import eslintReact from '@eslint-react/eslint-plugin'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import { defineConfig, globalIgnores } from 'eslint/config'

const typescriptFiles = [
  'doorbell-frontend/**/*.{ts,tsx}',
  'doorbell-backend/**/*.ts',
]

export default defineConfig([
  globalIgnores(['**/dist/**']),
  {
    files: typescriptFiles,
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['doorbell-frontend/**/*.{ts,tsx}'],
    extends: [
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      eslintReact.configs['recommended-typescript'],
    ],
  },
  {
    files: typescriptFiles,
    extends: [eslintPluginPrettierRecommended],
  },
])
