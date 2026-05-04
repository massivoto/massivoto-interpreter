/**
 * Edge cases for `_project` and underscore-system identifiers.
 *
 * R-WORKSPACE-22, R-WORKSPACE-23: read paths must work like ordinary
 * identifiers (no special handling beyond the read-only protection on writes).
 *
 * R-WORKSPACE-24: write protection extends to `output=scope._project` as
 * well, since the system identifier itself (not its namespace) is what's
 * reserved.
 *
 * Theme: Cabinet de conseil. Émilie iterates over a list of decks for
 * acme-corp; she expects `{_project}` to keep returning "acme-corp" inside
 * the forEach body.
 */
import { describe, it, expect } from 'vitest'

import { ExpressionEvaluator } from './evaluators.js'
import {
  ExecutionContext,
  createEmptyExecutionContext,
  pushScope,
  write,
} from '@massivoto/kit'
import type { IdentifierNode } from '../parser/ast.js'

import { assertOutputKeyIsWritable } from './system-variables.js'

const idNode = (name: string): IdentifierNode => ({
  type: 'identifier',
  value: name,
})

describe('_project resolution through ExpressionEvaluator (R-WORKSPACE-22)', () => {
  it('resolves _project from the root scope as a regular identifier', async () => {
    const evaluator = new ExpressionEvaluator()
    const ctx: ExecutionContext = createEmptyExecutionContext('test')
    write('_project', 'acme-corp', ctx.scopeChain)

    const result = await evaluator.evaluate(idNode('_project'), ctx)

    expect(result).toBe('acme-corp')
  })

  it('returns undefined when _project is not in any scope (R-WORKSPACE-23)', async () => {
    const evaluator = new ExpressionEvaluator()
    const ctx: ExecutionContext = createEmptyExecutionContext('test')

    const result = await evaluator.evaluate(idNode('_project'), ctx)

    expect(result).toBeUndefined()
  })

  it('keeps resolving _project from the parent scope inside a nested block', async () => {
    const evaluator = new ExpressionEvaluator()
    const ctx: ExecutionContext = createEmptyExecutionContext('test')
    write('_project', 'acme-corp', ctx.scopeChain)

    // Simulate entering a forEach body: push a child scope with iteration vars.
    ctx.scopeChain = pushScope(ctx.scopeChain)
    write('deck', 'pitch.pptx', ctx.scopeChain)

    const projectInBlock = await evaluator.evaluate(idNode('_project'), ctx)
    const deckInBlock = await evaluator.evaluate(idNode('deck'), ctx)

    expect(projectInBlock).toBe('acme-corp')
    expect(deckInBlock).toBe('pitch.pptx')
  })

  it('lets a nested scope shadow _project temporarily without leaking outwards', async () => {
    const evaluator = new ExpressionEvaluator()
    const ctx: ExecutionContext = createEmptyExecutionContext('test')
    write('_project', 'acme-corp', ctx.scopeChain)

    // Entering an inner scope that intentionally redefines _project (this
    // is unusual but permitted on read; only output= writes are blocked).
    ctx.scopeChain = pushScope(ctx.scopeChain)
    write('_project', 'inner-shadow', ctx.scopeChain)

    const inner = await evaluator.evaluate(idNode('_project'), ctx)
    expect(inner).toBe('inner-shadow')

    // Pop back to parent scope.
    ctx.scopeChain = ctx.scopeChain.parent!
    const outer = await evaluator.evaluate(idNode('_project'), ctx)
    expect(outer).toBe('acme-corp')
  })
})

describe('output= protection (R-WORKSPACE-24)', () => {
  it('rejects output=_project regardless of value', () => {
    const expr = idNode('_project')
    expect(() => assertOutputKeyIsWritable('_project', expr)).toThrow(
      /_project is read-only/,
    )
  })

  it('rejects output=scope._project (after parseOutputTarget strips "scope." prefix)', () => {
    // parseOutputTarget('scope._project') yields { namespace: 'scope', key: '_project' }.
    // The check operates on the key, so the namespace doesn't matter.
    const expr = idNode('_project')
    expect(() => assertOutputKeyIsWritable('_project', expr)).toThrow(
      /_project is read-only/,
    )
  })

  it('does not interfere with ordinary writes', () => {
    const expr = idNode('result')
    expect(() => assertOutputKeyIsWritable('result', expr)).not.toThrow()
    expect(() => assertOutputKeyIsWritable('user.profile', expr)).not.toThrow()
  })
})
