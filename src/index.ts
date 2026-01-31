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

// Core Interpreter and Program parser
export { CoreInterpreter } from './core-interpreter.js'
export { parseProgram, buildProgramParser } from './parser/program-parser.js'
export { ProgramNode } from './parser/ast.js'

// Expression Evaluator
export { ExpressionEvaluator } from './evaluator/evaluators.js'

// Command Registry
export { CoreCommandRegistry } from './command-registry/command-registry.js'
export { CoreHandlersBundle } from './command-registry/core-handlers-bundle.js'
export { createStandardCommandRegistry } from './command-registry/standard-registry.js'
// Handlers
export * from './core-handlers/index.js'
export { BaseCommandHandler } from './handlers/base-command-handler.js'
export {
  registerStandardCommandHandlers,
  getCommandHandlerRegistry,
} from './handlers/register-handlers.js'

// Pipe Registry
export { PipeRegistry } from './pipe-registry/pipe-registry.js'
export { CorePipesBundle } from './pipe-registry/core-pipes-bundle.js'
export { BasePipeFunction } from './pipe-registry/types.js'
export type { PipeFunction } from './pipe-registry/types.js'

// Re-export errors
export { CommandNotFoundError } from './command-registry/errors.js'
export {
  PipeError,
  PipeArgumentError,
  PipeTypeError,
} from './pipe-registry/errors.js'

// =============================================================================
// PARSER - AST types and parsing
// =============================================================================

/* Not exported yet by design, to avoid pollution of the public API surface
It can be added later if needed when advanced use cases arise.
export type {
  StatementNode,
  InstructionNode,
  BlockNode,
  ExpressionNode,
  IdentifierNode,
  LiteralNode,
  MemberExpressionNode,
  UnaryExpressionNode,
  BinaryExpressionNode,
  LogicalExpressionNode,
  ArrayLiteralNode,
  ActionNode,
  ArgumentNode,
  ForEachArgNode,
} from './parser/ast.js'

export type {
  PipeExpressionNode,
  PipeSegment,
} from './parser/args-details/pipe-parser/pipe-parser.js'*/
