/**
 * GenerateImageHandler - @ai/image/generate
 *
 * Generates images from text prompts using an AI provider (Gemini/Imagen by default).
 * Supports {{variation}} template substitution for batch generation pipelines.
 *
 * R-GEN-21: Handler extending BaseCommandHandler<string> with id @ai/image/generate
 * R-GEN-22: Required args: prompt
 * R-GEN-23: Optional args: variation, model, size, style
 * R-GEN-24: Call provider.generateImage() and return base64 as ActionResult.value
 * R-GEN-25: API key from context.env or process.env
 */
import type { AiProvider, AiProviderName, ImageRequest } from '../types.js'
import { DEFAULT_AI_PROVIDER } from '../types.js'
import { AI_IMAGE_DEFAULTS, resolveModel } from '../defaults.js'
import { GeminiProvider } from '../providers/gemini.provider.js'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'

const SUPPORTED_PROVIDERS: AiProviderName[] = ['gemini', 'openai', 'anthropic']

// R-GEN-92: Minimal valid 1x1 transparent PNG (67 bytes)
const DUMMY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
  'Nl7BcQAAAABJRU5ErkJggg=='

export class GenerateImageHandler extends BaseCommandHandler<string> {
  readonly type = 'command' as const

  private providers: Map<string, AiProvider> = new Map()

  constructor() {
    super('@ai/image/generate')
  }

  setProvider(name: string, provider: AiProvider): void {
    this.providers.set(name, provider)
  }

  // R-GEN-92: Static dummy image for testing and CI
  static buildDummyImage(): string {
    return DUMMY_PNG_BASE64
  }

  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<string>> {
    // R-GEN-22: Validate required prompt argument
    const prompt = args.prompt
    if (prompt === undefined || prompt === null || prompt === '') {
      return this.handleFailure('Prompt is required', 'Prompt is required')
    }

    const modelArg: string | undefined = args.model
    const providerName: string = DEFAULT_AI_PROVIDER
    const size: ImageRequest['size'] = args.size ?? AI_IMAGE_DEFAULTS.size
    const style: ImageRequest['style'] = args.style ?? AI_IMAGE_DEFAULTS.style
    const variation: string | undefined = args.variation

    // R-GEN-91: Dummy model short-circuits before any API call
    if (modelArg === 'dummy') {
      return this.handleSuccess('Image generated (dummy mode)', GenerateImageHandler.buildDummyImage())
    }

    // R-GEN-25: API key validation
    const apiKey = this.getApiKey(providerName, context)
    if (!apiKey) {
      const msg = 'Missing GEMINI_API_KEY environment variable. Copy env.dist to .env and add your API key.'
      return this.handleFailure(msg, msg)
    }

    // Validate provider
    if (!SUPPORTED_PROVIDERS.includes(providerName as AiProviderName)) {
      const msg = `Unknown provider "${providerName}". Valid options: ${SUPPORTED_PROVIDERS.join(', ')}`
      return this.handleFailure(msg, msg)
    }

    try {
      let provider = this.providers.get(providerName)
      if (!provider) {
        provider = this.createProvider(providerName, apiKey)
        this.providers.set(providerName, provider)
      }

      // R-GEN-61: Resolve model tier alias
      resolveModel(modelArg, providerName)

      // R-GEN-41 to R-GEN-43: Variation substitution
      let finalPrompt = String(prompt)
      if (variation !== undefined) {
        finalPrompt = finalPrompt.replaceAll('{{variation}}', String(variation))
      }

      // R-GEN-24: Call provider and return base64
      const result = await provider.generateImage({
        prompt: finalPrompt,
        size,
        style,
      })

      return {
        success: true,
        value: result.base64,
        message: `Image generated (${result.costUnits} cost units)`,
        messages: [`Image generated (${result.costUnits} cost units)`],
        cost: result.costUnits,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return this.handleFailure(errorMessage, errorMessage)
    }
  }

  private getApiKey(
    providerName: string,
    context: ExecutionContext,
  ): string | undefined {
    switch (providerName) {
      case 'gemini':
        return context.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY
      case 'openai':
        return context.env?.OPENAI_API_KEY || process.env.OPENAI_API_KEY
      case 'anthropic':
        return context.env?.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY
      default:
        return undefined
    }
  }

  private createProvider(providerName: string, apiKey: string): AiProvider {
    switch (providerName) {
      case 'gemini':
        return new GeminiProvider(apiKey)
      default:
        throw new Error(`Provider "${providerName}" is not yet implemented`)
    }
  }
}
