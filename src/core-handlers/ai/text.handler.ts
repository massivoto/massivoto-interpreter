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
import type { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../handlers/index.js'
import { AiProviderRegistry } from './providers/ai-provider-registry.js'

// R-AIC-42: TextHandler accepts gemini (openai/anthropic future)
const TEXT_ACCEPTED_PROVIDERS: AiProviderName[] = ['gemini', 'openai', 'anthropic']

export class TextHandler extends BaseCommandHandler<string> {
  readonly type = 'command' as const
  override readonly acceptedProviders = TEXT_ACCEPTED_PROVIDERS

  private registry: AiProviderRegistry

  constructor(registry?: AiProviderRegistry) {
    super('@ai/text')
    this.registry = registry ?? new AiProviderRegistry()
  }

  // R-PC-08: backward-compatible test hook delegates to registry
  setProvider(name: string, provider: AiProvider): void {
    this.registry.set(name, provider)
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
      // R-PC-04: Use centralized registry instead of duplicated provider logic
      const provider = this.registry.get(args.provider, this.acceptedProviders!, context)

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
}
