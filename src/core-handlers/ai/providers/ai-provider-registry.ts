/**
 * AiProviderRegistry - centralized AI provider instance cache.
 *
 * Replaces the duplicated `providers: Map<string, AiProvider>` + getOrCreateProvider()
 * + fallbackCreateProvider() logic that was copy-pasted across TextHandler,
 * GenerateImageHandler, and ReverseImageHandler.
 *
 * R-PC-01: get/set/clear API
 * R-PC-02: resolves via AiProviderConfig or env fallback
 * R-PC-03: caches instances by provider name
 */
import type { AiProvider, AiProviderConfig, AiProviderName } from '@massivoto/kit'
import { AI_PROVIDER_KEY_NAMES } from '@massivoto/kit'
import { resolveProvider } from '@massivoto/auth-domain'
import { createAiProvider } from './create-ai-provider.js'

const VALID_PROVIDERS: AiProviderName[] = ['gemini', 'openai', 'anthropic']

export class AiProviderRegistry {
  private cache: Map<string, AiProvider> = new Map()

  /**
   * Get or create a provider instance.
   *
   * Resolution order:
   * 1. Return cached instance if one exists for the resolved name
   * 2. If aiConfig is available, use resolveProvider() to pick the best match
   * 3. Otherwise fall back to env-var-based creation
   *
   * @param providerHint - explicit provider name from command args (e.g. "gemini"), or undefined for auto-resolve
   * @param acceptedProviders - list of providers this handler supports
   * @param context - aiConfig and env from ExecutionContext
   */
  get(
    providerHint: string | undefined,
    acceptedProviders: AiProviderName[],
    context: { aiConfig?: AiProviderConfig; env?: Record<string, string | undefined> },
  ): AiProvider {
    const resolvedName = providerHint ?? this.resolveProviderName(acceptedProviders, context)
    const cached = this.cache.get(resolvedName)
    if (cached) return cached

    if (context.aiConfig) {
      const resolved = resolveProvider(context.aiConfig, acceptedProviders)
      const provider = createAiProvider(resolved.name, resolved.apiKey)
      this.cache.set(resolved.name, provider)
      return provider
    }

    return this.fallbackCreate(resolvedName, context.env)
  }

  /**
   * Inject a provider instance (primarily for testing).
   */
  set(name: string, provider: AiProvider): void {
    this.cache.set(name, provider)
  }

  /**
   * Clear all cached provider instances.
   */
  clear(): void {
    this.cache.clear()
  }

  private resolveProviderName(
    acceptedProviders: AiProviderName[],
    context: { aiConfig?: AiProviderConfig },
  ): string {
    if (context.aiConfig && context.aiConfig.providers.length > 0) {
      const resolved = resolveProvider(context.aiConfig, acceptedProviders)
      return resolved.name
    }
    return 'gemini'
  }

  private fallbackCreate(
    providerName: string,
    env?: Record<string, string | undefined>,
  ): AiProvider {
    if (!VALID_PROVIDERS.includes(providerName as AiProviderName)) {
      throw new Error(
        `Unknown provider "${providerName}". Valid options: ${VALID_PROVIDERS.join(', ')}`,
      )
    }

    const keyName = AI_PROVIDER_KEY_NAMES[providerName as AiProviderName]
    const apiKey = env?.[keyName] || process.env[keyName]
    if (!apiKey) {
      throw new Error(
        `Missing ${keyName} environment variable. Copy env.dist to .env and add your API key.`,
      )
    }

    const provider = createAiProvider(providerName as AiProviderName, apiKey)
    this.cache.set(providerName, provider)
    return provider
  }
}
