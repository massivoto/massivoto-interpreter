import { describe, it, expect } from 'vitest'
import { join } from 'node:path'
import {
  createEmptyExecutionContext,
  ExecutionContext,
  ProgramResult,
  write,
} from '@massivoto/kit'
import { runProgram } from '../../../program-runner.js'
import { CoreCommandRegistry } from '../../../command-registry/command-registry.js'
import { CoreHandlersBundle } from '../../../command-registry/core-handlers-bundle.js'
import { readFile } from '../../../utils/file-utils.js'

/**
 * Integration test scaffold for @ai/prompt/reverseImage.
 * Uses the full OTO pipeline: parse -> evaluate -> execute.
 *
 * R-RIMG-111: ReverseImageAnalyser utility for full pipeline testing
 * R-RIMG-112: Uses real GEMINI_API_KEY, CoreHandlersBundle
 * R-RIMG-113: Skipped when GEMINI_API_KEY is not set
 * R-RIMG-114: Test scenarios with real Gemini API
 */

class ReverseImageAnalyser {
  private lastResult: ProgramResult | undefined
  private preloadedVars: Record<string, any> = {}

  /**
   * Pre-load a variable into scope before running the OTO line.
   * Simulates what the file evaluator will do when resolving ~/path.
   */
  withVar(name: string, value: any): this {
    this.preloadedVars[name] = value
    return this
  }

  async run(otoLine: string): Promise<ProgramResult> {
    const registry = new CoreCommandRegistry()
    registry.addBundle(new CoreHandlersBundle())
    await registry.reload()

    const context = createEmptyExecutionContext('integration-test')
    context.env = { GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '' }

    // Pre-load variables into scope
    for (const [name, value] of Object.entries(this.preloadedVars)) {
      write(name, value, context.scopeChain)
    }
    this.preloadedVars = {}

    this.lastResult = await runProgram(otoLine, context, registry)
    return this.lastResult
  }

  getOutput(varName: string): string {
    if (!this.lastResult) throw new Error('No result available, call run() first')
    return this.lastResult.context.data[varName] as string
  }
}

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures')

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=='

describe('ReverseImageHandler - dummy pipeline integration', () => {
  it('should run full OTO pipeline with dummy model and store output in scope', async () => {
    const analyser = new ReverseImageAnalyser()

    const result = await analyser.run(
      `@ai/prompt/reverseImage image="${TINY_PNG_BASE64}" model="dummy" output=testPrompt`,
    )

    expect(result.exitCode).toBe(0)
    const output = analyser.getOutput('testPrompt')
    expect(output).toContain('{{variation}}')
  })
})

describe('ReverseImageHandler - file-based dummy pipeline', () => {
  it('should accept an OtoFile loaded from a real PNG file', async () => {
    const analyser = new ReverseImageAnalyser()
    const photo = await readFile(join(FIXTURES_DIR, 'tiny.png'))

    const result = await analyser
      .withVar('photo', photo)
      .run('@ai/prompt/reverseImage image=photo model="dummy" output=prompt')

    expect(result.exitCode).toBe(0)
    const output = analyser.getOutput('prompt')
    expect(output).toContain('{{variation}}')
  })

  it('should accept an OtoFile loaded from a real JPEG file', async () => {
    const analyser = new ReverseImageAnalyser()
    const photo = await readFile(join(FIXTURES_DIR, 'tiny.jpg'))

    const result = await analyser
      .withVar('portrait', photo)
      .run('@ai/prompt/reverseImage image=portrait model="dummy" output=prompt')

    expect(result.exitCode).toBe(0)
    const output = analyser.getOutput('prompt')
    expect(output).toContain('{{variation}}')
  })
})

describe.skipIf(!process.env.GEMINI_API_KEY)(
  'ReverseImageHandler - real Gemini API integration',
  () => {
    const analyser = new ReverseImageAnalyser()

    it('should reverse-prompt a real image with default settings', async () => {
      const result = await analyser.run(
        `@ai/prompt/reverseImage image="${TINY_PNG_BASE64}" output=basicPrompt`,
      )

      expect(result.exitCode).toBe(0)
      const prompt = analyser.getOutput('basicPrompt')
      expect(prompt.length).toBeGreaterThan(50)
    }, 30_000)

    it('should reverse-prompt with focus arg', async () => {
      const result = await analyser.run(
        `@ai/prompt/reverseImage image="${TINY_PNG_BASE64}" focus="warm lighting and color palette" output=focusedPrompt`,
      )

      expect(result.exitCode).toBe(0)
      const prompt = analyser.getOutput('focusedPrompt')
      expect(prompt.length).toBeGreaterThan(50)
    }, 30_000)

    it('should reverse-prompt with light model', async () => {
      const result = await analyser.run(
        `@ai/prompt/reverseImage image="${TINY_PNG_BASE64}" model="light" output=lightPrompt`,
      )

      expect(result.exitCode).toBe(0)
      const prompt = analyser.getOutput('lightPrompt')
      expect(prompt.length).toBeGreaterThan(50)
    }, 30_000)

    it('should include {{variation}} in the generated prompt', async () => {
      const result = await analyser.run(
        `@ai/prompt/reverseImage image="${TINY_PNG_BASE64}" output=variationPrompt`,
      )

      expect(result.exitCode).toBe(0)
      const prompt = analyser.getOutput('variationPrompt')
      expect(prompt).toContain('{{variation}}')
    }, 30_000)

    it('should reverse-prompt from a real PNG file with correct mimeType', async () => {
      const photo = await readFile(join(FIXTURES_DIR, 'tiny.png'))

      const result = await analyser
        .withVar('photo', photo)
        .run('@ai/prompt/reverseImage image=photo output=filePrompt')

      expect(result.exitCode).toBe(0)
      const prompt = analyser.getOutput('filePrompt')
      expect(prompt.length).toBeGreaterThan(50)
    }, 30_000)

    it('should reverse-prompt from a real JPEG file with correct mimeType', async () => {
      const portrait = await readFile(join(FIXTURES_DIR, 'tiny.jpg'))

      const result = await analyser
        .withVar('portrait', portrait)
        .run('@ai/prompt/reverseImage image=portrait focus="portrait style" output=jpegPrompt')

      expect(result.exitCode).toBe(0)
      const prompt = analyser.getOutput('jpegPrompt')
      expect(prompt.length).toBeGreaterThan(50)
    }, 30_000)
  },
)
