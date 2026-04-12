/**
 * AiProviderRegistry - centralized AI provider instance cache.
 *
 * R-PC-01: get/set/clear API
 * R-PC-02: resolves via AiProviderConfig or env fallback
 * R-PC-03: caches instances by provider name
 * R-PAR-07: No acceptedProviders filtering, supports unknown providers
 */
import type { AiProvider, AiProviderConfig } from '@massivoto/kit'
import { deriveApiKeyName, resolveProvider } from '@massivoto/kit'
import { createAiProvider } from './create-ai-provider.js'

export class AiProviderRegistry {
  private cache: Map<string, AiProvider> = new Map()

  /**
   * Get or create a provider instance.
   *
   * Resolution order:
   * 1. Return cached instance if one exists for the resolved name
   * 2. If aiConfig is available, use resolveProvider() to pick the first configured provider
   * 3. Otherwise fall back to env-var-based creation
   *
   * @param providerHint - explicit provider name from command args (e.g. "gemini"), or undefined for auto-resolve
   * @param context - aiConfig and env from ExecutionContext
   */
  get(
    providerHint: string | undefined,
    context: { aiConfig?: AiProviderConfig; env?: Record<string, string | undefined> },
  ): AiProvider {
    const resolvedName = providerHint ?? this.resolveProviderName(context)
    const cached = this.cache.get(resolvedName)
    if (cached) return cached

    if (context.aiConfig) {
      const resolved = resolveProvider(context.aiConfig)
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
    context: { aiConfig?: AiProviderConfig },
  ): string {
    if (context.aiConfig && context.aiConfig.providers.length > 0) {
      const resolved = resolveProvider(context.aiConfig)
      return resolved.name
    }
    return 'gemini'
  }

  private fallbackCreate(
    providerName: string,
    env?: Record<string, string | undefined>,
  ): AiProvider {
    const keyName = deriveApiKeyName(providerName)
    const apiKey = env?.[keyName] || process.env[keyName]
    if (!apiKey) {
      throw new Error(
        `Missing ${keyName} environment variable. Copy env.dist to .env and add your API key.`,
      )
    }

    const provider = createAiProvider(providerName, apiKey)
    this.cache.set(providerName, provider)
    return provider
  }
}
