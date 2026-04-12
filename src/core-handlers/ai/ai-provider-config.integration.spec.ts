import { describe, it, expect, afterEach } from 'vitest'
import * as path from 'node:path'
import * as fs from 'node:fs'
import { resolveProvider } from '@massivoto/kit'
// loadAiConfig and loadEnvChain stay in auth-domain (config loading logic).
// This is why @massivoto/auth-domain is a devDependency: integration tests
// need the full config loading pipeline, but no production code depends on it.
import { loadAiConfig, loadEnvChain } from '@massivoto/auth-domain'
import { IntegrationEnv, skipIfNoRootEnv } from './test-utils/integration-env.js'
import { createAiProvider } from './providers/create-ai-provider.js'

/**
 * R-AIC-83: Integration test for AI provider credential resolution.
 * Uses real API keys from root .env to verify end-to-end text generation.
 *
 * Theme: Formula One Racing Workshop
 * Marco runs his F1 workspace with AI_PROVIDERS=gemini and a real Gemini API key.
 */

const ROOT_ENV_PATH = path.resolve(import.meta.dirname, '../../../.env')
const shouldSkip = skipIfNoRootEnv(ROOT_ENV_PATH)

describe.skipIf(shouldSkip)(
  'AI Provider Config Integration',
  () => {
    const integrationEnv = new IntegrationEnv(ROOT_ENV_PATH)

    afterEach(() => {
      integrationEnv.cleanup()
    })

    it('R-AIC-83: should load config, resolve gemini, and generate text', async () => {
      const env = integrationEnv.setup({
        keys: ['GEMINI_API_KEY'],
        extraVars: { AI_PROVIDERS: 'gemini' },
      })

      const config = loadAiConfig(env)
      expect(config.providers).toHaveLength(1)
      expect(config.providers[0].name).toBe('gemini')

      const resolved = resolveProvider(config, ['gemini'])
      expect(resolved.name).toBe('gemini')

      const provider = createAiProvider(resolved.name, resolved.apiKey)
      const result = await provider.generateText({
        prompt: 'Say "Monaco Grand Prix" and nothing else.',
        maxTokens: 20,
      })

      expect(result.text.length).toBeGreaterThan(0)
      expect(result.tokensUsed).toBeGreaterThan(0)
    }, 30_000)

    it('should load env from dotenv priority chain and validate', () => {
      const env = integrationEnv.setup({
        keys: ['GEMINI_API_KEY'],
        extraVars: { AI_PROVIDERS: 'gemini' },
      })

      const tempDir = integrationEnv.getTempDir()

      // Load env from the temp dir (simulates workspace/f1/.env)
      const loadedEnv = loadEnvChain(tempDir, tempDir)
      expect(loadedEnv.AI_PROVIDERS).toBe('gemini')
      expect(loadedEnv.GEMINI_API_KEY).toBeDefined()

      const config = loadAiConfig(loadedEnv)
      expect(config.providers[0].name).toBe('gemini')
    })

    it('should fail fast when AI_PROVIDERS lists a provider without a key', () => {
      integrationEnv.setup({
        keys: ['GEMINI_API_KEY'],
        extraVars: { AI_PROVIDERS: 'gemini,openai' },
      })

      // The setup copies GEMINI_API_KEY but NOT OPENAI_API_KEY
      const tempDir = integrationEnv.getTempDir()
      const loadedEnv = loadEnvChain(tempDir, tempDir)

      expect(() => loadAiConfig(loadedEnv)).toThrow('OPENAI_API_KEY is not set')
    })
  },
)
