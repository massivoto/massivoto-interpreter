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
import type { AiProvider, AiProviderName } from '../types.js'
import { DEFAULT_AI_PROVIDER } from '../types.js'
import { GeminiProvider } from '../providers/gemini.provider.js'
import { ActionResult, ExecutionContext } from '@massivoto/kit'
import { BaseCommandHandler } from '../../../handlers/index.js'
import { toImageData } from '../../../utils/file-utils.js'

const SUPPORTED_PROVIDERS: AiProviderName[] = ['gemini', 'openai', 'anthropic']

const GEMINI_MODEL_TIERS: Record<string, string> = {
  best: 'gemini-2.0-flash',
  light: 'gemini-2.0-flash-lite',
}

export class ReverseImageHandler extends BaseCommandHandler<string> {
  readonly type = 'command' as const

  private providers: Map<string, AiProvider> = new Map()

  constructor() {
    super('@ai/prompt/reverseImage')
  }

  setProvider(name: string, provider: AiProvider): void {
    this.providers.set(name, provider)
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

    // Validate provider
    if (!SUPPORTED_PROVIDERS.includes(providerName as AiProviderName)) {
      const msg = `Unknown provider "${providerName}". Valid options: ${SUPPORTED_PROVIDERS.join(', ')}`
      return this.handleFailure(msg, msg)
    }

    const apiKey = this.getApiKey(providerName, context)
    if (!apiKey) {
      const msg = 'Missing GEMINI_API_KEY environment variable. Copy env.dist to .env and add your API key.'
      return this.handleFailure(msg, msg)
    }

    try {
      let provider = this.providers.get(providerName)
      if (!provider) {
        provider = this.createProvider(providerName, apiKey)
        this.providers.set(providerName, provider)
      }

      // R-RIMG-61 to R-RIMG-63: Model tier resolution
      const resolvedModel = this.resolveModel(modelArg, providerName)
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

  private resolveModel(model: string | undefined, provider: string): string {
    const raw = model ?? 'best'
    if (provider === 'gemini' && raw in GEMINI_MODEL_TIERS) {
      return GEMINI_MODEL_TIERS[raw]
    }
    return raw
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
