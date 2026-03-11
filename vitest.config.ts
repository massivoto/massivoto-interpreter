import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@massivoto/kit': path.resolve(__dirname, '../massivoto-platform/packages/kit/dist/index.js'),
    },
  },
  test: {
    globals: false,
  },
})
