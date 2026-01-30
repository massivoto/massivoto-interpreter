/**
 * @massivoto/interpreter - OTO Program Execution Engine
 *
 * This package provides the BSL 1.1 licensed implementation of:
 * - CoreInterpreter: Executes OTO programs
 * - ExpressionEvaluator: Evaluates expressions
 * - CoreCommandRegistry: Manages command handlers
 * - CorePipeRegistry: Manages pipe functions
 * - CoreHandlersBundle: Built-in command handlers
 * - CorePipesBundle: Built-in pipe functions
 *
 * @example
 * ```typescript
 * import { createRunner } from '@massivoto/runtime'
 * import {
 *   CoreInterpreter,
 *   CoreCommandRegistry,
 *   CorePipeRegistry,
 *   CoreHandlersBundle,
 *   CorePipesBundle,
 *   ExpressionEvaluator,
 * } from '@massivoto/interpreter'
 *
 * // Set up registries
 * const commandRegistry = new CoreCommandRegistry()
 * commandRegistry.addBundle(new CoreHandlersBundle())
 * await commandRegistry.reload()
 *
 * const pipeRegistry = new CorePipeRegistry()
 * pipeRegistry.addBundle(new CorePipesBundle())
 * await pipeRegistry.reload()
 *
 * // Create interpreter
 * const evaluator = new ExpressionEvaluator(pipeRegistry)
 * const interpreter = new CoreInterpreter(commandRegistry, evaluator)
 *
 * // Create runner and execute
 * const runner = createRunner(interpreter)
 * const result = await runner.runSource('@utils/set input="hello" output=greeting')
 * ```
 *
 * @license BSL-1.1
 */

// Core Interpreter
export { CoreInterpreter } from './core-interpreter.js'

// Expression Evaluator

// Command Registry
export { CoreHandlersBundle } from './command-registry/core-handlers-bundle.js'
export { BaseCommandHandler } from './command-registry/base-command-handler.js'
export type { CommandHandler } from './command-registry/types.js'

// Pipe Registry
export { CorePipesBundle } from './pipe-registry/core-pipes-bundle.js'
export { BasePipeFunction } from './pipe-registry/types.js'
export type { PipeFunction } from './pipe-registry/types.js'

// Re-export errors
export { CommandNotFoundError } from './command-registry/errors.js'
export { PipeError, PipeArgumentError, PipeTypeError } from './pipe-registry/errors.js'
