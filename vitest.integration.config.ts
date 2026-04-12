import { defineConfig } from 'vitest/config'
import path from 'path'
import fs from 'fs'
import { config as dotenvConfig } from 'dotenv'

const interpreterEnv = path.resolve(__dirname, '.env')
const projectEnv = path.resolve(__dirname, '../.env')
const envPath = fs.existsSync(interpreterEnv) ? interpreterEnv : projectEnv

dotenvConfig({ path: envPath })

export default defineConfig({
  resolve: {
    alias: {
      '@massivoto/kit': path.resolve(__dirname, '../massivoto-platform/packages/kit/dist/index.js'),
      '@massivoto/auth-domain': path.resolve(__dirname, '../massivoto-platform/packages/auth-domain/dist/index.js'),
    },
  },
  test: {
    globals: false,
    include: ['**/*.integration.spec.ts'],
  },
})
