/**
 * LangchainProvider -- AiProvider adapter that uses Langchain JS for multi-provider support.
 *
 * Supports text generation and image analysis via Langchain's unified ChatModel API.
 * Image generation uses native Gemini API for gemini provider, throws for others.
 *
 * R-LC-01: LangchainProvider implements AiProvider
 * R-LC-02: Text generation via Langchain
 * R-LC-03: Image analysis via Langchain multimodal
 * R-LC-04: Image generation (Gemini-only passthrough)
 */
import type {
  AiProvider,
  TextRequest,
  TextResult,
  ImageRequest,
  ImageResult,
  ImageAnalysisRequest,
  ImageAnalysisResult,
} from '@massivoto/kit'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLangchainModel } from './langchain-models.js'

const DEFAULT_MODELS: Record<string, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export class LangchainProvider implements AiProvider {
  readonly name: string

  constructor(
    private readonly providerName: string,
    private readonly apiKey: string,
  ) {
    this.name = providerName
  }

  /**
   * R-LC-02: Generate text using Langchain ChatModel.
   */
  async generateText(request: TextRequest): Promise<TextResult> {
    const modelId = request.model ?? DEFAULT_MODELS[this.providerName] ?? 'default'
    const model = createLangchainModel(this.providerName, this.apiKey, modelId, {
      temperature: request.temperature,
      maxTokens: request.maxTokens,
    })

    const messages: Array<SystemMessage | HumanMessage> = []

    if (request.system) {
      messages.push(new SystemMessage(request.system))
    }

    messages.push(new HumanMessage(request.prompt))

    try {
      const response = await model.invoke(messages)

      const text = typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content
            .filter((p: any) => typeof p === 'string' || p.type === 'text')
            .map((p: any) => typeof p === 'string' ? p : p.text)
            .join('')
          : ''

      const tokensUsed = response.usage_metadata?.total_tokens ?? 0

      return { text, tokensUsed }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(message)
    }
  }

  /**
   * R-LC-04: Generate image. Gemini-only via native API. Others throw.
   */
  async generateImage(request: ImageRequest): Promise<ImageResult> {
    if (this.providerName !== 'gemini') {
      throw new Error(
        `Image generation is not yet supported for provider "${this.providerName}". Use gemini or wait for a future release.`,
      )
    }

    // Gemini native image generation via generateContent with responseModalities
    const model = request.model ?? 'gemini-2.0-flash-exp'
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${this.apiKey}`

    const body = {
      contents: [{ parts: [{ text: request.prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText)
    }

    const data = await response.json() as any

    const parts = data.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p: any) => p.inlineData?.data)
    const base64 = imagePart?.inlineData?.data ?? ''

    if (!base64) {
      throw new Error('No image data in Gemini response')
    }

    return { base64, costUnits: 1 }
  }

  /**
   * R-LC-03: Analyze image using Langchain multimodal messages.
   */
  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const modelId = request.model ?? DEFAULT_MODELS[this.providerName] ?? 'default'
    const model = createLangchainModel(this.providerName, this.apiKey, modelId, {})

    const mimeType = request.mimeType ?? 'image/png'

    const message = new HumanMessage({
      content: [
        { type: 'text', text: request.prompt },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${request.image}` },
        },
      ],
    })

    try {
      const response = await model.invoke([message])

      const text = typeof response.content === 'string'
        ? response.content
        : Array.isArray(response.content)
          ? response.content
            .filter((p: any) => typeof p === 'string' || p.type === 'text')
            .map((p: any) => typeof p === 'string' ? p : p.text)
            .join('')
          : ''

      return { text }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(message)
    }
  }
}
