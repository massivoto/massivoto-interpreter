/**
 * ReverseImageHandler - @ai/prompt/reverseImage
 *
 * Analyzes an image and produces a detailed text prompt optimized for
 * image regeneration, with a {{variation}} placeholder for scene/subject swaps.
 *
 * R-RIMG-41: Handler extending BaseCommandHandler<string> with id @ai/prompt/reverseImage
 * R-RIMG-42: Required args: image (base64), output
 * R-RIMG-43: Optional args: focus, model, provider
 * R-RIMG-44: System prompt for reverse-prompting with {{variation}}
 * R-RIMG-45: Returns generated prompt as ActionResult.value
 */
import type { AiProvider, AiProviderName } from '@massivoto/kit'
import { DEFAULT_AI_PROVIDER } from '@massivoto/kit'
import { resolveModel } from '../defaults.js'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import { toImageData } from '../../../utils/file-utils.js'
import { AiProviderRegistry } from '../providers/ai-provider-registry.js'

// R-AIC-42: ReverseImageHandler accepts gemini (openai/anthropic future)
const REVERSE_ACCEPTED_PROVIDERS: AiProviderName[] = ['gemini', 'openai', 'anthropic']

export class ReverseImageHandler extends BaseCommandHandler<string> {
  readonly type = 'command' as const
  override readonly acceptedProviders = REVERSE_ACCEPTED_PROVIDERS

  private registry: AiProviderRegistry

  constructor(registry?: AiProviderRegistry) {
    super('@ai/prompt/reverseImage')
    this.registry = registry ?? new AiProviderRegistry()
  }

  // R-PC-08: backward-compatible test hook delegates to registry
  setProvider(name: string, provider: AiProvider): void {
    this.registry.set(name, provider)
  }

  // R-RIMG-92: Static dummy prompt for testing and CI
  static buildDummyPrompt(variation: boolean): string {
    const subject = variation
      ? '{{variation}}'
      : 'a solitary figure standing at the edge of a cliff'
    return (
      `A detailed photograph capturing ${subject} with soft natural lighting, ` +
      'shallow depth of field, warm color palette dominated by golden and amber tones, ' +
      'shot from a low angle perspective, background softly blurred with bokeh circles, ' +
      'high contrast between subject and environment, cinematic composition with ' +
      'rule of thirds framing, subtle lens flare from the light source'
    )
  }

  async run(
    args: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ActionResult<string>> {
    // R-RIMG-42: Validate required image argument (accepts OtoFile or base64 string)
    const rawImage = args.image
    if (!rawImage) {
      return this.handleFailure('Image is required', 'Image is required')
    }

    let imageData: { base64: string; mimeType: string }
    try {
      imageData = toImageData(rawImage)
    } catch {
      return this.handleFailure(
        'Invalid image: expected a base64 string or an OtoFile object',
        'Invalid image: expected a base64 string or an OtoFile object',
      )
    }

    const modelArg: string | undefined = args.model
    const providerName: string = args.provider ?? DEFAULT_AI_PROVIDER
    const focus: string | undefined = args.focus

    // R-RIMG-91: Dummy model short-circuits before any API call
    if (modelArg === 'dummy') {
      const dummyPrompt = ReverseImageHandler.buildDummyPrompt(true)
      return this.handleSuccess('Reverse-prompt generated (dummy mode)', dummyPrompt)
    }

    try {
      // R-PC-06: Use centralized registry instead of duplicated provider logic
      const provider = this.registry.get(providerName, this.acceptedProviders!, context)

      // R-RIMG-61 to R-RIMG-63: Model tier resolution (shared from ai/defaults.ts)
      const resolvedModel = resolveModel(modelArg, providerName)
      const systemPrompt = this.buildSystemPrompt(focus)

      const result = await provider.analyzeImage({
        image: imageData.base64,
        prompt: systemPrompt,
        model: resolvedModel,
        mimeType: imageData.mimeType,
      })

      return this.handleSuccess('Reverse-prompt generated', result.text)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return this.handleFailure(errorMessage, errorMessage)
    }
  }

  private buildSystemPrompt(focus?: string): string {
    let prompt =
      'You are an expert prompt engineer specializing in image generation. ' +
      'Analyze the provided image and produce a single, detailed text prompt that could be used ' +
      'to generate a visually similar image with an AI image generation model.\n\n' +
      'Your prompt MUST capture:\n' +
      '- Visual style (photographic, illustrated, painted, etc.)\n' +
      '- Composition and framing (angle, perspective, rule of thirds, etc.)\n' +
      '- Color palette and tones\n' +
      '- Lighting (direction, quality, mood)\n' +
      '- Content and subject matter\n' +
      '- Atmosphere and mood\n\n' +
      'Your prompt MUST include exactly one {{variation}} placeholder at the position ' +
      'where the main scene or subject is described. This placeholder will be replaced ' +
      'with different scenes/subjects to generate variations while preserving the style.\n\n' +
      'Return ONLY the prompt text, no explanations or metadata.'

    if (focus) {
      prompt += `\n\nPay special attention to and emphasize these aspects: ${focus}`
    }

    return prompt
  }
}
