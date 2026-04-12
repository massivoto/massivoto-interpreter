/**
 * TextHandler - @ai/text
 *
 * Generates text using an AI provider. Provider is resolved and injected
 * by the interpreter via context.resolvedProvider.
 *
 * R-AI-10: Implement text.handler.ts accepting required args: prompt, output
 * R-AI-11: Support optional args: provider, model, temperature, maxTokens, system
 * R-AI-12: Resolve {expressions} in prompt (done by interpreter before handler)
 * R-AI-13: Store generated text in output variable via ExecutionContext
 * R-AI-14: Return cost metadata (tokens used) in instruction result
 * R-PAR-09: Extends AiCommandHandler, uses context.resolvedProvider
 */
import type { ActionResult, ExecutionContext } from '@massivoto/kit'
import { AiCommandHandler } from '../../handlers/index.js'

export class TextHandler extends AiCommandHandler<string> {
  readonly type = 'command' as const
  readonly capability = 'text' as const

  constructor() {
    super('@ai/text')
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

    try {
      // R-PAR-09: Provider is already resolved and injected by interpreter
      const provider = context.resolvedProvider!
      const model = args.model

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
