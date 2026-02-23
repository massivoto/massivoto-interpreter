import { describe, expect, it } from 'vitest'
import { CommandHandler, createEmptyExecutionContext } from '@massivoto/kit'
import { CoreInterpreter } from '../../core-interpreter.js'
import { CoreCommandRegistry } from '../../command-registry/index.js'
import { BasicHandler } from '../../core-handlers/basic-handler.js'
import { buildProgramParser } from '../program-parser.js'

/**
 * Theme: Formula One Race Automation
 *
 * AI image generation for F1 race situations is flaky.
 * The retry mechanism allows commands to re-execute on failure.
 * retry=N means: on failure, retry up to N additional times.
 * retry=0 means no retry, retry=1 means one retry (execute twice max).
 */
describe('Retry Execution (R-FILTER-81 to R-FILTER-83)', () => {
  describe('R-FILTER-81: retry wraps execution in a loop', () => {
    it('AC-FP-05: succeeds on 3rd attempt with retry=2', async () => {
      const context = createEmptyExecutionContext('test')
      let callCount = 0

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => {
          callCount++
          if (callCount < 3) {
            throw new Error('AI generation failed')
          }
          return {
            success: true,
            cost: 1,
            messages: [],
            value: 'f1-car-image.png',
          }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage prompt="F1 car" retry=2 output=image',
      )

      const interpreter = new CoreInterpreter(registry)
      const result = await interpreter.executeProgram(program, context)

      expect(callCount).toBe(3)
      expect(result.data.image).toBe('f1-car-image.png')
    })

    it('AC-FP-06: throws after exhausting retries', async () => {
      const context = createEmptyExecutionContext('test')
      let callCount = 0

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async () => {
          callCount++
          throw new Error('AI generation failed permanently')
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage prompt="F1 car" retry=2',
      )

      const interpreter = new CoreInterpreter(registry)
      await expect(
        interpreter.executeProgram(program, context),
      ).rejects.toThrow('AI generation failed permanently')

      // 1 initial + 2 retries = 3 total attempts
      expect(callCount).toBe(3)
    })

    it('does not retry on success', async () => {
      const context = createEmptyExecutionContext('test')
      let callCount = 0

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async () => {
          callCount++
          return {
            success: true,
            cost: 1,
            messages: [],
            value: 'image.png',
          }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage prompt="F1 car" retry=3',
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(callCount).toBe(1)
    })
  })

  describe('R-FILTER-82: per-item retry in forEach', () => {
    it('AC-FP-07: each item gets its own retry budget', async () => {
      const context = createEmptyExecutionContext('test')
      context.data.prompts = ['rain', 'grid']

      const callsByPrompt: Record<string, number> = { rain: 0, grid: 0 }

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async (args: Record<string, any>) => {
          const prompt = args.prompt as string
          callsByPrompt[prompt] = (callsByPrompt[prompt] || 0) + 1

          // 'rain' fails once then succeeds, 'grid' succeeds immediately
          if (prompt === 'rain' && callsByPrompt[prompt] < 2) {
            throw new Error('Flaky for rain')
          }
          return {
            success: true,
            cost: 1,
            messages: [],
            value: `${prompt}.png`,
          }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage prompt=prompt forEach=prompts -> prompt retry=2',
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(callsByPrompt.rain).toBe(2)
      expect(callsByPrompt.grid).toBe(1)
    })
  })

  describe('R-FILTER-83: retry=0 and retry=1 semantics', () => {
    it('retry=0 means no retry (execute once, fail on error)', async () => {
      const context = createEmptyExecutionContext('test')
      let callCount = 0

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async () => {
          callCount++
          throw new Error('Failed')
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage prompt="F1 car" retry=0',
      )

      const interpreter = new CoreInterpreter(registry)
      await expect(
        interpreter.executeProgram(program, context),
      ).rejects.toThrow('Failed')

      expect(callCount).toBe(1)
    })

    it('retry=1 means one retry (execute twice max)', async () => {
      const context = createEmptyExecutionContext('test')
      let callCount = 0

      const handler: CommandHandler<string> = new BasicHandler(
        '@ai/generateImage',
        async () => {
          callCount++
          if (callCount < 2) {
            throw new Error('Flaky')
          }
          return {
            success: true,
            cost: 1,
            messages: [],
            value: 'image.png',
          }
        },
      )

      const registry = new CoreCommandRegistry()
      registry.addRegistryItem('@ai/generateImage', handler)

      const parser = buildProgramParser()
      const program = parser.val(
        '@ai/generateImage prompt="F1 car" retry=1',
      )

      const interpreter = new CoreInterpreter(registry)
      await interpreter.executeProgram(program, context)

      expect(callCount).toBe(2)
    })
  })
})
