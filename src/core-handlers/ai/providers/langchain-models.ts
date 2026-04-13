/**
 * Langchain model factory -- creates the right ChatModel for each provider.
 *
 * Extracted as a standalone function for testability: tests can mock this
 * module to avoid instantiating real Langchain models.
 */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatOpenAI } from '@langchain/openai'
import { ChatAnthropic } from '@langchain/anthropic'

export interface LangchainModelOptions {
  temperature?: number
  maxTokens?: number
}

/**
 * Create a Langchain ChatModel for the given provider.
 *
 * @param providerName - 'gemini' | 'openai' | 'anthropic'
 * @param apiKey - API key for the provider
 * @param modelId - Model identifier (e.g. 'gpt-4o', 'gemini-2.5-flash')
 * @param options - temperature, maxTokens
 */
export function createLangchainModel(
  providerName: string,
  apiKey: string,
  modelId: string,
  options: LangchainModelOptions = {},
): BaseChatModel {
  switch (providerName) {
    case 'gemini':
      return new ChatGoogleGenerativeAI({
        apiKey,
        model: modelId,
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
      })

    case 'openai':
      return new ChatOpenAI({
        apiKey,
        model: modelId,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })

    case 'anthropic':
      return new ChatAnthropic({
        apiKey,
        model: modelId,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      })

    default:
      throw new Error(
        `Provider "${providerName}" is not supported by Langchain adapter. Supported: gemini, openai, anthropic.`,
      )
  }
}

/**
 * List of provider names supported by the Langchain adapter.
 */
export const LANGCHAIN_PROVIDERS = ['gemini', 'openai', 'anthropic'] as const
