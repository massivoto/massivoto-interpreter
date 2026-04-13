/**
 * GenerateImageHandler - @ai/image/generate
 *
 * Generates images from text prompts using an AI provider.
 * Provider is resolved and injected by the interpreter via context.resolvedProvider.
 * Supports {{variation}} template substitution for batch generation pipelines.
 *
 * R-GEN-21: Handler extending AiCommandHandler<string> with id @ai/image/generate
 * R-GEN-22: Required args: prompt
 * R-GEN-23: Optional args: variation, model, size, style
 * R-GEN-24: Call provider.generateImage() and return base64 as ActionResult.value
 * R-PAR-10: Extends AiCommandHandler, uses context.resolvedProvider
 */
import type { ImageRequest } from '@massivoto/kit'
import { AI_IMAGE_DEFAULTS, resolveImageModel } from '../defaults.js'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { AiCommandHandler } from '../../../handlers/index.js'

// R-GEN-92: Minimal valid 1x1 transparent PNG (67 bytes)
const DUMMY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
  'Nl7BcQAAAABJRU5ErkJggg=='

export class GenerateImageHandler extends AiCommandHandler<string> {
  readonly type = 'command' as const
  readonly capability = 'image' as const

  constructor() {
    super('@ai/image/generate')
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
      // R-PAR-10: Provider is already resolved and injected by interpreter
      const provider = context.resolvedProvider!
      const providerName = provider.name ?? 'gemini'

      // R-GEN-61: Resolve model tier alias for image generation
      const resolvedModel = resolveImageModel(modelArg, providerName)

      // R-GEN-41 to R-GEN-43: Variation substitution
      let finalPrompt = String(prompt)
      if (variation !== undefined) {
        finalPrompt = finalPrompt.replaceAll('{{variation}}', String(variation))
      }

      // R-GEN-24: Call provider and return base64
      const result = await provider.generateImage({
        prompt: finalPrompt,
        model: resolvedModel,
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
}
