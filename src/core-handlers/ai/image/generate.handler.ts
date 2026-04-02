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
import type { AiProvider, AiProviderName, ImageRequest } from '@massivoto/kit'
import { resolveProvider } from '@massivoto/auth-domain'
import { AI_IMAGE_DEFAULTS, resolveModel } from '../defaults.js'
import { createAiProvider } from '../providers/create-ai-provider.js'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'

// R-GEN-92: Minimal valid 1x1 transparent PNG (67 bytes)
const DUMMY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
  'Nl7BcQAAAABJRU5ErkJggg=='

// R-AIC-42: GenerateImageHandler accepts gemini (openai/anthropic future)
const IMAGE_ACCEPTED_PROVIDERS: AiProviderName[] = ['gemini', 'openai', 'anthropic']

export class GenerateImageHandler extends BaseCommandHandler<string> {
  readonly type = 'command' as const
  override readonly acceptedProviders = IMAGE_ACCEPTED_PROVIDERS

  private providers: Map<string, AiProvider> = new Map()

  constructor() {
    super('@ai/image/generate')
  }

  // R-AIC-63: test hook remains
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
    const size: ImageRequest['size'] = args.size ?? AI_IMAGE_DEFAULTS.size
    const style: ImageRequest['style'] = args.style ?? AI_IMAGE_DEFAULTS.style
    const variation: string | undefined = args.variation

    // R-GEN-91: Dummy model short-circuits before any API call
    if (modelArg === 'dummy') {
      return this.handleSuccess('Image generated (dummy mode)', GenerateImageHandler.buildDummyImage())
    }

    try {
      // R-AIC-43: Use centralized resolution
      const providerName = 'gemini' as AiProviderName
      const provider = this.getOrCreateProvider(providerName, context)

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

  private getOrCreateProvider(
    providerName: AiProviderName,
    context: ExecutionContext,
  ): AiProvider {
    const cached = this.providers.get(providerName)
    if (cached) return cached

    if (context.aiConfig) {
      const resolved = resolveProvider(context.aiConfig, this.acceptedProviders!)
      const provider = createAiProvider(resolved.name, resolved.apiKey)
      this.providers.set(resolved.name, provider)
      return provider
    }

    return this.fallbackCreateProvider(providerName, context)
  }

  private fallbackCreateProvider(
    providerName: AiProviderName,
    context: ExecutionContext,
  ): AiProvider {
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
    const provider = createAiProvider(providerName, apiKey)
    this.providers.set(providerName, provider)
    return provider
  }
}
