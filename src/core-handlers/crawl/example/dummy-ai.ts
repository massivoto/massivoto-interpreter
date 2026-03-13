// DummyAI for testing @crawl/example handler
// Returns predictable LearnedSelectors JSON without making real API calls

import type { AiProvider, TextResult, ImageResult, ImageRequest, ImageAnalysisRequest, ImageAnalysisResult, TextRequest } from '@massivoto/kit'
import type { LearnedSelectors } from '../adapter/crawl-adapter.js'

export class DummyAI implements AiProvider {
  readonly name = 'dummy'
  private response: LearnedSelectors

  constructor(response: LearnedSelectors) {
    this.response = response
  }

  async generateText(_request: TextRequest): Promise<TextResult> {
    return {
      text: JSON.stringify(this.response),
      tokensUsed: 10,
    }
  }

  async generateImage(_request: ImageRequest): Promise<ImageResult> {
    return { base64: '', costUnits: 0 }
  }

  async analyzeImage(_request: ImageAnalysisRequest): Promise<ImageAnalysisResult> {
    return { text: '' }
  }
}
