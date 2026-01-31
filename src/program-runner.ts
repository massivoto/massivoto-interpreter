import {
  createEmptyExecutionContext,
  ExecutionContext,
  ProgramResult,
} from '@massivoto/kit'
import { buildProgramParser } from './parser/program-parser.js'
import { CoreInterpreter } from './core-interpreter.js'
import { CoreCommandRegistry } from './command-registry/command-registry.js'
import { createStandardCommandRegistry } from './command-registry/index.js'

/**
 * Error thrown when program parsing or execution fails.
 * Designed to be LLM-readable with clear context.
 */
export class ProgramRunError extends Error {
  constructor(
    message: string,
    public readonly source: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'ProgramRunError'
  }
}

/**
 * Parse and execute a DSL program.
 *
 * @param source - The DSL source code to execute
 * @param context - Optional execution context (created if not provided)
 * @param registry - Optional command registry (uses standard handlers if not provided)
 * @returns ProgramResult with context, exitCode, value, and exitedEarly flag
 * @throws ProgramRunError on parse errors
 * @throws Error on execution errors (e.g., unknown command)
 *
 * Breaking change (R-GOTO-82): Returns ProgramResult instead of ExecutionContext.
 *
 * @example
 * ```typescript
 * const source = `
 * @utils/set input="Emma" output=user
 * @utils/set input=1500 output=followers
 * @utils/log message={user}
 * `
 *
 * const result = await runProgram(source)
 * console.log(result.context.data.user) // "Emma"
 * console.log(result.context.data.followers) // 1500
 * console.log(result.exitCode) // 0
 * ```
 */
export async function runProgram(
  source: string,
  context?: ExecutionContext,
  registry?: CoreCommandRegistry,
): Promise<ProgramResult> {
  const parser = buildProgramParser()

  // Parse the source
  const parseResult = parser.parse(source)

  if (!parseResult.isAccepted()) {
    const errorMessage = parseResult.error?.message || 'Unknown parse error'
    throw new ProgramRunError(
      `Parse error: ${errorMessage}`,
      source,
      parseResult.error,
    )
  }

  const program = parseResult.value!

  // Use provided context or create empty one
  const executionContext = context || createEmptyExecutionContext('anonymous')

  // Use provided registry or create fresh one with standard handlers
  let commandRegistry = registry
  if (!commandRegistry) {
    commandRegistry = await createStandardCommandRegistry()
  }

  // Create interpreter and execute
  const interpreter = new CoreInterpreter(commandRegistry)

  return interpreter.executeProgram(program, executionContext)
}
