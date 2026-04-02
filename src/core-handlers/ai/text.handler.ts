/**
 * TextHandler - @ai/text
 *
 * Generates text using an AI provider (Gemini by default).
 *
 * R-AI-10: Implement text.handler.ts accepting required args: prompt, output
 * R-AI-11: Support optional args: provider, model, temperature, maxTokens, system
 * R-AI-12: Resolve {expressions} in prompt (done by interpreter before handler)
 * R-AI-13: Store generated text in output variable via ExecutionContext
 * R-AI-14: Return cost metadata (tokens used) in instruction result
 */
import type { AiProvider, AiProviderName } from '@massivoto/kit'
import { resolveProvider } from '@massivoto/auth-domain'
import { createAiProvider } from './providers/create-ai-provider.js'
import type { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../handlers/index.js'

// R-AIC-42: TextHandler accepts gemini (openai/anthropic future)
const TEXT_ACCEPTED_PROVIDERS: AiProviderName[] = ['gemini', 'openai', 'anthropic']

export class TextHandler extends BaseCommandHandler<string> {
  readonly type = 'command' as const
  override readonly acceptedProviders = TEXT_ACCEPTED_PROVIDERS

  private providers: Map<string, AiProvider> = new Map()

  constructor() {
    super('@ai/text')
  }

  // R-AIC-63: test hook remains for unit testing
  setProvider(name: string, provider: AiProvider): void {
    this.providers.set(name, provider)
  }

  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<string>> {
    // R-AI-10: Validate required prompt argument
    const prompt = args.prompt
    if (prompt === undefined || prompt === null || prompt === '') {
      return this.handleFailure('Prompt is required', 'Prompt is required')
    }

    // R-AI-11: Get optional arguments with defaults
    const temperature: number = args.temperature ?? 0.7
    const maxTokens: number | undefined = args.maxTokens
    const system: string | undefined = args.system
    const model: string | undefined = args.model

    try {
      // R-AIC-43: Use centralized resolution instead of duplicated getApiKey/createProvider
      const provider = this.getOrCreateProvider(args.provider, context)

      // R-AI-12: Prompt expression resolution is done by interpreter before handler
      const result = await provider.generateText({
        prompt,
        model,
        temperature,
        maxTokens,
        system,
      })

      // R-AI-13: Return generated text as value (interpreter stores in output variable)
      // R-AI-14: Return cost metadata
      return {
        success: true,
        value: result.text,
        message: `Generated text (${result.tokensUsed} tokens)`,
        messages: [`Generated text (${result.tokensUsed} tokens)`],
        cost: result.tokensUsed,
      }
    } catch (error) {
      // R-AI-43: Handle provider errors gracefully
      const errorMessage =
        error instanceof Error ? error.message : String(error)
      return this.handleFailure(errorMessage, errorMessage)
    }
  }

  private getOrCreateProvider(
    providerArg: string | undefined,
    context: ExecutionContext,
  ): AiProvider {
    // If a test-injected provider exists, use it
    const resolvedName = providerArg ?? this.resolveProviderName(context)
    const cached = this.providers.get(resolvedName)
    if (cached) return cached

    // Use centralized resolution from auth-domain
    if (!context.aiConfig) {
      // Fallback for backward compatibility: build config from context.env
      return this.fallbackCreateProvider(resolvedName, context)
    }

    const resolved = resolveProvider(context.aiConfig, this.acceptedProviders!)
    const provider = createAiProvider(resolved.name, resolved.apiKey)
    this.providers.set(resolved.name, provider)
    return provider
  }

  private resolveProviderName(context: ExecutionContext): string {
    if (context.aiConfig && context.aiConfig.providers.length > 0) {
      const resolved = resolveProvider(context.aiConfig, this.acceptedProviders!)
      return resolved.name
    }
    return 'gemini'
  }

  private fallbackCreateProvider(
    providerName: string,
    context: ExecutionContext,
  ): AiProvider {
    const validProviders: AiProviderName[] = ['gemini', 'openai', 'anthropic']
    if (!validProviders.includes(providerName as AiProviderName)) {
      throw new Error(
        `Unknown provider "${providerName}". Valid options: ${validProviders.join(', ')}`,
      )
    }

    const keyMap: Record<string, string> = {
      gemini: 'GEMINI_API_KEY',
      openai: 'OPENAI_API_KEY',
      anthropic: 'ANTHROPIC_API_KEY',
    }
    const keyName = keyMap[providerName]
    const apiKey = context.env?.[keyName] || process.env[keyName]
    if (!apiKey) {
      throw new Error(
        `Missing ${keyName} environment variable. Copy env.dist to .env and add your API key.`,
      )
    }

    const provider = createAiProvider(providerName as AiProviderName, apiKey)
    this.providers.set(providerName, provider)
    return provider
  }
}
