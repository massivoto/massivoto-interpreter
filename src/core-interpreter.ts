import {
  ActionLog,
  BatchResult,
  cloneExecutionContext,
  CommandRegistry,
  CostInfo,
  createEarlyExit,
  createNormalCompletion,
  createReturn,
  ExecutionContext,
  Interpreter,
  nowTs,
  popScope,
  ProgramResult,
  pushScope,
  toReadableDate,
  write,
} from '@massivoto/kit'
import lodashSet from 'lodash.set'
import type { ScopeChain } from '@massivoto/kit'

import type { GotoResult } from './core-handlers/flow/goto.handler.js'
import type { ExitResult } from './core-handlers/flow/exit.handler.js'
import type { ReturnResult } from './core-handlers/flow/return.handler.js'
import {
  BlockNode,
  ForEachArgNode,
  InstructionNode,
  ProgramNode,
  StatementNode,
} from './parser/ast.js'
import { ExpressionEvaluator } from './evaluator/index.js'

/**
 * R-FILTER-01: Canonical precedence chain for reserved arguments.
 *
 *   forEach -> if -> retry -> execute -> output/collect
 *
 * R-FILTER-02: Position on the line does NOT affect precedence.
 * The parser collects reserved args by type, not position.
 *
 * R-FILTER-03: On blocks, forEach and if apply to the block body.
 * retry, output, and collect are valid on instructions only (not blocks).
 */
export const RESERVED_ARG_PRECEDENCE = [
  'forEach',
  'if',
  'retry',
  'execute',
  'output/collect',
] as const

/**
 * Flow control result from a statement execution.
 * Used to signal goto, exit, or return to the program loop.
 */
export type FlowControl =
  | { type: 'continue' }
  | { type: 'goto'; target: string }
  | { type: 'exit'; code: number }
  | { type: 'return'; value: unknown }

/**
 * R-BLK-01: LabelLocation type for path-based label indexing.
 * Path is an array of indices to reach the label in the AST.
 * For example, [2] means the label is on statement 2 of the current list.
 * [1, 0] means statement 1 is a block, and the label is on statement 0 of that block's body.
 */
export interface LabelLocation {
  path: number[] // Indices to reach the label in the AST
  instruction: InstructionNode // The instruction with the label
}

/**
 * R-BLK-02: Enhanced label index mapping label names to LabelLocation.
 * Walks the AST and builds a map of label names to their locations.
 */
export type EnhancedLabelIndex = Map<string, LabelLocation>

/**
 * Result of executing a single statement.
 * Includes the updated context, flow control signal, and action log.
 *
 * R-INT-41: Actions are no longer stored in context, but returned separately.
 * R-INT-42: Cost is no longer stored in context, but returned separately.
 */
interface StatementResult {
  context: ExecutionContext
  flow: FlowControl
  log?: ActionLog // The action log for this execution (if instruction)
  cost: number // Cost of this execution
}

/**
 * Output target namespace and key parsed from output=... argument.
 */
export interface OutputTarget {
  namespace: 'data' | 'scope'
  key: string
}

/**
 * Parses an output target string to determine namespace and key.
 *
 * - `scope.user` -> { namespace: 'scope', key: 'user' }
 * - `scope.user.profile` -> { namespace: 'scope', key: 'user.profile' }
 * - `user` -> { namespace: 'data', key: 'user' }
 * - `data.user` -> { namespace: 'data', key: 'data.user' } (no special casing)
 *
 * @param output - The output target string from output=...
 * @returns Parsed namespace and key
 */
export function parseOutputTarget(output: string): OutputTarget {
  if (output.startsWith('scope.')) {
    return {
      namespace: 'scope',
      key: output.slice(6), // Remove 'scope.' prefix
    }
  }
  // Default to data namespace (no special casing for 'data.' prefix)
  return {
    namespace: 'data',
    key: output,
  }
}

/**
 * Result of executing a statement list.
 * Includes updated context, flow control, accumulated actions and cost.
 */
interface StatementListResult {
  context: ExecutionContext
  flow: FlowControl
  actions: ActionLog[]
  cost: number
}

// R-SYSVAR-63: Extracted helper to inject $-prefixed system variables into scope
function writeSystemVariables(
  index: number,
  length: number,
  scopeChain: ScopeChain,
): void {
  write('$index', index, scopeChain)
  write('$count', index + 1, scopeChain)
  write('$length', length, scopeChain)
  write('$first', index === 0, scopeChain)
  write('$last', index === length - 1, scopeChain)
  write('$odd', (index + 1) % 2 === 1, scopeChain)
  write('$even', (index + 1) % 2 === 0, scopeChain)
}

export class CoreInterpreter implements Interpreter {
  constructor(
    private registry: CommandRegistry,
    private evaluator = new ExpressionEvaluator(),
  ) {}

  /**
   * R-BLK-02: Build enhanced label index that maps labels to their AST locations.
   * Labels can only appear on InstructionNode (R-BLK-03).
   */
  buildEnhancedLabelIndex(program: ProgramNode): EnhancedLabelIndex {
    const index: EnhancedLabelIndex = new Map()

    const walkStatements = (
      statements: StatementNode[],
      pathPrefix: number[],
    ) => {
      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i]
        const currentPath = [...pathPrefix, i]

        if (statement.type === 'instruction') {
          // R-BLK-03: Labels can only appear on InstructionNode
          if (statement.label) {
            index.set(statement.label, {
              path: currentPath,
              instruction: statement,
            })
          }
        } else if (statement.type === 'block') {
          // Recursively walk block body
          walkStatements(statement.body, currentPath)
        }
        // TemplateNode and other types don't have labels
      }
    }

    walkStatements(program.body, [])
    return index
  }

  /**
   * Execute a single instruction and return both the updated context and flow control signal.
   *
   * R-INT-41: Actions are not stored in context, but returned as log in StatementResult.
   * R-INT-42: Cost is not stored in context, but returned in StatementResult.
   */
  async execute(
    instruction: InstructionNode,
    context: ExecutionContext,
  ): Promise<StatementResult> {
    const start = nowTs()
    const id = `@${instruction.action.path.join('/')}`
    const handler = await this.registry.resolve(id)
    if (!handler) throw new Error(`Command not found: ${id}`)

    const args: Record<string, any> = {}
    for (const arg of instruction.args) {
      args[arg.name.value] = await this.evaluator.evaluate(arg.value, context)
    }

    const result = await handler.run(args, context)

    const outcome: InstructionOutcome = {
      success: result.success,
    }

    const hasOutput = !!(instruction.output && result.success)
    const hasCollect = !!(instruction.collect && result.success)
    const outputKey = instruction.output?.value

    if (hasOutput || hasCollect) {
      outcome.value = result.value
    }

    const end = nowTs()
    const returnedContext = cloneExecutionContext(context)

    // Write output to appropriate namespace
    if (outputKey && hasOutput) {
      const target = parseOutputTarget(outputKey)
      if (target.namespace === 'scope') {
        write(target.key, outcome.value, returnedContext.scopeChain)
      } else {
        lodashSet(returnedContext.data, target.key, outcome.value)
      }
    }

    // Build ActionLog (returned separately, not stored in context)
    const log: ActionLog = {
      command: id,
      success: outcome.success,
      start: toReadableDate(start),
      end: toReadableDate(end),
      duration: end - start,
      messages: result.messages || [],
      fatalError: result.fatalError,
      cost: result.cost,
      output: outputKey,
      value: (hasOutput || hasCollect) ? outcome.value : undefined,
    }

    // Determine flow control based on command result
    const flow = this.determineFlowControl(id, result.value)

    return { context: returnedContext, flow, log, cost: result.cost }
  }

  /**
   * R-FILTER-81: Execute an instruction with retry support.
   * If instruction.retry is set, wraps execution in a retry loop.
   * retry=0 means no retry (1 attempt), retry=N means N retries (N+1 attempts).
   */
  async executeWithRetry(
    instruction: InstructionNode,
    context: ExecutionContext,
  ): Promise<StatementResult> {
    if (!instruction.retry) {
      return this.execute(instruction, context)
    }

    const retryCount = await this.evaluator.evaluate(
      instruction.retry,
      context,
    )
    const maxRetries = typeof retryCount === 'number' ? retryCount : 0

    let lastError: Error | undefined
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(instruction, context)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt === maxRetries) {
          throw lastError
        }
      }
    }

    throw lastError!
  }

  /**
   * Determine flow control based on command execution result.
   * Flow commands (@flow/goto, @flow/exit, @flow/return) return special values.
   */
  private determineFlowControl(commandId: string, value: any): FlowControl {
    if (commandId === '@flow/goto' && value?.type === 'goto') {
      const gotoResult = value as GotoResult
      return { type: 'goto', target: gotoResult.target }
    }

    if (commandId === '@flow/exit' && value?.type === 'exit') {
      const exitResult = value as ExitResult
      return { type: 'exit', code: exitResult.code }
    }

    if (commandId === '@flow/return' && value?.type === 'return') {
      const returnResult = value as ReturnResult
      return { type: 'return', value: returnResult.value }
    }

    return { type: 'continue' }
  }

  /**
   * Execute a full program (sequence of statements).
   * Handles InstructionNode, BlockNode, flow control, and labels.
   *
   * R-BLK-41: Uses executeStatementList() for statement-based execution.
   * R-GOTO-22: Handles instruction pointer jumps for @flow/goto
   * R-GOTO-25: Preserves execution context on jumps
   * R-TERM-22: Builds ProgramResult with batches: BatchResult[]
   */
  async executeProgram(
    program: ProgramNode,
    context: ExecutionContext,
  ): Promise<ProgramResult> {
    const programStart = nowTs()

    // R-BLK-02: Build enhanced label index
    const labelIndex = this.buildEnhancedLabelIndex(program)

    // R-BLK-41: Execute using statement-based execution
    const result = await this.executeStatementList(
      program.body,
      context,
      labelIndex,
      [],
      0,
    )

    const programEnd = nowTs()
    const programDuration = programEnd - programStart

    // Build cost info
    const cost: CostInfo = { current: result.cost }

    // Build a single BatchResult for the top-level program execution
    const batch: BatchResult = {
      success: result.flow.type !== 'exit' || (result.flow as any).code === 0,
      message: 'Program execution',
      actions: result.actions,
      totalCost: result.cost,
      duration: programDuration,
    }

    const batches: BatchResult[] = [batch]

    // exitedAt is the 0-based index of the last executed action
    const exitedAt = result.actions.length > 0 ? result.actions.length - 1 : 0

    // Handle final flow control
    switch (result.flow.type) {
      case 'exit': {
        return createEarlyExit(
          result.context,
          result.flow.code,
          exitedAt,
          batches,
          cost,
          programDuration,
        )
      }
      case 'return': {
        return createReturn(
          result.context,
          result.flow.value,
          exitedAt,
          batches,
          cost,
          programDuration,
        )
      }
      case 'goto': {
        // Unresolved goto at top level - label not found
        throw new Error(`Unknown label: ${result.flow.target}`)
      }
      case 'continue':
      default:
        return createNormalCompletion(
          result.context,
          batches,
          cost,
          programDuration,
        )
    }
  }

  /**
   * R-BLK-21: Execute a list of statements with support for goto, blocks, and forEach.
   *
   * @param statements - The list of statements to execute
   * @param context - Current execution context
   * @param labelIndex - Enhanced label index for goto resolution
   * @param currentPath - Path to this statement list in the AST (for goto resolution)
   * @param startIndex - Index to start execution from (for goto within same list)
   */
  private async executeStatementList(
    statements: StatementNode[],
    context: ExecutionContext,
    labelIndex: EnhancedLabelIndex,
    currentPath: number[],
    startIndex: number = 0,
  ): Promise<StatementListResult> {
    const actions: ActionLog[] = []
    let totalCost = 0
    let currentContext = context
    let i = startIndex

    while (i < statements.length) {
      const statement = statements[i]

      if (statement.type === 'instruction') {
        // R-FILTER-43: instruction-level forEach
        if (statement.forEach) {
          const forEachResult = await this.executeForEachInstruction(
            statement,
            currentContext,
          )
          currentContext = forEachResult.context
          actions.push(...forEachResult.actions)
          totalCost += forEachResult.cost

          if (forEachResult.flow.type !== 'continue') {
            return {
              context: currentContext,
              flow: forEachResult.flow,
              actions,
              cost: totalCost,
            }
          }
          i++
          continue
        }

        // R-BLK-22: For InstructionNode: check condition, execute, handle flow control
        if (statement.condition) {
          const conditionValue = await this.evaluator.evaluate(
            statement.condition,
            currentContext,
          )
          if (!conditionValue) {
            // Condition is falsy, skip this instruction
            i++
            continue
          }
        }

        const result = await this.executeWithRetry(statement, currentContext)
        currentContext = result.context

        if (result.log) {
          actions.push(result.log)
        }
        totalCost += result.cost

        // R-FILTER-101: collect without forEach wraps single result in array
        if (statement.collect && result.log?.value !== undefined) {
          const collectKey = statement.collect.value
          const target = parseOutputTarget(collectKey)
          if (target.namespace === 'scope') {
            write(target.key, [result.log.value], currentContext.scopeChain)
          } else {
            lodashSet(currentContext.data, target.key, [result.log.value])
          }
        }

        // Handle flow control
        if (result.flow.type === 'goto') {
          // R-BLK-24: Try to resolve goto
          const gotoResult = this.resolveGoto(
            result.flow.target,
            labelIndex,
            currentPath,
            statements,
          )

          if (gotoResult.type === 'local') {
            // Local goto - adjust index and continue
            i = gotoResult.index
            continue
          } else {
            // Non-local goto - bubble up
            return {
              context: currentContext,
              flow: result.flow,
              actions,
              cost: totalCost,
            }
          }
        }

        if (result.flow.type !== 'continue') {
          // exit or return - bubble up
          return {
            context: currentContext,
            flow: result.flow,
            actions,
            cost: totalCost,
          }
        }
      } else if (statement.type === 'block') {
        // R-BLK-23: For BlockNode: call executeBlock(), propagate flow control
        const blockResult = await this.executeBlockWithStatementList(
          statement,
          currentContext,
          labelIndex,
          [...currentPath, i],
        )

        currentContext = blockResult.context
        actions.push(...blockResult.actions)
        totalCost += blockResult.cost

        // Handle flow control from block
        if (blockResult.flow.type === 'goto') {
          // Try to resolve goto at this level
          const gotoResult = this.resolveGoto(
            blockResult.flow.target,
            labelIndex,
            currentPath,
            statements,
          )

          if (gotoResult.type === 'local') {
            i = gotoResult.index
            continue
          } else {
            // Non-local goto - bubble up
            return {
              context: currentContext,
              flow: blockResult.flow,
              actions,
              cost: totalCost,
            }
          }
        }

        if (blockResult.flow.type !== 'continue') {
          // exit or return - bubble up
          return {
            context: currentContext,
            flow: blockResult.flow,
            actions,
            cost: totalCost,
          }
        }
      }
      // TemplateNode and other types are skipped for now

      i++
    }

    return {
      context: currentContext,
      flow: { type: 'continue' },
      actions,
      cost: totalCost,
    }
  }

  /**
   * R-BLK-24: Resolve a goto target. Returns local if target is in the same statement list,
   * or non-local if it needs to bubble up.
   */
  private resolveGoto(
    target: string,
    labelIndex: EnhancedLabelIndex,
    currentPath: number[],
    statements: StatementNode[],
  ): { type: 'local'; index: number } | { type: 'non-local' } {
    const location = labelIndex.get(target)
    if (!location) {
      // Unknown label - will be caught at top level
      return { type: 'non-local' }
    }

    // Check if the label is in this statement list (same path prefix)
    const labelPath = location.path
    const pathDepth = currentPath.length

    // If label path starts with current path and has exactly one more element,
    // it's a direct child of this statement list
    if (labelPath.length === pathDepth + 1) {
      const prefixMatches = currentPath.every((v, idx) => labelPath[idx] === v)
      if (prefixMatches) {
        // Local goto - return the index
        return { type: 'local', index: labelPath[pathDepth] }
      }
    }

    // Also handle case where we're at root level (currentPath is empty)
    if (pathDepth === 0 && labelPath.length === 1) {
      return { type: 'local', index: labelPath[0] }
    }

    return { type: 'non-local' }
  }

  /**
   * R-BLK-42: Execute a block using executeStatementList for body execution.
   * Handles both conditional blocks (if=) and iteration blocks (forEach=).
   */
  private async executeBlockWithStatementList(
    block: BlockNode,
    context: ExecutionContext,
    labelIndex: EnhancedLabelIndex,
    blockPath: number[],
  ): Promise<StatementListResult> {
    // R-FILTER-41: When block has BOTH forEach AND condition,
    // pass condition into the forEach execution path for per-item filtering.
    if (block.forEach) {
      return this.executeForEachWithStatementList(
        block,
        block.forEach,
        context,
        labelIndex,
        blockPath,
      )
    }

    // Check condition if present (block with if= only, no forEach)
    if (block.condition) {
      const conditionValue = await this.evaluator.evaluate(
        block.condition,
        context,
      )
      if (!conditionValue) {
        // Condition is falsy, skip block
        return {
          context,
          flow: { type: 'continue' },
          actions: [],
          cost: 0,
        }
      }
    }

    // Execute all statements in the block body
    return this.executeStatementList(
      block.body,
      context,
      labelIndex,
      blockPath,
      0,
    )
  }

  /**
   * R-BLK-43: Execute a forEach block using executeStatementList for each iteration.
   *
   * System variables injected into each iteration's scope:
   * - _index: 0-based index
   * - _count: 1-based count (== _index + 1)
   * - _length: total number of items
   * - _first: true if first iteration
   * - _last: true if last iteration
   * - _odd: true if 1-based count is odd (1st, 3rd, 5th...)
   * - _even: true if 1-based count is even (2nd, 4th, 6th...)
   *
   * The iterator variable (e.g., "user" in "users -> user") is also injected.
   */
  private async executeForEachWithStatementList(
    block: BlockNode,
    forEach: ForEachArgNode,
    context: ExecutionContext,
    labelIndex: EnhancedLabelIndex,
    blockPath: number[],
  ): Promise<StatementListResult> {
    const actions: ActionLog[] = []
    let totalCost = 0

    // Evaluate the iterable expression
    const iterable = await this.evaluator.evaluate(forEach.iterable, context)

    // Validate that the iterable is actually an array
    if (!Array.isArray(iterable)) {
      const type = iterable === null ? 'null' : typeof iterable
      throw new Error(`Cannot iterate over ${type}. forEach requires an array.`)
    }

    // R-FE-103: Empty collection should execute 0 times
    if (iterable.length === 0) {
      return {
        context,
        flow: { type: 'continue' },
        actions: [],
        cost: 0,
      }
    }

    const iteratorName = forEach.iterator.value
    const length = iterable.length
    let currentContext = context

    for (let index = 0; index < length; index++) {
      const item = iterable[index]

      // Create a new scope for this iteration
      currentContext = cloneExecutionContext(currentContext)
      currentContext.scopeChain = pushScope(currentContext.scopeChain)

      // R-SYSVAR-61: Inject $-prefixed system variables
      writeSystemVariables(index, length, currentContext.scopeChain)

      // Inject the iterator variable
      write(iteratorName, item, currentContext.scopeChain)

      // R-FILTER-42: per-item condition evaluation (filter pattern)
      if (block.condition) {
        const conditionValue = await this.evaluator.evaluate(
          block.condition,
          currentContext,
        )
        if (!conditionValue) {
          currentContext.scopeChain = popScope(currentContext.scopeChain)
          continue
        }
      }

      // Execute all statements in the block body using executeStatementList
      const result = await this.executeStatementList(
        block.body,
        currentContext,
        labelIndex,
        blockPath,
        0,
      )

      currentContext = result.context
      actions.push(...result.actions)
      totalCost += result.cost

      // Pop the scope to discard iteration-specific variables
      currentContext.scopeChain = popScope(currentContext.scopeChain)

      // Propagate flow control signals up (exit, return, goto)
      if (result.flow.type !== 'continue') {
        return {
          context: currentContext,
          flow: result.flow,
          actions,
          cost: totalCost,
        }
      }
    }

    return {
      context: currentContext,
      flow: { type: 'continue' },
      actions,
      cost: totalCost,
    }
  }

  /**
   * R-FILTER-43: Execute a single instruction with forEach (and optional if filter).
   * Handles the precedence chain: forEach -> if -> execute -> output
   */
  private async executeForEachInstruction(
    instruction: InstructionNode,
    context: ExecutionContext,
  ): Promise<StatementListResult> {
    const forEach = instruction.forEach!
    const actions: ActionLog[] = []
    let totalCost = 0

    const iterable = await this.evaluator.evaluate(forEach.iterable, context)

    if (!Array.isArray(iterable)) {
      const type = iterable === null ? 'null' : typeof iterable
      throw new Error(`Cannot iterate over ${type}. forEach requires an array.`)
    }

    const collectKey = instruction.collect?.value
    const collected: unknown[] = []

    if (iterable.length === 0) {
      // R-FILTER-102: empty forEach with collect produces empty array
      let resultContext = context
      if (collectKey) {
        resultContext = cloneExecutionContext(context)
        const target = parseOutputTarget(collectKey)
        if (target.namespace === 'scope') {
          write(target.key, [], resultContext.scopeChain)
        } else {
          lodashSet(resultContext.data, target.key, [])
        }
      }
      return {
        context: resultContext,
        flow: { type: 'continue' },
        actions: [],
        cost: 0,
      }
    }

    const iteratorName = forEach.iterator.value
    const length = iterable.length
    let currentContext = context

    for (let index = 0; index < length; index++) {
      const item = iterable[index]

      currentContext = cloneExecutionContext(currentContext)
      currentContext.scopeChain = pushScope(currentContext.scopeChain)

      // R-SYSVAR-62: Inject $-prefixed system variables (R-FILTER-44: count ALL items)
      writeSystemVariables(index, length, currentContext.scopeChain)

      write(iteratorName, item, currentContext.scopeChain)

      // R-FILTER-43: per-item if filtering
      if (instruction.condition) {
        const conditionValue = await this.evaluator.evaluate(
          instruction.condition,
          currentContext,
        )
        if (!conditionValue) {
          currentContext.scopeChain = popScope(currentContext.scopeChain)
          continue
        }
      }

      const result = await this.executeWithRetry(instruction, currentContext)
      currentContext = result.context

      if (result.log) {
        actions.push(result.log)
        // R-FILTER-102: accumulate result value for collect
        if (collectKey && result.log.value !== undefined) {
          collected.push(result.log.value)
        }
      }
      totalCost += result.cost

      currentContext.scopeChain = popScope(currentContext.scopeChain)

      if (result.flow.type !== 'continue') {
        return {
          context: currentContext,
          flow: result.flow,
          actions,
          cost: totalCost,
        }
      }
    }

    // R-FILTER-102: write collected results to context
    if (collectKey) {
      const target = parseOutputTarget(collectKey)
      if (target.namespace === 'scope') {
        write(target.key, collected, currentContext.scopeChain)
      } else {
        lodashSet(currentContext.data, target.key, collected)
      }
    }

    return {
      context: currentContext,
      flow: { type: 'continue' },
      actions,
      cost: totalCost,
    }
  }
}

export interface InstructionOutcome {
  success: boolean
  value?: any
  error?: string
}

export function assertDefined<T>(
  value: T,
): asserts value is Exclude<T, undefined> {
  if (value === undefined) {
    throw new Error('Expected value to be defined')
  }
}
