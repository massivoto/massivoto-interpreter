/**
 * GeminiProvider - AI provider implementation for Google Gemini/Imagen APIs.
 *
 * R-AI-31: Implement GeminiProvider for text generation via Gemini API
 * R-AI-32: Implement GeminiProvider for image generation via Imagen API
 * R-AI-33: Read API key from process.env.GEMINI_API_KEY
 */
import type {
  AiProvider,
  TextRequest,
  TextResult,
  ImageRequest,
  ImageResult,
  ImageAnalysisRequest,
  ImageAnalysisResult,
} from '../types.js'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const DEFAULT_TEXT_MODEL = 'gemini-1.5-pro'
const DEFAULT_IMAGE_MODEL = 'imagen-3.0-generate-002'
const DEFAULT_VISION_MODEL = 'gemini-2.0-flash'

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini'

  constructor(private readonly apiKey: string) {}

  /**
   * R-AI-31: Generate text using Gemini API.
   */
  async generateText(request: TextRequest): Promise<TextResult> {
    const model = request.model ?? DEFAULT_TEXT_MODEL
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${this.apiKey}`

    const body: GeminiTextRequestBody = {
      contents: [
        {
          parts: [{ text: request.prompt }],
        },
      ],
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxTokens,
      },
    }

    // Add system instruction if provided
    if (request.system) {
      body.systemInstruction = {
        parts: [{ text: request.system }],
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText)
    }

    const data = (await response.json()) as GeminiTextResponse

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0

    return {
      text,
      tokensUsed,
    }
  }

  /**
   * R-AI-32: Generate image using Imagen API.
   */
  async generateImage(request: ImageRequest): Promise<ImageResult> {
    const url = `${GEMINI_API_BASE}/models/${DEFAULT_IMAGE_MODEL}:predict?key=${this.apiKey}`

    const aspectRatio = this.mapSizeToAspectRatio(request.size)

    const body: ImagenRequestBody = {
      instances: [
        {
          prompt: request.prompt,
        },
      ],
      parameters: {
        aspectRatio,
        sampleCount: 1,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(errorText)
    }

    const data = (await response.json()) as ImagenResponse

    const base64 = data.predictions?.[0]?.bytesBase64Encoded ?? ''

    return {
      base64,
      costUnits: 1, // Each image generation costs 1 unit
    }
  }

  /**
   * R-RIMG-21: Analyze image using Gemini Vision API (generateContent with multimodal input).
   */
  async analyzeImage(request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    const model = request.model ?? DEFAULT_VISION_MODEL
    const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${this.apiKey}`

    // R-RIMG-23: Send image as inlineData part alongside text prompt part
    const mimeType = request.mimeType ?? 'image/png'
    const body: GeminiVisionRequestBody = {
      contents: [{
        parts: [
          { text: request.prompt },
          { inlineData: { mimeType, data: request.image } },
        ],
      }],
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

    const data = (await response.json()) as GeminiTextResponse
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    return { text }
  }

  private mapSizeToAspectRatio(
    size: ImageRequest['size'],
  ): '1:1' | '16:9' | '9:16' {
    switch (size) {
      case 'landscape':
        return '16:9'
      case 'portrait':
        return '9:16'
      case 'square':
      default:
        return '1:1'
    }
  }
}

// Gemini API Types

interface GeminiTextRequestBody {
  contents: Array<{
    parts: Array<{ text: string }>
  }>
  generationConfig: {
    temperature?: number
    maxOutputTokens?: number
  }
  systemInstruction?: {
    parts: Array<{ text: string }>
  }
}

interface GeminiTextResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  usageMetadata?: {
    totalTokenCount?: number
  }
}

// Imagen API Types

interface ImagenRequestBody {
  instances: Array<{
    prompt: string
  }>
  parameters: {
    aspectRatio: string
    sampleCount: number
  }
}

interface ImagenResponse {
  predictions?: Array<{
    bytesBase64Encoded?: string
  }>
}

// Gemini Vision API Types

interface GeminiVisionRequestBody {
  contents: Array<{
    parts: Array<
      | { text: string }
      | { inlineData: { mimeType: string; data: string } }
    >
  }>
}
