import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'renderer-dist' },
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
})
