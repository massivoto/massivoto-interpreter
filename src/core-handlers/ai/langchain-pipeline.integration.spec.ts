import { describe, it, expect, afterEach } from 'vitest'
import { OtoTestRunner } from './test-utils/oto-test-runner.js'

/**
 * End-to-end integration test for the Langchain provider pipeline.
 *
 * Runs a multi-line OTO program that:
 * 1. Generates a kitten image via @ai/image/generate (Gemini through LangchainProvider)
 * 2. Reverse-prompts the image via @ai/prompt/reverseImage
 * 3. Saves the image to disk via @file/save
 *
 * Verifies:
 * - The reverse prompt describes a cat/kitten
 * - The file was created in the workspace
 */

describe.skipIf(!process.env.GEMINI_API_KEY)(
  'Langchain pipeline -- kitten image + reverse prompt + file save',
  () => {
    const runner = new OtoTestRunner()

    afterEach(() => {
      runner.cleanup()
    })

    it('should generate a kitten image, reverse-prompt it, and save to file', async () => {
      runner.withWorkspace('kitten-pipeline-')

      const result = await runner.run(`
@ai/image/generate prompt="A cute kitten playing with a ball of yarn on a wooden floor" output=kittenImage
@ai/prompt/reverseImage image={kittenImage} output=kittenPrompt
@file/save data={kittenImage} file="kitten.png"
`)

      expect(result.exitCode).toBe(0)

      // The reverse prompt should describe the scene (the subject becomes {{variation}})
      const prompt = runner.getOutput('kittenPrompt') as string
      expect(prompt.length).toBeGreaterThan(50)
      expect(prompt).toContain('{{variation}}')
      const lower = prompt.toLowerCase()
      // Should pick up scene context: pet, yarn, wooden floor, playful, etc.
      expect(lower).toMatch(/pet|yarn|wooden|playful|animal|fur|paw|cat|kitten/)

      // The generated image should be a non-trivial base64 string
      const image = runner.getOutput('kittenImage') as string
      expect(image.length).toBeGreaterThan(100)

      // The file should exist on disk with content
      expect(runner.fileExists('kitten.png')).toBe(true)
      expect(runner.fileSize('kitten.png')).toBeGreaterThan(100)
    }, 120_000)
  },
)
