import { describe, it, expect } from 'vitest'
import {
  createEmptyExecutionContext,
  ProgramResult,
  write,
} from '@massivoto/kit'
import { runProgram } from '../../../program-runner.js'
import { CoreCommandRegistry } from '../../../command-registry/command-registry.js'
import { CoreHandlersBundle } from '../../../command-registry/core-handlers-bundle.js'

/**
 * Integration test scaffold for @ai/image/generate.
 * Uses the full OTO pipeline: parse -> evaluate -> execute.
 *
 * R-GEN-111: ImageGenerator utility for full pipeline testing
 * R-GEN-112: Skipped when GEMINI_API_KEY is not set
 * R-GEN-113: Test scenarios with real Gemini API
 */

class ImageGenerator {
  private lastResult: ProgramResult | undefined
  private preloadedVars: Record<string, any> = {}

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

describe('GenerateImageHandler - dummy pipeline integration', () => {
  it('should run full OTO pipeline with dummy model and store output in scope', async () => {
    const generator = new ImageGenerator()

    const result = await generator.run(
      '@ai/image/generate prompt="A racing car in golden light" model="dummy" output=testImage',
    )

    expect(result.exitCode).toBe(0)
    const output = generator.getOutput('testImage')
    expect(output.length).toBeGreaterThan(10)
  })

  it('should run with variation substitution in dummy mode', async () => {
    const generator = new ImageGenerator()

    const result = await generator
      .withVar('racePrompt', 'A car {{variation}} with dramatic lighting')
      .run('@ai/image/generate prompt=racePrompt variation="under the rain" model="dummy" output=testImage')

    expect(result.exitCode).toBe(0)
    const output = generator.getOutput('testImage')
    expect(output.length).toBeGreaterThan(10)
  })
})

describe.skipIf(!process.env.GEMINI_API_KEY)(
  'GenerateImageHandler - real Gemini API integration',
  () => {
    const generator = new ImageGenerator()

    // R-GEN-113(a): basic generation
    it('should generate an image with default settings', async () => {
      const result = await generator.run(
        '@ai/image/generate prompt="A simple red circle on white background" output=basicImage',
      )

      expect(result.exitCode).toBe(0)
      const image = generator.getOutput('basicImage')
      expect(image.length).toBeGreaterThan(100)
    }, 60_000)

    // R-GEN-113(b): generation with variation
    it('should generate with variation substitution', async () => {
      const result = await generator
        .withVar('template', 'A {{variation}} in a racing scene with dramatic lighting')
        .run(
          '@ai/image/generate prompt=template variation="red car overtaking" output=variationImage',
        )

      expect(result.exitCode).toBe(0)
      const image = generator.getOutput('variationImage')
      expect(image.length).toBeGreaterThan(100)
    }, 60_000)

    // R-GEN-113(c): generation with model=light
    it('should generate with light model', async () => {
      const result = await generator.run(
        '@ai/image/generate prompt="A blue sky" model="light" output=lightImage',
      )

      expect(result.exitCode).toBe(0)
      const image = generator.getOutput('lightImage')
      expect(image.length).toBeGreaterThan(100)
    }, 60_000)
  },
)
