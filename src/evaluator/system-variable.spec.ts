import { describe, it, expect } from 'vitest'
import { ExpressionEvaluator } from './evaluators.js'
import {
  createEmptyExecutionContext,
  pushScope,
  write,
} from '@massivoto/kit'
import { SystemVariableNode } from '../parser/ast.js'

/**
 * Formula One Race theme: evaluator resolves $-prefixed system variables from scope chain only.
 *
 * Scenario: during a forEach over 3 F1 drivers ["Verstappen", "Hamilton", "Leclerc"],
 * the runtime writes $index, $count, $length etc. into scope.
 * The evaluator resolves SystemVariableNode by looking up '$' + name in scope chain.
 */
describe('System Variable Evaluator (R-SYSVAR-41 to 42)', () => {
  const evaluator = new ExpressionEvaluator()

  function makeSystemVar(name: string): SystemVariableNode {
    return { type: 'system-variable', name }
  }

  describe('R-SYSVAR-41: scope-only lookup for system variables', () => {
    it('AC-SYSVAR-01: resolves $index from scope chain', async () => {
      const context = createEmptyExecutionContext('f1-race')
      context.scopeChain = pushScope(context.scopeChain)
      write('$index', 0, context.scopeChain)

      const result = await evaluator.evaluate(makeSystemVar('index'), context)
      expect(result).toBe(0)
    })

    it('resolves $count from scope chain', async () => {
      const context = createEmptyExecutionContext('f1-race')
      context.scopeChain = pushScope(context.scopeChain)
      write('$count', 2, context.scopeChain)

      const result = await evaluator.evaluate(makeSystemVar('count'), context)
      expect(result).toBe(2)
    })

    it('resolves $length from scope chain', async () => {
      const context = createEmptyExecutionContext('f1-race')
      context.scopeChain = pushScope(context.scopeChain)
      write('$length', 3, context.scopeChain)

      const result = await evaluator.evaluate(makeSystemVar('length'), context)
      expect(result).toBe(3)
    })

    it('resolves $first as boolean true from scope', async () => {
      const context = createEmptyExecutionContext('f1-race')
      context.scopeChain = pushScope(context.scopeChain)
      write('$first', true, context.scopeChain)

      const result = await evaluator.evaluate(makeSystemVar('first'), context)
      expect(result).toBe(true)
    })

    it('resolves $last as boolean false from scope', async () => {
      const context = createEmptyExecutionContext('f1-race')
      context.scopeChain = pushScope(context.scopeChain)
      write('$last', false, context.scopeChain)

      const result = await evaluator.evaluate(makeSystemVar('last'), context)
      expect(result).toBe(false)
    })

    it('does NOT fall back to context.data', async () => {
      const context = createEmptyExecutionContext('f1-race')
      context.data['$index'] = 42

      const result = await evaluator.evaluate(makeSystemVar('index'), context)
      expect(result).toBeUndefined()
    })
  })

  describe('R-SYSVAR-42: undefined when not in scope', () => {
    it('AC-SYSVAR-08: $index outside forEach returns undefined', async () => {
      const context = createEmptyExecutionContext('f1-race')

      const result = await evaluator.evaluate(makeSystemVar('index'), context)
      expect(result).toBeUndefined()
    })

    it('$runId not yet defined returns undefined', async () => {
      const context = createEmptyExecutionContext('f1-race')
      context.scopeChain = pushScope(context.scopeChain)

      const result = await evaluator.evaluate(makeSystemVar('runId'), context)
      expect(result).toBeUndefined()
    })
  })
})
